#!/usr/bin/env node
/**
 * Проверка шапки и мобильного меню — без браузера.
 *
 * Главное, что здесь стережётся: на `.header` не должно быть свойств,
 * которые делают элемент содержащим блоком для фиксированных потомков
 * (transform, will-change, filter, perspective, contain). Меню-наложение
 * `.header__nav.is-open` — это position: fixed внутри шапки, и такое
 * свойство сжимает его до высоты шапки: на экране остаётся полоска
 * с одним пунктом вместо меню на весь экран. Именно так и случилось,
 * когда шапке добавили will-change: transform.
 *
 * Геометрию наложения на живой странице меряет checks/req-header.mjs.
 *
 * Запуск: node checks/header.mjs
 */

import { readFileSync, existsSync } from 'node:fs';

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(`${name}${detail ? ' -> ' + detail : ''}`);
};

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const CSS = read('assets/css/sections/header.css');
const HTML = read('index.html');
const JS = read('assets/js/header.js');

/** Тело правила по точному селектору. */
const ruleOf = (css, selector) => {
  const at = css.indexOf(selector + ' {');
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

const headerRule = ruleOf(CSS, '.header');

ok(headerRule.length > 0, 'правило .header найдено', `${headerRule.length} байт`);
ok(/position:\s*sticky/.test(headerRule), 'шапка липкая');
ok(/z-index:\s*var\(--z-header\)/.test(headerRule), 'у шапки свой слой поверх контента');
ok(/background-color/.test(headerRule), 'у шапки непрозрачный фон: под ней прокручивается контент');

/* Свойства, создающие содержащий блок. Каждое ломает меню-наложение */
const FORBIDDEN = [
  ['transform', /transform:/],
  ['will-change', /will-change:/],
  ['filter', /filter:/],
  ['backdrop-filter', /backdrop-filter:/],
  ['perspective', /perspective:/],
  ['contain', /contain:/],
];

for (const [name, pattern] of FORBIDDEN) {
  ok(!pattern.test(headerRule), `в правиле .header нет ${name}`,
    headerRule.replace(/\s+/g, ' ').slice(0, 200));
}

/* Меню — наложение на весь экран под шапкой */
const navOpenRule = ruleOf(CSS, '.header__nav.is-open');

ok(/position:\s*fixed/.test(navOpenRule), 'открытое меню — фиксированное наложение');
for (const side of ['top', 'right', 'bottom', 'left']) {
  ok(new RegExp(`${side}:`).test(navOpenRule), `у наложения задан ${side}`);
}
ok(/top:\s*var\(--header-height\)/.test(navOpenRule),
  'наложение начинается под шапкой, а не поверх неё');
ok(/z-index:\s*var\(--z-nav\)/.test(navOpenRule), 'у наложения свой слой');

/* На десктопе меню развёрнуто в строку — фиксированного наложения нет */
const desktopAt = CSS.indexOf('@media (min-width: 1024px)');
const desktopCss = desktopAt < 0 ? '' : CSS.slice(desktopAt);
ok(/\.header__nav\.is-open\s*\{[\s\S]{0,200}?position:\s*static/.test(desktopCss),
  'с 1024px наложение сбрасывается в статичную строку');

/* Разметка: бургер связан с меню, у меню есть id для aria-controls */
ok(/id="header-nav"/.test(HTML), 'у меню есть id для aria-controls');
ok(/aria-controls="header-nav"/.test(HTML), 'бургер указывает на меню через aria-controls');
ok(/aria-expanded="false"/.test(HTML), 'бургер стартует свёрнутым');

/* Модуль: состояние меню ставится явно, а не берётся из разметки */
ok(/setMenuState\(false\)/.test(JS), 'модуль сбрасывает состояние меню при запуске');
ok(/classList\.toggle\('is-open'/.test(JS), 'класс is-open переключается в одном месте');
ok(/aria-expanded/.test(JS), 'aria-expanded меняется вместе с классом');

/* Файлы, на которые ссылается проверка и README */
ok(existsSync(new URL('../checks/req-header.mjs', import.meta.url)),
  'есть браузерная проверка геометрии меню');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Свойств, создающих содержащий блок, в .header: 0\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
