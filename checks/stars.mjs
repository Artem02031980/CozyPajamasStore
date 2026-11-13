#!/usr/bin/env node
/**
 * Звёзды секции обратной связи: полёт к заголовку и соцсетям.
 *
 * Проверяется то, что видно в коде: крючки в разметке, модуль stars.js
 * (обсервер, один раз за загрузку, без localStorage, уважение к
 * prefers-reduced-motion), подключение в script.js и полёт в стилях
 * (переход top/left/right и конечные места у краёв заголовка).
 *
 * Живую анимацию проверяет checks/req-stars.mjs в браузере:
 * до прокрутки звёзды в углах, после — у заголовка и соцсетей.
 *
 * Запуск: node checks/stars.mjs
 */

import { readFileSync, existsSync } from 'node:fs';

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(detail ? `${name} — ${detail}` : name);
};

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

const INDEX = read('index.html');
const STARS = read('assets/js/stars.js');
const SCRIPT = read('assets/js/script.js');
const CSS = read('assets/css/sections/feedback.css');

// ─────────────── крючки в разметке ───────────────

const section = INDEX.match(/<section class="feedback"[^>]*>/)?.[0] ?? '';
ok(section.includes('data-stars'), 'у секции обратной связи есть крючок data-stars', section);
ok(/<footer class="footer"[^>]*data-stars-trigger/.test(INDEX),
  'у подвала есть крючок data-stars-trigger: он запускает полёт');

/* Звёзд в разметке нет — это псевдоэлементы CSS, и скрипт их не создаёт */
ok(!INDEX.includes('elem_star.png'), 'картинку звезды не дублируют в разметке');

// ─────────────── модуль ───────────────

ok(exists('assets/js/stars.js'), 'модуль assets/js/stars.js на месте');
ok(/export function initStars\(/.test(STARS), 'модуль экспортирует initStars');
ok(/new IntersectionObserver/.test(STARS), 'полёт запускает IntersectionObserver');
ok(/observer\.disconnect\(\)/.test(STARS), 'после срабатывания обсервер снимается: полёт один раз');
ok(/classList\.add\(IN_VIEW\)/.test(STARS), 'модуль ставит класс состояния');
ok(/'is-stars-in'/.test(STARS), 'класс называется is-stars-in');
ok(/prefers-reduced-motion: reduce/.test(STARS),
  'при prefers-reduced-motion звёзды встают на места без полёта');
ok(/'IntersectionObserver' in window/.test(STARS),
  'без IntersectionObserver звёзды тоже встают на места');

/* Хранилище не трогаем: иначе анимация не повторялась бы после обновления */
/* В комментарии модуля про localStorage сказано — искать надо вызовы API */
ok(!/localStorage\.(get|set|remove)Item|localStorage\[/.test(STARS),
  'модуль не пишет в localStorage');

/* Подключение только на главной: секции обратной связи нет на других страницах */
ok(/import \{ initStars \} from '\.\/stars\.js'/.test(SCRIPT),
  'script.js импортирует initStars');
const home = SCRIPT.slice(SCRIPT.indexOf('function initHome'), SCRIPT.indexOf('/** Страница благодарности за заказ'));
ok(home.includes('initStars()'), 'initStars вызывается в initHome');
ok(!SCRIPT.slice(SCRIPT.indexOf('function initProductPage')).includes('initStars'),
  'на странице товара initStars не вызывается');

// ─────────────── полёт в стилях ───────────────

ok(/--stars-duration: 1\.4s/.test(CSS), 'длительность полёта задана переменной');
ok(/--stars-timing: cubic-bezier/.test(CSS), 'у полёта своя кривая: плавный выбег');
ok(/transition:\s*\r?\n?\s*top var\(--stars-duration\)/.test(CSS),
  'анимируются top/left/right через переменные полёта');

for (const [selector, координatа] of [
  ['.feedback.is-stars-in::before', 'left: calc(50% - 345px)'],
  ['.feedback.is-stars-in::after', 'right: calc(50% - 345px)'],
  ['.feedback.is-stars-in .feedback__inner::after', 'left: calc(50% - 290px)'],
]) {
  const block = CSS.slice(CSS.indexOf(`${selector} {`), CSS.indexOf('}', CSS.indexOf(`${selector} {`)));
  ok(block.includes(координatа) || block.includes(координatа.replace('left:', 'right:')),
    `${selector}: звезда встаёт к краю заголовка`, block.replace(/\s+/g, ' ').slice(0, 90));
}

ok(/\.feedback\.is-stars-in \.feedback__inner::after \{[\s\S]{0,200}?top: calc\(100% - 200px\)/.test(CSS),
  'нижняя звезда встаёт над соцсетями');
ok(/\.feedback__inner::after \{[\s\S]{0,120}?top: calc\(100% - 40px\)/.test(CSS),
  'нижняя звезда считается от верха: у auto-top перехода нет');
ok(/transition-delay: 0\.12s/.test(CSS) && /transition-delay: 0\.24s/.test(CSS),
  'звёзды летят лесенкой, а не все сразу');
ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,300}?transition: none/.test(CSS),
  'в стилях есть отключение полёта для prefers-reduced-motion');

/* Конечные места заданы в процентах от секции, а не в translate:
   в translate проценты считаются от самой звёздочки */
ok(!/\.feedback\.is-stars-in[^{]*\{[^}]*transform: translate/.test(CSS),
  'полёт не сделан через translate: проценты там считаются от звезды');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write('Полёт звёзд: 1.4s, лесенка 0/0.12/0.24s, конец — края заголовка и соцсети\n');

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
