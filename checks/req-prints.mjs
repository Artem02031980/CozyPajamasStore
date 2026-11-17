#!/usr/bin/env node
/**
 * Живая проверка страницы каталога принтов в браузере.
 *
 * Что проверяется:
 *   карточек 17, в каждой два изображения — и оба реально загрузились;
 *   у каждого принта в описании назван автор, а цена на карточке — 500 ₽;
 *   на странице видна стоимость и правила нанесения;
 *   «В корзину» кладёт принт в корзину: позиция с ценой 500 ₽, с квадратной
 *   картинкой и подписью «Принт 01. …»;
 *   второй клик по той же кнопке увеличивает количество, а не плодит строку;
 *   в консоли нет ошибок, страница не прокручивается вбок.
 *
 * Почему отдельный файл, а не запрос для ~/.dsh/bin/browser.mjs: нужен
 * клик по кнопке, ожидание отрисовки корзины и прокрутка, чтобы догрузились
 * картинки с loading="lazy".
 *
 * Запуск:
 *   node checks/req-prints.mjs [http://127.0.0.1:8000]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const PORT = 9200 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[prints] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

const free = Math.round(freemem() / 1024 / 1024);
if (free < 2000) { say(`мало памяти — ${free} МБ, запуск отменён`); process.exit(2); }

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(`${name}${detail ? ' -> ' + detail : ''}`);
};

const eq = (actual, expected, name) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(a === e, name, `получено ${a}, ожидалось ${e}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-prints-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`, '--window-size=1280,900', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws;
let id = 0;
const pending = new Map();
const logs = [];

const retry = async (fn, times = 80, delay = 250) => {
  let last;
  for (let i = 0; i < times; i++) {
    try { return await fn(); } catch (error) { last = error; await sleep(delay); }
  }
  throw last;
};

const send = (method, params = {}) => {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    setTimeout(() => {
      if (pending.has(msgId)) { pending.delete(msgId); reject(new Error('таймаут')); }
    }, 25000);
  });
};

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'исключение');
  return res.result.value;
};

try {
  const wsUrl = await retry(async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const page = (await res.json()).find((target) => target.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('нет вкладки');
    return page.webSocketDebuggerUrl;
  });

  ws = new WS(wsUrl);
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? ''}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      logs.push(`console: ${msg.params.args.map((arg) => arg.value ?? arg.description).join(' ')}`);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });

  await send('Page.navigate', { url: `${BASE}/prints.html` });
  await sleep(2500);

  /* Прокручиваем страницу целиком: картинки с loading="lazy" грузятся
     только когда попадают в окно. После прокрутки ждём, пока все 34 файла
     догрузятся, — но не дольше десяти секунд */
  await evaluate(`
    const total = document.documentElement.scrollHeight;
    for (let y = 0; y <= total; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);

    const images = [...document.querySelectorAll('.prints__image')];
    const started = Date.now();
    while (Date.now() - started < 10000) {
      if (images.every((img) => img.complete && img.naturalWidth > 0)) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 300));
  `);

  const page = await evaluate(`
    const cards = [...document.querySelectorAll('.prints__card')];
    const images = [...document.querySelectorAll('.prints__image')];
    return {
      карточек: cards.length,
      картинок: images.length,
      загружено: images.filter((img) => img.complete && img.naturalWidth > 0).length,
      /* Сравниваем простой строкой с пробелом: код уходит в страницу
         шаблонной строкой, и «\s» в ней теряет обратную косую черту —
         регулярное выражение приезжало в браузер сломанным */
      безАвтора: cards.filter((card) => !(card.querySelector('.prints__text')?.textContent ?? '')
        .replace(/\u00A0/g, ' ')
        .includes('Артём Мижорниев')).length,
      цены: [...new Set(cards.map((card) => card.querySelector('.prints__price')?.textContent.replace(/\u00A0/g, ' ').trim()))],
      снизуПодписи: [...new Set(cards.slice(0, 3).flatMap(
        (card) => [...card.querySelectorAll('.prints__preview-note')].map((n) => n.textContent.trim()),
      ))],
      вШапке: {
        заголовок: document.querySelector('.prints__title')?.textContent.trim() ?? null,
        цена: document.querySelector('.prints__cost')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
        лид: document.querySelector('.prints__lead')?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
      },
      правила: [...document.querySelectorAll('.prints__note-title')].map((n) => n.textContent.trim()),
      кнопкаМакета: (() => {
        const button = document.querySelector('.prints__upload-button');
        if (!button) return null;
        const style = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        return {
          ширина: Math.round(box.width),
          высота: Math.round(box.height),
          радиус: style.borderRadius,
          кегль: style.fontSize,
          рамка: style.borderTopColor,
          текст: button.textContent.trim(),
        };
      })(),
      кнопка: (() => {
        const button = document.querySelector('.prints__button');
        if (!button) return null;
        const style = getComputedStyle(button);
        const box = button.getBoundingClientRect();
        const icon = button.querySelector('.prints__button-icon');
        return {
          ширина: Math.round(box.width),
          высота: Math.round(box.height),
          радиус: style.borderRadius,
          кегль: style.fontSize,
          иконка: icon
            ? getComputedStyle(icon).backgroundImage.split('/').pop().replace(/["')]/g, '')
            : null,
          порядок: [...button.children].map((child) => child.className).join(' → '),
          текст: button.textContent.trim(),
        };
      })(),
      прокруткаВбок: document.documentElement.scrollWidth > innerWidth,
    };
  `);

  eq(page.карточек, 17, 'на странице 17 карточек');
  eq(page.картинок, 34, 'на странице 34 изображения — по два на принт');
  eq(page.загружено, 34, 'все изображения загрузились');
  eq(page.безАвтора, 0, 'в каждом описании назван автор');
  eq(page.цены, ['500 ₽'], 'цена во всех карточках — 500 ₽');
  eq(page.снизуПодписи, ['На светлом', 'На тёмном'], 'под превью подписано, какое состояние показано');
  eq(page.вШапке.заголовок, 'КАТАЛОГ ПРИНТОВ', 'заголовок страницы');
  ok(/500 ₽/.test(page.вШапке.цена ?? ''), 'в шапке видна цена 500 ₽', String(page.вШапке.цена));
  ok(/Артём[\s\u00A0]+Мижорниев/.test(page.вШапке.лид ?? ''), 'во вступлении назван автор', String(page.вШапке.лид));
  eq(page.правила, ['Чёрное на светлом', 'Белое на тёмном', 'Без цветности'],
    'на странице три правила нанесения');
  ok(!page.прокруткаВбок, 'страница не прокручивается вбок');

  /* Кнопка «В корзину»: компактная, со скруглением карточных кнопок
     и белой иконкой корзины перед подписью */
  ok(Boolean(page.кнопка), 'в карточке есть кнопка «В корзину»');
  eq(page.кнопка?.радиус, '4px', 'скругление кнопки — 4px, как у кнопок в карточках каталога');
  eq(page.кнопка?.кегль, '14px', 'кегль кнопки — как у кнопок в карточках каталога');
  ok((page.кнопка?.ширина ?? 999) < 200, 'ширина кнопки по содержимому, а не на всю карточку',
    String(page.кнопка?.ширина));
  ok((page.кнопка?.высота ?? 99) <= 40, 'кнопка компактная по высоте', String(page.кнопка?.высота));
  eq(page.кнопка?.иконка, 'cart-white.svg', 'перед подписью белая иконка корзины');
  eq(page.кнопка?.порядок, 'prints__button-icon → prints__button-label',
    'иконка стоит до подписи');
  eq(page.кнопка?.текст, 'В корзину', 'подпись кнопки');

  /* Кнопка «Добавить свой макет» — как её близнец на странице товара */
  eq(page.кнопкаМакета?.текст, 'Добавить свой макет', 'кнопка своего макета на месте');
  eq(page.кнопкаМакета?.радиус, '8px', 'скругление кнопки своего макета — 8px');
  eq(page.кнопкаМакета?.кегль, '14px', 'кегль кнопки своего макета — 14px');
  eq(page.кнопкаМакета?.высота, 48, 'высота кнопки своего макета — 48px');
  eq(page.кнопкаМакета?.рамка, 'rgb(205, 116, 162)', 'рамка розовая, как на странице товара');

  /* Корзина: добавление, повтор, состав и сумма.
     Сначала один клик и корзина — проверяем цену одной позиции, потом
     второй клик — количество и счётчик. Иначе цена и итог считались бы
     уже за две штуки */
  const cart = await evaluate(`
    localStorage.removeItem('cozy-pajamas:cart');
    document.dispatchEvent(new CustomEvent('cart:change'));
    await new Promise((r) => requestAnimationFrame(r));

    const button = document.querySelector('.prints__card [data-cart-add]');
    const id = button.dataset.cartAdd;
    button.click();
    await new Promise((r) => setTimeout(r, 250));

    const afterFirst = JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]');

    document.querySelector('[data-cart-open]').click();
    await new Promise((r) => setTimeout(r, 300));

    const line = document.querySelector('[data-cart-line]');
    const total = document.querySelector('.cart__total-value, [data-cart-total]');

    const result = {
      id,
      послеПервого: afterFirst,
      строка: line ? {
        title: line.querySelector('.cart__title')?.textContent.trim() ?? null,
        meta: line.querySelector('.cart__meta')?.textContent.trim() ?? null,
        price: line.querySelector('.cart__price')?.textContent.replace(/\\u00A0/g, ' ').trim() ?? null,
        imageClass: line.querySelector('.cart__image')?.className ?? null,
      } : null,
      итог: total ? total.textContent.replace(/\\u00A0/g, ' ').trim() : null,
    };

    /* Закрываем окно и жмём второй раз — количество должно вырасти */
    document.querySelector('[data-modal="cart"] [data-modal-close]')?.click();
    await new Promise((r) => setTimeout(r, 250));
    button.click();
    await new Promise((r) => setTimeout(r, 250));

    result.послеВторого = JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]');
    result.счётчик = document.querySelector('[data-cart-counter]')?.textContent.trim() ?? null;

    localStorage.removeItem('cozy-pajamas:cart');
    document.dispatchEvent(new CustomEvent('cart:change'));
    return result;
  `);

  eq(cart.id, 'print-01', 'кнопка первой карточки добавляет print-01');
  eq(cart.послеПервого, [{ id: 'print-01', qty: 1, size: '', file: '' }], 'принт лёг в корзину');
  eq(cart.строка?.title, 'Принт 01. Good Morning!', 'в корзине название принта с номером');
  eq(cart.строка?.meta, 'Принт для нанесения', 'у позиции есть пояснение');
  eq(cart.строка?.price, '500 ₽', 'цена позиции — 500 ₽');
  ok(/cart__image--print/.test(cart.строка?.imageClass ?? ''), 'у принта квадратная картинка',
    String(cart.строка?.imageClass));
  eq(cart.итог, '500 ₽', 'итог корзины — 500 ₽ за один принт');
  eq(cart.послеВторого, [{ id: 'print-01', qty: 2, size: '', file: '' }],
    'второй клик увеличивает количество, а не плодит строку');
  eq(cart.счётчик, '2', 'счётчик в шапке показывает две единицы');

  ok(logs.length === 0, 'консоль чистая', JSON.stringify(logs));

  await evaluate('localStorage.clear()');

  process.stdout.write('\n');
  process.stdout.write(`Проверок пройдено: ${passed}\n`);
  process.stdout.write('Страница: prints.html, 17 карточек, цена 500 ₽, корзина работает\n');

  if (failures.length) {
    process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
    failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
    process.exitCode = 1;
  } else {
    process.stdout.write('\nВсё чисто.\n');
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





