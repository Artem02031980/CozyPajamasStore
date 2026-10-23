#!/usr/bin/env node
/**
 * Проверка страницы товара «Льняной дамаск» (секция «Другие товары») —
 * без браузера.
 *
 * Подушка отличается от пижам не только текстом: у неё нет размеров
 * и принта, поэтому со страницы убраны блок размеров с сообщением
 * «Выберите размер», подпись «Добавить принт» с двумя кнопками и полем
 * файла, а также строка состава. Зато надзаголовок стал двумя строками
 * и крупнее. Здесь проверяется и то, что убрано, и то, что осталось.
 *
 * Цвета в браузере меряет checks/req-product-other.mjs.
 *
 * Запуск: node checks/product-other.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { getProduct } from '../assets/js/data.js';

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
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

const PAGE = 'product-pages/lyanyanoy-damask.html';
const ID = 'goods-other-16';

ok(exists(PAGE), `страница ${PAGE} существует`);
if (!exists(PAGE)) {
  process.stdout.write('НЕ ПРОШЛО: страницы нет\n');
  process.exit(1);
}

const html = read(PAGE);
const product = getProduct(ID);

// ─────────────── данные товара ───────────────

eq(product.title, 'Льняной дамаск', 'название товара в данных');
eq(product.section, 'other', 'товар из секции «Другие товары»');
ok(new RegExp(`<h1 class="product__title">${product.title}</h1>`).test(html),
  'название в разметке совпадает с данными');
ok(html.includes(`<p class="product__price">${product.price.toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽</p>`),
  'цена в разметке совпадает с данными', String(product.price));
ok(html.includes(`src="../${product.image}"`), 'картинка товара в разметке', product.image);
ok(html.includes(`width="${product.width}"`) && html.includes(`height="${product.height}"`),
  'размеры картинки в разметке совпадают с данными');
ok(html.includes(`alt="${product.alt}"`), 'alt картинки взят из данных');

/* Вид товара: от него зависят фон, кольцо-разделитель и акцент */
ok(html.includes('<body data-page="product" data-section="other">'),
  'страница помечена видом товара «other»');

// ─────────────── надзаголовок из двух строк ───────────────

ok(html.includes('<p class="product__subtitle">Другие товары</p>'),
  'первая строка надзаголовка — «Другие товары»');
ok(html.includes('<p class="product__type">Подушка</p>'),
  'вторая строка надзаголовка — тип товара «Подушка»');

/* Подзаголовок стоит до названия, тип — между ними: так читается
   «Другие товары → Подушка → название» */
const subtitleAt = html.indexOf('product__subtitle');
const typeAt = html.indexOf('product__type');
const titleAt = html.indexOf('class="product__title"');
ok(subtitleAt < typeAt && typeAt < titleAt, 'порядок: секция, тип, название',
  `${subtitleAt} / ${typeAt} / ${titleAt}`);

// ─────────────── чего на странице быть не должно ───────────────

const REMOVED = [
  ['data-product-size', 'размеров'],
  ['data-size-error', 'сообщения «Выберите размер»'],
  ['product__sizes', 'блока размеров'],
  ['product__chosen-size', 'строки выбранного размера'],
  ['product__print', 'блока принта'],
  ['data-print-upload', 'поля выбора файла'],
  ['product__composition', 'строки состава'],
  ['Выбрать из каталога', 'кнопки «Выбрать из каталога»'],
  ['Добавить свой макет', 'кнопки «Добавить свой макет»'],
  ['Добавить принт', 'подписи «Добавить принт»'],
];

for (const [needle, name] of REMOVED) {
  ok(!html.includes(needle), `на странице нет ${name}`, needle);
}

// ─────────────── покупка ───────────────

ok(html.includes(`data-cart-add="${ID}"`), 'кнопка корзины добавляет этот товар');
ok(html.includes(`data-buy-now="${ID}"`), 'покупка в один клик оформляет этот товар');
ok(html.includes('data-buy-now-redirect="../thanks-cart.html"'),
  'покупка в один клик ведёт на страницу благодарности');

/* У подушки нет размеров, поэтому и data-cart-size не нужен: правило
   «без размера не покупаем» включается сообщением, которого здесь нет */
