#!/usr/bin/env node
/**
 * Сквозная проверка: оформление заказа со страницы товара.
 *
 * Зачем отдельный файл. checks/req-checkout.mjs начинает с главной: там
 * путь к странице благодарности совпадает с корнем сайта, и ошибка
 * в адресе не видна. Со страницы товара (product-pages/…) тот же путь
 * превращался в product-pages/thanks-cart.html — браузер отдавал 404,
 * и заказ «не оформлялся». Здесь проверяется именно этот случай:
 *
 *   1. открываем страницу товара, кладём товар в корзину;
 *   2. заполняем имя и телефон, нажимаем «Оформить заказ»;
 *   3. ждём перехода и смотрим, какая страница загрузилась.
 *
 * Запуск:
 *   node checks/req-checkout-product.mjs [http://127.0.0.1:8000]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const PAGE = `${BASE}/product-pages/solnechnyy-romb.html`;
const PORT = 9200 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[checkout-product] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

const MIN_FREE_MB = Number(process.env.CHECKOUT_MIN_FREE_MB) || 2000;
const free = Math.round(freemem() / 1024 / 1024);
say(`память: свободно ${free} МБ (порог ${MIN_FREE_MB})`);
if (free < MIN_FREE_MB) { say('мало памяти — запуск отменён'); process.exit(2); }

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-checkout-product-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`, '--window-size=1280,900', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const failures = [];
const ok = (condition, name, detail = '') => {
  if (condition) { passed++; say(`OK   ${name}`); return; }
  failures.push(detail ? `${name} — ${detail}` : name);
  say(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
};

let ws;
try {
  const wsUrl = await (async () => {
    for (let i = 0; i < 80; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const page = (await res.json()).find((t) => t.type === 'page');
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch { /* ещё не поднялся */ }
      await sleep(250);
    }
    throw new Error('нет вкладки');
  })();

  ws = new WS(wsUrl);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      setTimeout(() => { if (pending.has(msgId)) { pending.delete(msgId); reject(new Error('таймаут')); } }, 20000);
    });
  };
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: PAGE });
  await sleep(2500);

  const товар = await evaluate(`Boolean(document.querySelector('.product__title'))`);
  ok(товар === true, 'страница товара загрузилась', String(товар));

  /* Корзина: кладём позицию и открываем окно */
  await evaluate(`(() => {
    localStorage.setItem('cozy-pajamas:cart', JSON.stringify([{ id: 'goods-new-01', qty: 1, size: 'S', file: '' }]));
    document.dispatchEvent(new CustomEvent('cart:change'));
    document.querySelector('[data-cart-open]')?.click();
  })()`);
  await sleep(800);

  const окно = await evaluate(`(() => {
    const modal = document.querySelector('[data-modal="cart"]');
    return { открыто: !modal.classList.contains('is-hidden'), форма: Boolean(document.querySelector('[data-checkout-form]')) };
  })()`);
  ok(окно.открыто === true, 'окно корзины открылось', JSON.stringify(окно));
  ok(окно.форма === true, 'в окне есть форма оформления', JSON.stringify(окно));

  /* Заполняем обязательные поля и оформляем */
  const заполнено = await evaluate(`(() => {
    const form = document.querySelector('[data-checkout-form]');
    const name = form.querySelector('input[name="name"]');
    const phone = form.querySelector('input[name="phone"]');
    name.value = 'Иван';
    phone.value = '+7 900 123-45-67';
    document.querySelector('[data-cart-checkout]').click();
    return { имя: name.value, телефон: phone.value };
  })()`);
  ok(заполнено.имя === 'Иван', 'поле имени заполнено', заполнено.имя);

  await sleep(3000);

  const после = await evaluate(`({
    адрес: location.pathname,
    заголовок: document.title,
    приветствие: document.querySelector('h1')?.textContent.trim() ?? null,
    заказ: Boolean(localStorage.getItem('cozy-pajamas:order')),
    корзина: localStorage.getItem('cozy-pajamas:cart'),
  })`);

  ok(после.адрес === '/thanks-cart.html',
    'после оформления открылась страница благодарности, а не 404',
    `адрес ${после.адрес}`);
  ok(/Спасибо/.test(после.заголовок ?? ''), 'заголовок страницы — «Спасибо за заказ»', после.заголовок ?? '');
  ok(/Иван/.test(после.приветствие ?? ''), 'на странице приветствие с именем покупателя', после.приветствие ?? '');
  ok(после.заказ === true, 'заказ сохранён в хранилище', String(после.заказ));
  ok(после.корзина === '[]', 'корзина очищена после оформления', String(после.корзина));
} catch (error) {
  say(`ошибка сценария: ${error.message}`);
  failures.push(`сценарий: ${error.message}`);
} finally {
  say(`Итог: ${passed} проверок пройдено, ${failures.length} провалено`);
  try { ws?.close(); } catch { /* закрыт */ }
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* профиль останется */ }
}

if (failures.length) {
  failures.forEach((failure) => say(`FAIL ${failure}`));
  process.exit(1);
}
say('Всё чисто.');
