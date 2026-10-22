#!/usr/bin/env node
/**
 * Проверка секции принтов и страницы каталога принтов — без браузера.
 *
 * Кнопка «Добавить услугу в корзину» стала ссылкой «Посмотреть каталог
 * принтов» на prints.html: решение об услуге человек принимает в каталоге,
 * а не в секции на главной. Услуга при этом не исчезла — правила её подсчёта
 * остались в cart.js, а цена и порог по-прежнему лежат в разметке
 * (data-print-price, data-print-free-from) и читаются корзиной.
 *
 * Геометрию и клики на живой странице проверяет checks/req-cart.mjs.
 *
 * Запуск: node checks/prints.mjs
 */

import { readFileSync, existsSync } from 'node:fs';

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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const INDEX = read('index.html');
const PRINTS = existsSync(new URL('../prints.html', import.meta.url)) ? read('prints.html') : '';
const SCRIPT = read('assets/js/script.js');
const CART_UI = read('assets/js/cart-ui.js');
const CHECKOUT = read('assets/js/checkout.js');
const STYLE = read('assets/css/style.css');

// ─────────────── ссылка в секции принтов ───────────────

const section = (() => {
  const at = INDEX.indexOf('<section class="goods-print"');
  return at < 0 ? '' : INDEX.slice(at, INDEX.indexOf('</section>', at));
})();

ok(section.length > 0, 'секция принтов найдена в разметке');

const linkMatch = section.match(/<a[^>]*class="goods-print__button[^"]*"[\s\S]{0,400}?<\/a>/);
ok(Boolean(linkMatch), 'в секции принтов стоит ссылка, а не кнопка', String(linkMatch?.[0]?.slice(0, 120)));

const link = linkMatch?.[0] ?? '';
ok(/href="prints\.html"/.test(link), 'ссылка ведёт на страницу каталога принтов', link);
ok(/Посмотреть каталог принтов/.test(link), 'подпись — «Посмотреть каталог принтов»');
ok(!/Добавить услугу в корзину/.test(section),
  'старого текста кнопки в секции не осталось');
ok(!/data-cart-add/.test(section),
  'у ссылки нет признака добавления в корзину — она не добавляет услугу');
ok(/class="[^"]*\bbutton\b/.test(link), 'ссылке оставлен класс button: вид не меняется');

/* Условия услуги остаются в разметке: их читает корзина */
eq(link.match(/data-print-price="([^"]+)"/)?.[1], '500', 'цена принта в разметке');
eq(link.match(/data-print-free-from="([^"]+)"/)?.[1], '15000', 'порог бесплатного принта в разметке');

/* Ни одной кнопки добавления услуги на главной не осталось */
ok(!/data-cart-add="print"/.test(INDEX), 'на главной нет кнопки, добавляющей услугу');

// ─────────────── модули читают условия ───────────────

ok(CART_UI.includes("$('[data-print-price]')"),
  'cart-ui.js берёт условия по data-print-price', 'селектор не найден');
ok(CHECKOUT.includes("$('[data-print-price]')"),
  'checkout.js берёт условия по data-print-price', 'селектор не найден');
ok(!CART_UI.includes('data-cart-add="print"'), 'cart-ui.js не ищет кнопку услуги');
ok(!CHECKOUT.includes('data-cart-add="print"'), 'checkout.js не ищет кнопку услуги');

// ─────────────── страница prints.html ───────────────

ok(Boolean(PRINTS), 'файл prints.html лежит в корне проекта');
ok(/<html lang="ru">/.test(PRINTS), 'у страницы язык ru');
ok(/<title>[^<]*каталог принтов[^<]*<\/title>/i.test(PRINTS), 'в заголовке страницы каталог принтов');
ok(/href="assets\/css\/style\.css"/.test(PRINTS), 'страница подключает общие стили');
ok(/<body data-page="prints">/.test(PRINTS), 'страница помечена data-page="prints"');
ok(/<script type="module" src="assets\/js\/script\.js"><\/script>/.test(PRINTS),
  'подключён тот же модуль-вход, что и у остальных страниц');

/* Каркас: шапка с меню и корзиной, подвал, окно корзины. Содержимого
   каталога пока нет — это заглушка */
ok(/class="header"/.test(PRINTS), 'на странице есть шапка');
ok(/data-cart-open/.test(PRINTS), 'в шапке работает кнопка корзины');
ok(/data-modal="cart"/.test(PRINTS), 'окно корзины на странице есть');
ok(/class="footer"/.test(PRINTS), 'есть подвал');
ok(/href="index\.html#goods-print"/.test(PRINTS), 'со страницы есть дорога назад — к пижамам');
ok(/Страница ещё не свёрстана/.test(PRINTS), 'человеку сказано, что каталог в разработке');

/* Никаких скриптов каталога: заглушка не должна ничего рисовать */
ok(!/data-goods-sort|data-goods-count|goods-women__grid/.test(PRINTS),
  'на заглушке нет разметки каталога товаров');

// ─────────────── запуск страницы ───────────────

ok(/function initPrintsPage\(\)/.test(SCRIPT), 'в script.js есть запуск страницы принтов');
const printsBranch = SCRIPT.slice(SCRIPT.indexOf('function initPrintsPage'));
const body = printsBranch.slice(0, printsBranch.indexOf('}'));
for (const init of ['initHeader', 'initModal', 'initCart']) {
  ok(body.includes(`${init}()`), `страница принтов запускает ${init}`);
}
ok(/page === 'prints'/.test(SCRIPT), 'ветка prints подключена в init()');

ok(STYLE.includes("url('sections/goods-print.css')"),
  'стили секции принтов переиспользуются на новой странице');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Ссылка: «Посмотреть каталог принтов» → prints.html\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