ok(!html.includes('data-cart-size'), 'у кнопок нет пустого места под размер');

// ─────────────── ссылка с карточки ───────────────

eq(product.page, PAGE, 'у товара есть адрес страницы');
ok(/product\.page \?\? 'product-pages\/'/.test(read('assets/js/render.js')),
  'render.js подставляет адрес из данных');

// ─────────────── стили ───────────────

const css = read('assets/css/pages/product.css');

/** Тело правила по точному селектору. */
const ruleOf = (selector) => {
  const at = css.indexOf(selector + ' {');
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

/* Правило ищем и по списку селекторов: у наведения селекторы перечислены
   через запятую в одной группе, и поиск «селектор + {» её не находит */
const blockWith = (needle) => {
  const blocks = css.match(/[^{}]+\{[^{}]*\}/g) ?? [];
  return blocks.find((block) => block.slice(0, block.indexOf('{')).includes(needle)) ?? '';
};

const body = "body[data-page='product'][data-section='other']";

ok(/font-size:\s*var\(--fs-18\)/.test(ruleOf(`${body} .product__subtitle`)),
  'первая строка надзаголовка крупнее обычной (18px)',
  ruleOf(`${body} .product__subtitle`).replace(/\s+/g, ' '));
ok(/font-size:\s*var\(--fs-24\)/.test(ruleOf(`${body} .product__type`)),
  'тип товара — 24px',
  ruleOf(`${body} .product__type`).replace(/\s+/g, ' '));
ok(/font-weight:\s*var\(--fw-bold\)/.test(ruleOf(`${body} .product__type`)),
  'тип товара выделен жирным');

/* Акцент: было розовое — стало бежевое, было голубое — стало тёмное */
ok(/color:\s*var\(--color-beige\)/.test(ruleOf(`${body} .product__title`)),
  'название бежевое, а не розовое',
  ruleOf(`${body} .product__title`).replace(/\s+/g, ' '));

const cartRule = ruleOf(`${body} .product__button--cart.button--pink`);
ok(/background-color:\s*var\(--color-beige\)/.test(cartRule),
  'кнопка корзины с бежевой заливкой', cartRule.replace(/\s+/g, ' '));
ok(/color:\s*var\(--color-dark\)/.test(cartRule),
  'текст кнопки тёмный: бежевый на белом не читается');

const cartHover = blockWith(`${body} .product__button--cart.button--pink:hover`);
ok(/background-color:\s*var\(--color-dark\)/.test(cartHover),
  'при наведении кнопка становится тёмной', cartHover.replace(/\s+/g, ' ').slice(0, 160));
ok(/color:\s*var\(--color-white\)/.test(cartHover), 'и текст на ней белый');

const outline = ruleOf(`${body} .button--outline-pink`);
ok(/border-color:\s*var\(--color-beige\)/.test(outline),
  'у контурной кнопки бежевая рамка', outline.replace(/\s+/g, ' '));
ok(/color:\s*var\(--color-dark\)/.test(outline), 'текст контурной кнопки тёмный');

/* Колонки первой части карточки делятся поровну: квадратный кадр подушки
   в прежней раскладке занимал почти всю ширину, и сведениям не оставалось
   места — цена ломалась на три строки */
const gridRule = css.slice(css.indexOf(`@media (min-width: 1280px)`, css.indexOf(`${body} .product__type`)));
ok(new RegExp(`${body.replace(/[[\]]/g, '\\$&')} \\.product__main`).test(gridRule)
  || gridRule.includes(`${body} .product__main`),
  'на 1280px у страницы подушки своя раскладка колонок');

/* Иконки и фон — от вида товара */
ok(/\[data-section='other'\] \.product__divider[\s\S]{0,120}?icon-circle_other\.svg/.test(css),
  'кольцо-разделитель — из «других товаров»');
ok(/\[data-section='other'\][\s\S]{0,160}?bg_other\.png/.test(css), 'фон страницы — bg_other.png');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страница: ${PAGE} (${html.length} байт)\n`);
process.stdout.write(`Товар: ${product.title} — ${product.price} ₽, «Подушка»\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
