#!/usr/bin/env node
/**
 * Сквозная проверка оформления заказа в браузере.
 *
 * Один запуск Chrome, три загрузки страницы:
 *   1. главная — собираем корзину, проверяем валидацию формы и отправляем её;
 *   2. thanks-cart.html — заказ из хранилища показан;
 *   3. thanks-cart.html без заказа — пустое состояние.
 *
 * Почему отдельный файл, а не запрос для ~/.dsh/bin/browser.mjs: нужен
 * переход между страницами, а харнесс выполняет один запрос на одной
 * странице.
 *
 * Проверять submit «в лоб» нельзя: обработчик формы уводит на другую
 * страницу, и контекст, в котором считается скрипт, умирает — DevTools
 * отвечает «Inspected target navigated or closed». Подменить location.href
 * тоже не выйдет: свойство не переопределяется. Поэтому замеры делаются
 * до отправки, а что заказ сохранён и корзина очищена — проверяется
 * на следующей загрузке, где значения уже читаются из localStorage.
 *
 * Запуск:
 *   node checks/req-checkout.mjs [http://127.0.0.1:8000/]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8000/').replace(/\/$/, '');
const PORT = 9200 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[checkout] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

/**
 * Порог свободной памяти. Проверка открывает одну вкладку с лёгкой
 * страницей — это не тот случай, ради которого в ~/.dsh/AGENTS.md стоит
 * порог 3500 МБ (там речь о сериях скриншотов).
 */
