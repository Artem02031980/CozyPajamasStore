/**
 * Сквозная проверка ссылки «Перейти к содержимому» с настоящей клавиатуры.
 *
 * Программный .focus() не включает :focus-visible — поэтому проверяем
 * так, как это делает человек с клавиатуры: жмём Tab и смотрим, где фокус
 * и какие у ссылки размеры. Затем Enter: фокус должен уйти в содержимое.
 *
 * Запуск: node checks/req-skip-link.mjs [http://127.0.0.1:8124]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, freemem } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const PORT = 9200 + Math.floor(Math.random() * 300);
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WS_PATH = 'C:/Users/Artem/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/ws/index.js';

const say = (msg) => process.stderr.write(`[skip-link] ${msg}\n`);

if (!existsSync(CHROME)) { say(`нет Chrome: ${CHROME}`); process.exit(2); }
if (!existsSync(WS_PATH)) { say(`нет ws: ${WS_PATH}`); process.exit(2); }

const MIN_FREE_MB = Number(process.env.CHECKOUT_MIN_FREE_MB) || 2000;
const free = Math.round(freemem() / 1024 / 1024);
say(`память: свободно ${free} МБ (порог ${MIN_FREE_MB})`);
if (free < MIN_FREE_MB) { say('мало памяти — запуск отменён'); process.exit(2); }

const wsModule = await import(`file:///${WS_PATH}`);
const WS = wsModule.WebSocket ?? wsModule.default;

const profile = mkdtempSync(join(tmpdir(), 'dsh-skip-'));
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
  const pressKey = async (key, code, keyCode) => {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode });
    await send('Input.dispatchKeyEvent', { type: 'char', text: key === 'Enter' ? '\r' : '', key, code });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(2200);

  const до = await evaluate(`(() => ({
    адрес: location.href,
    активный: document.activeElement?.tagName ?? null,
  }))()`);

  /* Первый Tab: фокус должен попасть на ссылку пропуска */
  await pressKey('Tab', 'Tab', 9);
  await sleep(400);

  const послеТаба = await evaluate(`(() => {
    const el = document.activeElement;
    const r = el?.getBoundingClientRect();
    const style = el ? getComputedStyle(el) : null;
    return {
      тег: el?.tagName ?? null,
      текст: el?.textContent?.trim().slice(0, 40) ?? null,
      классы: el?.className ?? null,
      ширина: r ? Math.round(r.width) : 0,
      высота: r ? Math.round(r.height) : 0,
      позиция: style?.position ?? null,
      фон: style?.backgroundColor ?? null,
    };
  })()`);

  ok(до.адрес.endsWith('/'), 'страница открылась', до.адрес);
  ok(послеТаба.тег === 'A', 'первый Tab ставит фокус на ссылку', послеТаба.тег ?? '');
  ok((послеТаба.текст ?? '').includes('Перейти к содержимому'), 'это ссылка пропуска',
    послеТаба.текст ?? '');
  ok(послеТаба.ширина > 100 && послеТаба.высота > 20,
    'при фокусе ссылка видна (не 1×1)', `${послеТаба.ширина}×${послеТаба.высота}`);
  ok(послеТаба.позиция === 'fixed', 'она вынесена поверх страницы', послеТаба.позиция ?? '');

  /* Enter: переход к содержимому */
  await pressKey('Enter', 'Enter', 13);
  await sleep(600);

  const послеEnter = await evaluate(`(() => ({
    хеш: location.hash,
    mainВФокусе: document.activeElement?.id === 'main',
    прокрутка: Math.round(window.scrollY),
  }))()`);

  ok(послеEnter.хеш === '#main', 'Enter ведёт к якорю содержимого', послеEnter.хеш ?? '');
  ok(послеEnter.mainВФокусе === true, 'фокус уходит в содержимое, а не остаётся в шапке',
    String(послеEnter.mainВФокусе));
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
