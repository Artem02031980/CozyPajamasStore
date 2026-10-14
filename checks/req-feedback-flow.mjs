#!/usr/bin/env node
/**
 * Сквозная проверка формы вопроса в браузере: отправка, возврат назад
 * и оформление кнопок возврата.
 *
 * Почему отдельный файл, а не запрос для ~/.dsh/bin/browser.mjs: нужны
 * переходы между страницами и history.back(), а харнесс выполняет один
 * запрос на одной странице и теряет контекст при переходе.
 *
 * Что проверяется:
 *   1. полный вопрос уводит на thanks-feedback.html и он там показан;
 *   2. после возврата назад поле вопроса пустое — браузер не должен
 *      воскрешать прошлый текст;
 *   3. кнопка «Вернуться к форме» выглядит как «Вернуться к покупкам»
 *      в пустой корзине: тот же радиус, цвета и цвета при наведении.
 *
 * Запуск:
 *   node checks/req-feedback-flow.mjs [http://127.0.0.1:8124/]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8124/').replace(/\/$/, '');
const PORT = 9500 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[feedback] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

const MIN_FREE_MB = Number(process.env.FEEDBACK_MIN_FREE_MB) || 2000;
const free = Math.round(freemem() / 1024 / 1024);
say(`память: свободно ${free} МБ (порог ${MIN_FREE_MB})`);
if (free < MIN_FREE_MB) { say('мало памяти — запуск отменён'); process.exit(2); }

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-feedback-'));
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

const plain = (value) => String(value ?? '').replace(/[\u00A0\u202F\s]+/g, ' ').trim();

/* Ключ, по которому сравниваются кнопки: цвет, фон, рамка, радиус, паддинг
   и кегль. Ширина не входит — у кнопок разный текст. */
