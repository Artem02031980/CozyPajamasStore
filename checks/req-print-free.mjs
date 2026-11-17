#!/usr/bin/env node
/**
 * Сквозная проверка: печать бесплатна, когда товаров набралось на порог.
 *
 * Принт из каталога — это нанесение, а не товар: он не входит в сумму
 * товаров (иначе сам приближал бы порог) и обнуляется, когда товаров
 * на 15 000 ₽. Проверяется весь путь: корзина → оформление → страница
 * благодарности.
 *
 * Запуск:
 *   node checks/req-print-free.mjs [http://127.0.0.1:8000]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const PORT = 9200 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[print-free] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

const MIN_FREE_MB = Number(process.env.CHECKOUT_MIN_FREE_MB) || 2000;
const free = Math.round(freemem() / 1024 / 1024);
say(`память: свободно ${free} МБ (порог ${MIN_FREE_MB})`);
if (free < MIN_FREE_MB) { say('мало памяти — запуск отменён'); process.exit(2); }

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-print-free-'));
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
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(2500);

  /** Ставит корзину и отдаёт то, что видно в окне. */
  const корзинаИз = async (lines) => {
    await evaluate(`(() => {
      localStorage.setItem('cozy-pajamas:cart', JSON.stringify(${JSON.stringify(lines)}));
      document.dispatchEvent(new CustomEvent('cart:change'));
    })()`);
    await sleep(500);

    return evaluate(`(() => {
      /* formatPrice ставит неразрывные пробелы — приводим их к обычным,
         иначе сравнение с «8 500 ₽» не сойдётся */
      const чисто = (value) => String(value ?? '')
        .replace(/\\u00A0/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
      const текст = (sel) => чисто(document.querySelector(sel)?.textContent);
      return {
        ценыПозиций: [...document.querySelectorAll('.cart__item .cart__price')]
          .map((el) => чисто(el.textContent)),
        подписи: [...document.querySelectorAll('.cart__item .cart__note')]
          .map((el) => el.textContent.replace(/\\s+/g, ' ').trim()),
        строкиИтогов: [...document.querySelectorAll('.cart__summary .cart__row')]
          .map((el) => el.textContent.replace(/\\s+/g, ' ').trim()),
        подсказка: текст('[data-cart-print-note]'),
        итого: текст('[data-cart-total]'),
      };
    })()`);
  };

  await evaluate(`document.querySelector('[data-cart-open]')?.click()`);
  await sleep(600);

  /* 1. Товаров меньше порога: принт платный */
  const ниже = await корзинаИз([
    { id: 'print-01', qty: 1, size: '', file: '' },
    { id: 'goods-men-04', qty: 1, size: 'XXL', file: '' },
  ]);
  ok(ниже.ценыПозиций?.[0] === '500 ₽', 'ниже порога принт стоит 500 ₽', String(ниже.ценыПозиций?.[0]));
  ok(ниже.итого === '9 499 ₽', 'итог ниже порога: товар и принт', String(ниже.итого));

  /* 2. Восемнадцать принтов и товаров на 23 597 ₽: бесплатен только один */
  const много = await корзинаИз([
    { id: 'print-03', qty: 18, size: '', file: '' },
    { id: 'goods-men-04', qty: 1, size: 'XXL', file: '' },
    { id: 'goods-men-07', qty: 2, size: 'XXL', file: '' },
  ]);
  ok(много.ценыПозиций?.[0] === '8 500 ₽',
    'из 18 принтов платят за 17 — 8 500 ₽', String(много.ценыПозиций?.[0]));
  ok(/Бесплатно 1 из 18/.test(много.подписи?.[0] ?? ''),
    'в позиции подписано, что бесплатен один', String(много.подписи?.[0]));
  ok(много.строкиИтогов?.some((row) => /Товары 23 597/.test(row)),
    'в сумме товаров нет цены принтов', JSON.stringify(много.строкиИтогов));
  ok(много.строкиИтогов?.some((row) => /Печать «ПРИНТ» × 18\s*8 500/.test(row)),
    'печать отдельной строкой и по платным единицам', JSON.stringify(много.строкиИтогов));
  ok(/Бесплатных принтов: 1 из 18/.test(много.подсказка ?? ''),
    'подсказка объясняет, сколько принтов бесплатно', String(много.подсказка));
  ok(много.итого === '32 097 ₽', 'итог: товары и 17 платных принтов', String(много.итого));

  /* 3. Товаров на 16 298 ₽ и один принт: печать бесплатна целиком */
  const корзина = await корзинаИз([
    { id: 'print-01', qty: 1, size: '', file: '' },
    { id: 'goods-men-04', qty: 1, size: 'XXL', file: '' },
    { id: 'goods-men-07', qty: 1, size: 'XXL', file: '' },
  ]);

  ok(корзина.ценыПозиций?.[0] === 'бесплатно',
    'в позиции принта стоит «бесплатно»', String(корзина.ценыПозиций?.[0]));
  ok(корзина.строкиИтогов?.some((row) => row.includes('Товары 16 298')),
    'в сумме товаров нет цены принта', JSON.stringify(корзина.строкиИтогов));
  ok(корзина.строкиИтогов?.some((row) => /Печать «ПРИНТ»\s*бесплатно/.test(row)),
    'печать отдельной строкой и бесплатна', JSON.stringify(корзина.строкиИтогов));
  ok(корзина.итого === '16 298 ₽', 'итог равен сумме товаров', String(корзина.итого));

  /* Оформляем заказ и смотрим страницу благодарности */
  await evaluate(`(() => {
    const form = document.querySelector('[data-checkout-form]');
    form.querySelector('input[name="name"]').value = 'Иван';
    form.querySelector('input[name="phone"]').value = '+7 900 123-45-67';
    document.querySelector('[data-cart-checkout]').click();
  })()`);
  await sleep(3000);

  const заказ = await evaluate(`(() => {
    const order = JSON.parse(localStorage.getItem('cozy-pajamas:order') ?? 'null');
    return {
      адрес: location.pathname,
      позиции: [...document.querySelectorAll('.cart__list--order .cart__item')]
        .map((li) => li.textContent.replace(/\\s+/g, ' ').trim()),
      итого: document.querySelector('.cart__total')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
      товары: order?.totals?.products ?? null,
      печать: order?.totals?.prints ?? null,
      печатьБесплатна: order?.totals?.printsFree ?? null,
      суммаПринта: order?.items?.find((item) => item.id === 'print-01')?.sum ?? null,
    };
  })()`);

  ok(заказ.адрес === '/thanks-cart.html', 'открылась страница благодарности', String(заказ.адрес));
  ok(/Принт 01[^×]*× 1\s*бесплатно/.test(заказ.позиции?.[0] ?? ''),
    'в составе заказа печать бесплатна', String(заказ.позиции?.[0]));
  ok(заказ.товары === 16298, 'в заказе сумма товаров без принта', String(заказ.товары));
  ok(заказ.печать === 0 && заказ.печатьБесплатна === true,
    'в итогах заказа печать обнулена', `${заказ.печать} / ${заказ.печатьБесплатна}`);
  ok(заказ.суммаПринта === 0, 'снимок позиции принта — ноль', String(заказ.суммаПринта));
  ok(заказ.итого === 'Итого 16 298 ₽', 'итог заказа без 500 ₽ за печать', String(заказ.итого));
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
