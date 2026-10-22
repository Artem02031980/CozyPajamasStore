#!/usr/bin/env node
/**
 * Проверка: страница каталога переживает перезагрузку.
 *
 * Жалоба была такой: человек стоит на второй странице мужской коллекции,
 * страница обновляется (браузер делает это и сам — выгружает вкладку
 * из памяти и восстанавливает её) — и он оказывается в начале каталога.
 * Причина: номер страницы жил только в памяти модуля filters.js.
 *
 * Теперь страница запоминается в sessionStorage (см. readPages в storage.js),
 * и здесь проверяется весь сценарий на живой странице: встали на вторую,
 * перезагрузили, оказались там же. Плюс обратное: перешли на первую —
 * после перезагрузки первая, а не «застрявшая» вторая.
 *
 * Почему отдельный файл, а не запрос для ~/.dsh/bin/browser.mjs: нужна
 * перезагрузка страницы, а харнесс выполняет один запрос на одной загрузке.
 *
 * Запуск:
 *   node checks/req-pagination-persist.mjs [http://127.0.0.1:8000/]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8000/').replace(/\/$/, '');
const PORT = 9200 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[pages] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

const MIN_FREE_MB = 2000;
const free = Math.round(freemem() / 1024 / 1024);
say(`память: свободно ${free} МБ (порог ${MIN_FREE_MB})`);
if (free < MIN_FREE_MB) { say('мало памяти — запуск отменён'); process.exit(2); }

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-pages-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`, '--window-size=1280,900', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const retry = async (fn, times = 60, delay = 250) => {
  let last;
  for (let i = 0; i < times; i++) {
    try { return await fn(); } catch (error) { last = error; await sleep(delay); }
  }
  throw last;
};

const failures = [];
const ok = (condition, name, detail = '') => {
  if (condition) { say(`OK   ${name}`); return; }
  failures.push(`${name}${detail ? ' -> ' + detail : ''}`);
  say(`FAIL ${name}${detail ? ' -> ' + detail : ''}`);
};

let ws;

/** Снимок состояния мужской секции — тем же кодом в странице. */
const STATE_EXPR = `(() => {
  const grid = document.querySelector('.goods-men__grid');
  const pagination = document.querySelector('nav.pagination[data-section="men"]');
  const women = document.querySelector('.goods-women__grid');
  const womenPagination = document.querySelector('nav.pagination[data-section="women"]');

  return {
    men: pagination?.querySelector('.pagination__link.is-active')?.textContent.trim() ?? null,
    menCards: grid ? grid.children.length : null,
    menFirst: grid?.querySelector('.product-card__title')?.textContent.trim() ?? null,
    women: womenPagination?.querySelector('.pagination__link.is-active')?.textContent.trim() ?? null,
    womenCards: women ? women.children.length : null,
    stored: sessionStorage.getItem('cozy-pajamas:pages'),
  };
})()`;

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

  const reload = async () => {
    await send('Page.reload', { ignoreCache: true });
    await sleep(2200);
  };

  /** Нажимает кнопку страницы в секции и ждёт перерисовки. */
  const goToPage = (section, page) => evaluate(`(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const pagination = document.querySelector('nav.pagination[data-section="${section}"]');
    const button = [...pagination.querySelectorAll('[data-page]')]
      .find((b) => b.textContent.trim() === '${page}');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await frame();
    await new Promise((r) => setTimeout(r, 250));
    return true;
  })()`);

  await send('Page.enable');
  await send('Runtime.enable');

  // ── 1. Чистый старт: первая страница обеих секций ──────────────────
  await open(`${BASE}/index.html`);
  await evaluate('sessionStorage.removeItem("cozy-pajamas:pages")');
  await reload();

  const start = await evaluate(STATE_EXPR);
  ok(start.men === '1', 'мужская начинается с первой страницы', String(start.men));
  ok(start.women === '1', 'женская начинается с первой страницы', String(start.women));

  // ── 2. Встаём на вторую и перезагружаем ────────────────────────────
  await goToPage('men', 2);
  const onSecond = await evaluate(STATE_EXPR);

  ok(onSecond.men === '2', 'после нажатия — вторая страница', String(onSecond.men));
  ok(JSON.parse(onSecond.stored ?? '{}').men === 2, 'номер страницы записан в sessionStorage',
    String(onSecond.stored));

  await reload();
  const afterReload = await evaluate(STATE_EXPR);

  ok(afterReload.men === '2', 'после перезагрузки остались на второй странице',
    `страница ${afterReload.men}`);
  ok(afterReload.menFirst === onSecond.menFirst,
    'после перезагрузки те же товары', `${afterReload.menFirst} против ${onSecond.menFirst}`);
  ok(afterReload.menCards === onSecond.menCards, 'и то же их число',
    `${afterReload.menCards} против ${onSecond.menCards}`);

  // ── 3. Соседняя секция не заражена ─────────────────────────────────
  ok(afterReload.women === '1', 'женская осталась на первой странице',
    `страница ${afterReload.women}`);

  // ── 4. Переход на первую запоминается тоже ─────────────────────────
  await goToPage('men', 1);
  await reload();
  const backToFirst = await evaluate(STATE_EXPR);

  ok(backToFirst.men === '1', 'вернулись на первую — она и запомнилась',
    String(backToFirst.men));

  // ── 5. Фильтр сбрасывает на первую и запоминает это ────────────────
  await goToPage('men', 2);
  await evaluate(`(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const chip = document.querySelector('#goods-men-filters .filters__chip');
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await frame();
    await new Promise((r) => setTimeout(r, 250));
    return true;
  })()`);

  const afterFilter = await evaluate(STATE_EXPR);
  ok(afterFilter.men === '1', 'фильтр возвращает на первую страницу', String(afterFilter.men));

  await reload();
  const filterReload = await evaluate(STATE_EXPR);
  ok(filterReload.men === '1', 'после перезагрузки с фильтром — всё равно первая',
    String(filterReload.men));

  // ── 6. Мусор в хранилище не ломает каталог ─────────────────────────
  await evaluate('sessionStorage.setItem("cozy-pajamas:pages", "не json")');
  await reload();
  const junk = await evaluate(STATE_EXPR);
  ok(junk.men === '1', 'битая запись не мешает: показывается первая', String(junk.men));

  await evaluate('sessionStorage.setItem("cozy-pajamas:pages", JSON.stringify({men: 999}))');
  await reload();
  const tooFar = await evaluate(STATE_EXPR);

  /* Последняя страница считается от числа карточек на странице: при 6
     карточках 39 товаров дают 7 страниц, при 9 — 5. Ширину окна знает
     только страница, поэтому берём число карточек со второй страницы
     (на последней их меньше, и по ней perPage не угадать) */
  const perPage = Number(onSecond.menCards) || 1;
  const lastPage = Math.ceil(39 / perPage);

  ok(Number(tooFar.men) === lastPage,
    'номер за пределами страниц подрезается до последней',
    `страница ${tooFar.men}, ожидалась ${lastPage} при ${perPage} карточках`);
  ok(tooFar.menCards > 0, 'и на ней есть товары', String(tooFar.menCards));

  await evaluate('sessionStorage.removeItem("cozy-pajamas:pages")');

  const errors = logs.filter((line) => line.startsWith('error') || line.startsWith('exception'));
  ok(errors.length === 0, 'в консоли нет ошибок', errors.join('; '));

  say(`проверок пройдено: ${failures.length === 0 ? 'все' : 'см. выше'}`);
  say(`снимки: старт ${JSON.stringify(start)}`);
  say(`        после перезагрузки ${JSON.stringify(afterReload)}`);

  if (failures.length) {
    say(`НЕ ПРОШЛО: ${failures.length}`);
    failures.forEach((failure) => say('  ' + failure));
    process.exitCode = 1;
  } else {
    say('Всё чисто.');
  }
} finally {
  try { ws?.close(); } catch { /* уже закрыт */ }
  chrome.kill();
  await sleep(400);
  rmSync(profile, { recursive: true, force: true });
}