const look = (button) => ({
  color: button.color,
  background: button.background,
  border: button.border,
  radius: button.radius,
  padding: button.padding,
  font: button.font,
});

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
      /* Предупреждение о битом JSON — часть проверки хранилища, не ошибка */
      const text = msg.params.args.map((a) => a.value ?? a.description).join(' ');
      if (!text.includes('Битый JSON')) logs.push(`${msg.params.type}: ${text}`);
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
    await sleep(2200);
  };

  /* Кадр: расчёты в page-context после перехода. Отдельный вызов нужен
     потому, что контекст прежней страницы после перехода мёртв. */
  const frame = async (body) => evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    ${body}
  })()`);

  await send('Page.enable');
  await send('Runtime.enable');

  // ── 1. Находим ключ кнопки и запоминаем, как выглядит образец ────────

  await open(`${BASE}/index.html`);
  await evaluate('localStorage.clear()');

  const ref = await frame(`
    const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.querySelector('[data-cart-open]').click();
    await sleep(500);
    const button = document.querySelector('.cart__continue');
    if (!button) return null;
    const cs = getComputedStyle(button);
    return {
      text: button.textContent.trim(),
      color: cs.color,
      background: cs.backgroundColor,
      border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      radius: cs.borderRadius,
      padding: cs.padding,
      font: cs.fontSize + ' / ' + cs.fontFamily.split(',')[0],
    };
  `);

  ok(Boolean(ref), 'образец найден: «Вернуться к покупкам» в пустой корзине');
  ok(plain(ref?.text) === 'Вернуться к покупкам', 'образец — нужная кнопка', String(ref?.text));

  await frame(`
    document.querySelector('[data-modal-close]')?.click();
    await sleep(200);
    return true;
  `);

  // ── 2. Отправка полного вопроса ─────────────────────────────────────

  const QUESTION = 'Подскажите, есть ли пижама ростом 170 см?';

  const sent = await evaluate(`(() => {
    const field = document.querySelector('[data-feedback-field]');
    field.value = ${JSON.stringify(QUESTION)};
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return field.value;
  })()`);
  ok(sent === QUESTION, 'поле заполнено перед отправкой', String(sent));

  // Отправляем и не ждём ответа: страница уйдёт, контекст умрёт
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.feedback__submit').click()`,
  }).catch(() => {});
  await sleep(2200);

  const thanks = await frame(`
    const box = (s) => document.querySelector(s);
    const cs = box('.thanks__back') ? getComputedStyle(box('.thanks__back')) : null;
    return {
      path: location.pathname,
      page: document.body.dataset.page,
      greeting: box('.thanks__title')?.textContent.trim(),
      question: box('[data-thanks-question]')?.textContent ?? null,
      date: box('[data-thanks-date]')?.textContent ?? null,
      bodyHidden: box('[data-thanks-body]')?.classList.contains('is-hidden'),
      emptyHidden: box('[data-thanks-empty]')?.classList.contains('is-hidden'),
      backText: box('.thanks__back')?.textContent.trim(),
      backHref: box('.thanks__back')?.getAttribute('href'),
      back: cs ? {
        color: cs.color,
        background: cs.backgroundColor,
        border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        radius: cs.borderRadius,
        padding: cs.padding,
        font: cs.fontSize + ' / ' + cs.fontFamily.split(',')[0],
      } : null,
      stored: localStorage.getItem('cozy-pajamas:message'),
    };
  `);

  ok(thanks.path === '/thanks-feedback.html', 'после отправки открылась страница благодарности',
    String(thanks.path));
  ok(thanks.page === 'thanks-feedback', 'страница опознана как thanks-feedback', String(thanks.page));
  ok(thanks.bodyHidden === false && thanks.emptyHidden === true,
    'показан вопрос, а не пустое состояние');
  ok(thanks.question === QUESTION, 'на странице показан отправленный вопрос', String(thanks.question));
  ok(/^Отправлено /.test(plain(thanks.date)), 'показана дата отправки', String(thanks.date));
  ok(plain(thanks.backText) === 'Вернуться к форме', 'кнопка возврата подписана', String(thanks.backText));
  ok(thanks.backHref === 'index.html#feedback', 'кнопка ведёт к форме', String(thanks.backHref));
  ok(JSON.stringify(look(thanks.back ?? {})) === JSON.stringify(look(ref)),
    'кнопка «Вернуться к форме» выглядит как «Вернуться к покупкам»',
    JSON.stringify(thanks.back) + ' против ' + JSON.stringify(ref));

  // ── 3. Наведение на кнопку возврата ─────────────────────────────────

  const hover = await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: 0, y: 0, button: 'none', buttons: 0,
  }).then(async () => {
    const box = await evaluate(`(() => {
      const b = document.querySelector('.thanks__back').getBoundingClientRect();
      return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, button: 'none', buttons: 0 });
    await sleep(600);
    return evaluate(`(() => {
      const el = document.querySelector('.thanks__back');
      const cs = getComputedStyle(el);
      return { hovered: el.matches(':hover'), color: cs.color, border: cs.borderTopColor };
    })()`);
  });

  ok(hover.hovered === true, 'курсор наведён на кнопку возврата', JSON.stringify(hover));
  ok(hover.color === hover.border, 'при наведении текст и рамка одного цвета',
    JSON.stringify(hover));
  ok(hover.color !== ref.color, 'при наведении цвет меняется, а не остаётся розовым',
    JSON.stringify(hover));
  ok(hover.color === 'rgb(147, 179, 214)', 'при наведении цвет синий --color-blue',
    String(hover.color));

  // ── 4. Возврат назад: поле вопроса пустое ───────────────────────────

  const restored = await frame(`
    const marker = { persisted: null };
    window.addEventListener('pageshow', (event) => { marker.persisted = event.persisted; }, { once: true });
    window.__marker = marker;
    return true;
  `);
  void restored;

  const backResult = await send('Page.getNavigationHistory')
    .then((list) => list.entries[list.currentIndex - 1])
    .then((entry) => send('Page.navigateToHistoryEntry', { entryId: entry.id }))
    .then(() => sleep(2500))
    .then(() => frame(`
      const field = document.querySelector('[data-feedback-field]');
      const error = document.querySelector('[data-feedback-error]');
      const cs = field ? getComputedStyle(field) : null;
      return {
        path: location.pathname,
        value: field?.value ?? null,
        length: field?.value.length ?? null,
        errorHidden: error?.classList.contains('is-hidden') ?? null,
        errorText: error?.textContent.trim() ?? null,
        className: field?.className ?? null,
        ariaInvalid: field?.getAttribute('aria-invalid') ?? null,
        hintVisible: cs ? cs.opacity !== '0' : null,
        placeholder: field?.getAttribute('placeholder') ?? null,
      };
    `));

  ok(backResult.path === '/index.html', 'возврат привёл на главную', String(backResult.path));
  ok(backResult.value === '', 'после возврата поле вопроса пустое', JSON.stringify(backResult.value));
  ok(backResult.errorHidden === true, 'подпись об ошибке не показана', JSON.stringify(backResult));
  ok(backResult.className === 'feedback__input', 'поле без признака ошибки', String(backResult.className));
  ok(backResult.ariaInvalid === 'false', 'aria-invalid снят', String(backResult.ariaInvalid));
  ok(plain(backResult.placeholder) === 'Задайте вопрос', 'подсказка в поле на месте',
    String(backResult.placeholder));

  ok(logs.length === 0, 'консоль чистая', JSON.stringify(logs));

  await evaluate('localStorage.clear()');

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