const MIN_FREE_MB = Number(process.env.CHECKOUT_MIN_FREE_MB) || 2000;
const free = Math.round(freemem() / 1024 / 1024);
say(`память: свободно ${free} МБ (порог ${MIN_FREE_MB})`);
if (free < MIN_FREE_MB) { say('мало памяти — запуск отменён'); process.exit(2); }

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-checkout-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`, '--window-size=1280,900', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const retry = async (fn, times = 60, delay = 250) => {
  let last;
  for (let i = 0; i < times; i++) {
    try { return await fn(); } catch (e) { last = e; await sleep(delay); }
  }
  throw last;
};

let ws;
const failures = [];
const ok = (condition, name, detail = '') => {
  if (condition) { say(`OK   ${name}`); return; }
  failures.push(`${name}${detail ? ' -> ' + detail : ''}`);
  say(`FAIL ${name}${detail ? ' -> ' + detail : ''}`);
};

/**
 * Приводит текст к сравнимому виду.
 *
 * Цены печатает formatPrice, а он разделяет разряды НЕразрывным пробелом
 * (\u00A0) — в проверке это не видно, и сравнение с обычным пробелом
 * молча не проходит. Заодно убираем лишние пробелы.
 */
const plain = (value) => String(value ?? '').replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const has = (value, part) => plain(value).includes(plain(part));

try {
  const wsUrl = await retry(async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const page = (await res.json()).find((t) => t.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('нет вкладки');
    return page.webSocketDebuggerUrl;
  });

  ws = new WS(wsUrl);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  let id = 0;
  const pending = new Map();
  const logs = [];

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('exception: ' + (msg.params.exceptionDetails.exception?.description ?? ''));
    }
  });

  const send = (method, params = {}) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      setTimeout(() => {
        if (pending.has(msgId)) { pending.delete(msgId); reject(new Error(`таймаут ${method}`)); }
      }, 25000);
    });
  };

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'исключение');
    return res.result.value;
  };

  const open = async (url) => {
    await send('Page.navigate', { url });
    await sleep(2000);
  };

  await send('Page.enable');
  await send('Runtime.enable');

  // ── 1. Главная: корзина, валидация, отправка ────────────────────────

  await open(`${BASE}/index.html`);

  const home = await evaluate(`(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const out = {};

    localStorage.removeItem('cozy-pajamas:cart');
    localStorage.removeItem('cozy-pajamas:order');
    document.dispatchEvent(new CustomEvent('cart:change'));
    await frame();

    // Дорогая пижама (12199 × 2 = 24398) и услуга «ПРИНТ»: порог 15000
    // перекрыт, значит услуга должна стать бесплатной
    localStorage.setItem('cozy-pajamas:cart', JSON.stringify([
      { id: 'goods-women-03', qty: 2, size: '' },
    ]));
    document.dispatchEvent(new CustomEvent('cart:change'));
    await frame();
    press(document.querySelector('[data-cart-add="print"]'));
    await frame();
    press(document.querySelector('[data-cart-open]'));
    await frame();

    out.totalBefore = document.querySelector('[data-cart-total]')?.textContent.trim();
    out.serviceNote = [...document.querySelectorAll('.cart__note')]
      .map((n) => n.textContent.replace(/\\s+/g, ' ').trim());

    const form = document.querySelector('[data-checkout-form]');
    out.formPresent = Boolean(form);
    if (!form) return out;

    // Отправка пустой формы: ждём ошибки у имени и телефона.
    // preventDefault в обработчике обязателен — иначе браузер уйдёт
    // по action="" и контекст умрёт. Проверяем его отдельно.
    const probe = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(probe);
    await frame();

    out.emptySubmit = {
      prevented: probe.defaultPrevented,
      errors: [...form.querySelectorAll('[data-checkout-error]')]
        .map((e) => ({ field: e.dataset.checkoutError, text: e.textContent.trim() }))
        .filter((e) => e.text),
      invalid: form.querySelectorAll('.checkout__input.is-invalid').length,
      focused: document.activeElement?.name ?? null,
      orderSaved: localStorage.getItem('cozy-pajamas:order') !== null,
    };

    // Короткий телефон: ошибка только у телефона
    form.name.value = 'Анна';
    form.phone.value = '123';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await frame();
    out.badPhone = {
      errors: [...form.querySelectorAll('[data-checkout-error]')].map((e) => e.textContent.trim()).filter(Boolean),
      nameInvalid: form.name.classList.contains('is-invalid'),
      phoneInvalid: form.phone.classList.contains('is-invalid'),
    };

    // Исправили телефон: ошибка уходит без отправки
    form.phone.value = '+7 900 123-45-67';
    form.phone.dispatchEvent(new Event('input', { bubbles: true }));
    await frame();
    out.fixedPhone = {
      phoneInvalid: form.phone.classList.contains('is-invalid'),
      errors: [...form.querySelectorAll('[data-checkout-error]')].map((e) => e.textContent.trim()).filter(Boolean),
    };

    // Настоящая отправка: проверить, что она уводит на thanks-cart.html,
    // нельзя — контекст умрёт вместе со страницей. Проверяем адрес перехода
    // в разметке и то, что обработчик отменяет действие браузера.
    out.redirectTarget = form.dataset.checkoutRedirect;

    form.email.value = 'anna@example.ru';
    const realSubmit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(realSubmit);
    out.realSubmitPrevented = realSubmit.defaultPrevented;

    return out;
  })()`);

  ok(home.formPresent, 'форма оформления есть в окне корзины');
  ok(has(home.totalBefore, '24 398'), 'итог до оформления: услуга бесплатна',
    String(home.totalBefore));
  ok(home.serviceNote.some((t) => has(t, 'бесплатна')), 'подсказка про бесплатную услугу',
    JSON.stringify(home.serviceNote));

  ok(home.emptySubmit.prevented === true, 'пустая форма: браузерное действие отменено');
  const emptyFields = home.emptySubmit.errors.map((e) => e.field).sort();
  ok(emptyFields.includes('name') && emptyFields.includes('phone'),
    'пустая форма: ошибки у имени и телефона', JSON.stringify(emptyFields));
  ok(home.emptySubmit.invalid === 2, 'пустая форма: два поля помечены неверными',
    String(home.emptySubmit.invalid));
  ok(home.emptySubmit.focused === 'name', 'фокус ушёл на первое неверное поле',
    String(home.emptySubmit.focused));
  ok(home.emptySubmit.orderSaved === false, 'при ошибках заказ не сохраняется');

  ok(home.badPhone.errors.length === 1, 'короткий телефон: ровно одна ошибка',
    JSON.stringify(home.badPhone.errors));
  ok(home.badPhone.phoneInvalid && !home.badPhone.nameInvalid,
    'короткий телефон: помечено только поле телефона');
  ok(!home.fixedPhone.phoneInvalid && home.fixedPhone.errors.length === 0,
    'после исправления ошибка уходит без отправки', JSON.stringify(home.fixedPhone));

  ok(home.redirectTarget === 'thanks-cart.html', 'адрес перехода задан в разметке',
    String(home.redirectTarget));
  ok(home.realSubmitPrevented === true, 'верная форма: браузерное действие отменено, заказ оформлен');

  // ── 2. Страница благодарности: заказ из хранилища ───────────────────

  await open(`${BASE}/thanks-cart.html`);

  const thanks = await evaluate(`(() => {
    const text = (sel) => document.querySelector(sel)?.textContent.replace(/\\s+/g, ' ').trim() ?? null;
    const order = (() => {
      try { return JSON.parse(localStorage.getItem('cozy-pajamas:order') ?? 'null'); } catch { return null; }
    })();
    return {
      path: location.pathname,
      page: document.body.dataset.page,
      orderNumber: order?.number ?? null,
      orderTotal: order?.totals?.total ?? null,
      orderItems: order?.items?.length ?? 0,
      customer: order?.customer ?? null,
      cartAfter: localStorage.getItem('cozy-pajamas:cart'),
      greeting: text('[data-thanks-greeting]'),
      number: text('[data-thanks-number]'),
      date: text('[data-thanks-date]'),
      summary: text('[data-thanks-summary]'),
      items: [...document.querySelectorAll('[data-thanks-items] .cart__item')]
        .map((li) => li.textContent.replace(/\\s+/g, ' ').trim()),
      total: text('[data-thanks-items] .cart__total'),
      bodyHidden: document.querySelector('[data-thanks-body]')?.classList.contains('is-hidden'),
      emptyHidden: document.querySelector('[data-thanks-empty]')?.classList.contains('is-hidden'),
      backLink: document.querySelector('.thanks__back')?.getAttribute('href'),
    };
  })()`);

  ok(thanks.path.includes('thanks-cart.html'), 'открылась страница благодарности', thanks.path);
  ok(thanks.page === 'thanks-cart', 'страница опознана как thanks-cart', String(thanks.page));
  ok(thanks.orderItems === 2, 'в заказе две позиции', String(thanks.orderItems));
  ok(thanks.orderTotal === 24398, 'итог заказа без платы за бесплатную услугу', String(thanks.orderTotal));
  ok(thanks.customer?.name === 'Анна', 'в заказе имя покупателя', String(thanks.customer?.name));
  ok(thanks.cartAfter === '[]', 'корзина очищена после оформления', String(thanks.cartAfter));
  ok(/^Заказ № \d{12}$/.test(thanks.number ?? ''), 'номер заказа показан', String(thanks.number));
  ok(thanks.greeting === 'Анна, спасибо за заказ!', 'приветствие с именем', String(thanks.greeting));
  ok(Boolean(thanks.date), 'дата показана', String(thanks.date));
  ok(thanks.items.length === 2, 'в составе заказа две строки', String(thanks.items.length));
  ok(thanks.items.some((t) => has(t, 'Клубичные поля') && has(t, '× 2')),
    'позиция с количеством', JSON.stringify(thanks.items));
  ok(thanks.items.some((t) => has(t, 'ПРИНТ')), 'услуга в составе заказа',
    JSON.stringify(thanks.items));
  ok(has(thanks.total, '24 398'), 'итог в составе заказа', String(thanks.total));
  ok(thanks.bodyHidden === false && thanks.emptyHidden === true,
    'показан заказ, а не пустое состояние');
  ok(thanks.backLink === 'index.html', 'есть ссылка назад в каталог', String(thanks.backLink));

  // ── 3. Та же страница без заказа ────────────────────────────────────

  await evaluate(`localStorage.removeItem('cozy-pajamas:order')`);
  await open(`${BASE}/thanks-cart.html`);

  const empty = await evaluate(`(() => ({
    bodyHidden: document.querySelector('[data-thanks-body]')?.classList.contains('is-hidden'),
    emptyHidden: document.querySelector('[data-thanks-empty]')?.classList.contains('is-hidden'),
    text: document.querySelector('[data-thanks-empty]')?.textContent.replace(/\\s+/g, ' ').trim(),
  }))()`);

  ok(empty.bodyHidden === true && empty.emptyHidden === false,
    'без заказа показано пустое состояние');
  ok(has(empty.text, 'Заказа пока нет'), 'текст пустого состояния понятен',
    String(empty.text));

  ok(logs.length === 0, 'консоль чистая', JSON.stringify(logs));

  // Уборка: страница благодарности остаётся без заказа
  await evaluate(`localStorage.clear()`);

  process.stdout.write('\n');
  if (failures.length) {
    process.stdout.write(`НЕ ПРОШЛО: ${failures.length}\n`);
    failures.forEach((f) => process.stdout.write(`  FAIL ${f}\n`));
    process.exitCode = 1;
  } else {
    process.stdout.write('Всё чисто.\n');
  }
} catch (error) {
  say(`ОШИБКА: ${error.message}`);
  process.exitCode = 2;
} finally {
  try { ws?.close(); } catch { /* уже закрыт */ }
  chrome.kill('SIGKILL');
  await sleep(400);
  rmSync(profile, { recursive: true, force: true });
}
