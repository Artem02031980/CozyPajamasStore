#!/usr/bin/env node
/**
 * Обход всех страниц сайта в одном браузере: ищем дефекты, которые не видны
 * в статических проверках.
 *
 * Что собирается с каждой страницы:
 *   — ошибки консоли и необработанные исключения;
 *   — неудачные запросы (404 и обрывы) — картинки, стили, модули;
 *   — незагруженные картинки;
 *   — горизонтальная прокрутка (признак вылезшего за край блока);
 *   — доступность: img без alt, кнопки и ссылки без подписи, поля без
 *     подписи, дубли id, отсутствие h1.
 *
 * Запуск:
 *   node checks/sweep.mjs [http://127.0.0.1:8124] [фильтр-пути] [ширина]
 *
 * Ширина по умолчанию 1440. Узкие ширины (320, 375) полезны отдельно:
 * горизонтальная прокрутка обычно вылезает именно там.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8124').replace(/\/$/, '');
const FILTER = process.argv[3] ?? '';
const WIDTH = Number(process.argv[4] ?? 1440);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 9600 + Math.floor(Math.random() * 200);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[sweep] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

const MIN_FREE_MB = Number(process.env.SWEEP_MIN_FREE_MB) || 2500;
const free = Math.round(freemem() / 1024 / 1024);
say(`память: свободно ${free} МБ (порог ${MIN_FREE_MB})`);
if (free < MIN_FREE_MB) { say('мало памяти — запуск отменён'); process.exit(2); }

/** Все страницы проекта относительно корня. */
const pages = (() => {
  const found = [];
  const skip = new Set(['.git', '.gigatool', 'node_modules', 'figma', 'prompts', 'docs']);
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) found.push(relative(ROOT, full).replace(/\\/g, '/'));
    }
  };
  walk(ROOT);
  return found.filter((page) => page.includes(FILTER)).sort();
})();

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-sweep-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`, '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const problems = [];
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
  let current = { page: '', console: [], failed: [] };

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }

    /* События страницы */
    if (msg.method === 'Runtime.exceptionThrown') {
      const text = msg.params.exceptionDetails?.exception?.description
        ?? msg.params.exceptionDetails?.text ?? 'исключение';
      current.console.push(text.split('\n')[0]);
    }

    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      current.console.push(msg.params.entry.text);
    }

    if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) {
      current.failed.push(`${msg.params.errorText} (${msg.params.type})`);
    }

    if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
      const url = msg.params.response.url.split('/').pop();
      current.failed.push(`${msg.params.response.status} ${url}`);
    }
  });

  const send = (method, params = {}) => {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      setTimeout(() => { if (pending.has(msgId)) { pending.delete(msgId); reject(new Error('таймаут')); } }, 25000);
    });
  };
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) return null;
    return res.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: WIDTH < 768 ? 812 : 1000,
    deviceScaleFactor: 1,
    mobile: WIDTH < 768,
  });

  say(`страниц к обходу: ${pages.length}, ширина ${WIDTH}`);

  for (const [index, page] of pages.entries()) {
    current = { page, console: [], failed: [] };

    await send('Page.navigate', { url: `${BASE}/${page}` });
    await sleep(1200);

    const audit = await evaluate(`(() => {
      const images = [...document.images];
      /* Битые — только те, что уже пытались загрузиться и получили нулевой
         размер. У ленивых картинок ниже экрана complete ещё false, и это
         не поломка: их грузят при прокрутке (см. checks/req-prints.mjs) */
      const broken = images
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.getAttribute('src'));

      const безAlt = images.filter((img) => !img.hasAttribute('alt')).length;

      const подпись = (el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      const пустыеКнопки = [...document.querySelectorAll('button, a[href]')]
        .filter((el) => !подпись(el) && !el.querySelector('img[alt]'))
        .map((el) => el.className || el.tagName);

      const idList = [...document.querySelectorAll('[id]')].map((el) => el.id);
      const дубли = idList.filter((value, i) => idList.indexOf(value) !== i);

      const поля = [...document.querySelectorAll('input:not([type="hidden"]), textarea, select')]
        .filter((el) => {
          if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
          if (el.id && document.querySelector('label[for="' + el.id + '"]')) return false;
          return !el.closest('label');
        })
        .map((el) => el.name || el.tagName);

      return {
        заголовок: document.title,
        битыеКартинки: broken,
        безAlt,
        пустыеКнопки: [...new Set(пустыеКнопки)],
        дублиId: [...new Set(дубли)],
        поляБезПодписи: поля,
        h1: document.querySelectorAll('h1').length,
        прокруткаВбок: document.documentElement.scrollWidth > window.innerWidth,
        пусто: document.body?.innerText.trim().length === 0,
      };
    })()`);

    const лист = [];

    if (!audit) лист.push('страница не ответила на замеры');
    if (current.console.length) лист.push(`консоль: ${[...new Set(current.console)].slice(0, 3).join(' | ')}`);
    if (current.failed.length) лист.push(`запросы: ${[...new Set(current.failed)].slice(0, 3).join(' | ')}`);
    if (audit?.битыеКартинки?.length) лист.push(`картинки не загрузились: ${audit.битыеКартинки.slice(0, 3).join(', ')}`);
    if (audit?.безAlt) лист.push(`img без alt: ${audit.безAlt}`);
    if (audit?.пустыеКнопки?.length) лист.push(`кнопки без подписи: ${audit.пустыеКнопки.slice(0, 3).join(', ')}`);
    if (audit?.дублиId?.length) лист.push(`дубли id: ${audit.дублиId.join(', ')}`);
    if (audit?.поляБезПодписи?.length) лист.push(`поля без подписи: ${audit.поляБезПодписи.join(', ')}`);
    if (audit && audit.h1 !== 1) лист.push(`h1 на странице: ${audit.h1}`);
    if (audit?.прокруткаВбок) лист.push('горизонтальная прокрутка');
    if (audit?.пусто) лист.push('страница пустая');

    if (лист.length) {
      problems.push({ page, лист });
      say(`${String(index + 1).padStart(3)}/${pages.length}  ${page}  ← ${лист.length} замечаний`);
    } else if ((index + 1) % 20 === 0) {
      say(`${String(index + 1).padStart(3)}/${pages.length}  …`);
    }
  }
} catch (error) {
  say(`ошибка обхода: ${error.message}`);
  problems.push({ page: '(обход)', лист: [error.message] });
} finally {
  try { ws?.close(); } catch { /* закрыт */ }
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* профиль останется */ }
}

/* ─────────────── отчёт ─────────────── */

say('');
say(`страниц: ${pages.length}, с замечаниями: ${problems.length}`);

for (const { page, лист } of problems) {
  say(`  ${page}`);
  лист.forEach((item) => say(`      · ${item}`));
}

process.exit(problems.length ? 1 : 0);
