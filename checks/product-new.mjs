#!/usr/bin/env node
/**
 * Проверка шести страниц «Новой коллекции» — без браузера.
 *
 * Три страницы собраны из женского шаблона («Клубничные поля»), три —
 * из мужского («Мятный вечер»). Проверяется, что в каждой:
 *   данные на странице совпадают с data.js (название, цена, фото, размеры
 *   фото, alt, состав, описание, характеристики);
 *   подпись над названием собрана из типа и возрастной группы;
 *   размеры — набор секции new: S, M, XL, XXL (у мужского шаблона в макете
 *   стоял M, XL, XXL, XXXL, и если его не заменить, товар добавится
 *   с размером, которого нет в окне выбора на главной);
 *   покупка ведёт на свой товар, принт и корзина на месте;
 *   от шаблона не осталось чужих данных — названия, цены, фото и размеров.
 *
 * Запуск: node checks/product-new.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { getProduct, getSizes } from '../assets/js/data.js';

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
const flat = (value) => value.replace(/\s+/g, ' ').trim();
const price = (value) => value.toLocaleString('ru-RU').replace(/\s/g, ' ');

/* ─────────────── шесть товаров новой коллекции ─────────────── */

const PAGES = [
  { id: 'goods-new-01', page: 'product-pages/nezhnoe-schaste.html', template: 'women' },
  { id: 'goods-new-02', page: 'product-pages/nochnaya-svoboda.html', template: 'men' },
  { id: 'goods-new-03', page: 'product-pages/spokoynaya-noch-iv.html', template: 'women' },
  { id: 'goods-new-04', page: 'product-pages/ogon-prometeya.html', template: 'men' },
  { id: 'goods-new-05', page: 'product-pages/rozovye-perekrestki.html', template: 'women' },
  { id: 'goods-new-06', page: 'product-pages/vygodnaya-filosofiya.html', template: 'men' },
];

/* Подпись над названием: тип изделия плюс возрастная группа из данных.
   У пеньюара тип «Пеньюар», у остальных — «Пижама» */
const labelOf = (product) => {
  const kind = product.types[0];
  const age = product.ages[0];
  return `${kind} ${age.charAt(0).toLowerCase()}${age.slice(1)}`;
};

for (const item of PAGES) {
  const product = getProduct(item.id);
  const tag = product.title;

  ok(exists(item.page), `${tag}: страница существует`, item.page);
  if (!exists(item.page)) continue;

  const html = read(item.page);

  // ── данные товара ──
  eq(product.page, item.page, `${tag}: адрес в данных`);
  ok(html.includes(`<h1 class="product__title">${product.title}</h1>`),
    `${tag}: название в разметке`);
  ok(html.includes(`<p class="product__price">${price(product.price)} ₽</p>`),
    `${tag}: цена в разметке`);
  ok(html.includes(`src="../${product.image}"`), `${tag}: фото товара`, product.image);
  ok(html.includes(`alt="${product.alt}"`), `${tag}: alt из данных`);
  ok(html.includes(`width="${product.width}"`) && html.includes(`height="${product.height}"`),
    `${tag}: размеры фото из данных`);

  // ── подпись и состав ──
  ok(html.includes(`<p class="product__subtitle">${labelOf(product)}</p>`),
    `${tag}: подпись «${labelOf(product)}»`);

  const composition = html.match(/class="product__composition"[^>]*>([^<]+)</);
  eq(composition?.[1]?.trim(), product.subtitle, `${tag}: состав совпадает с данными`);

  // ── описание и характеристики ──
  ok(flat(html).includes(flat(product.description)), `${tag}: описание из данных`);

  for (const detail of product.details) {
    const row = `<dt class="product__details-name">${detail.name}</dt>`;
    ok(html.includes(row), `${tag}: характеристика «${detail.name}»`);
    ok(html.includes(`<dd class="product__details-value">${detail.value}</dd>`),
      `${tag}: значение «${detail.name}»`);
  }

  eq((html.match(/class="product__details-name"/g) ?? []).length, product.details.length,
    `${tag}: число характеристик на странице`);

  // ── размеры: набор секции new ──
  const sizes = getSizes(product);
  eq(sizes, ['S', 'M', 'XL', 'XXL'], `${tag}: размеры товара в данных`);

  const chips = [...html.matchAll(/data-product-size="([^"]+)"/g)].map((m) => m[1]);
  eq(chips, sizes, `${tag}: размеры на странице совпадают с данными`);
  ok(!html.includes('XXXL'), `${tag}: размера XXXL, которого нет в данных, нет на странице`);

  // ── покупка ──
  ok(html.includes(`data-cart-add="${item.id}"`), `${tag}: кнопка корзины добавляет этот товар`);
  ok(html.includes(`data-buy-now="${item.id}"`), `${tag}: покупка в один клик оформляет этот товар`);
  ok(html.includes('data-buy-now-redirect="../thanks-cart.html"'),
    `${tag}: путь на страницу благодарности`);
  ok(html.includes('data-size-error'), `${tag}: у товара есть размеры, есть и подсказка о них`);

  // ── каркас страницы ──
  ok(html.includes(`<body data-page="product" data-section="${item.template}">`),
    `${tag}: вид товара ${item.template} — от него фон и акцент`);
  ok(html.includes('data-print-upload'), `${tag}: блок принта на месте`);
  ok(html.includes('data-modal="cart"'), `${tag}: окно корзины на месте`);
  ok(html.includes('src="../assets/js/script.js"'), `${tag}: скрипт подключён`);
  ok(html.includes('class="footer__copyright"'), `${tag}: подвал на месте`);

  // ── от шаблона не осталось чужого ──
  const leftovers = ['Клубничные поля', 'Мятный вечер', 'goods-women-03', 'goods-men-01',
    '12 199', '5 499', 'w03.png', 'm01.png', 'махров', 'велсофт', 'мятно']
    .filter((needle) => html.includes(needle));
  eq(leftovers, [], `${tag}: в разметке нет данных шаблона`);

  // ── хаб-ссылки ведут на главную на уровень выше ──
  ok(html.includes('href="../index.html#goods-new"'), `${tag}: ссылка на «Новую коллекцию»`);
}

/* ─────────────── связи страниц ─────────────── */

const RENDER = read('assets/js/render.js');
ok(/product\.page \?\? 'product-pages\/'/.test(RENDER),
  'render.js берёт адрес из данных, а без него оставляет заглушку');

/* Все шесть новинок получили адрес: карточки в секции «Новинки» кликабельны */
for (const item of PAGES) {
  ok(getProduct(item.id).page, `${getProduct(item.id).title}: у товара есть адрес`);
}

/* ─────────────── сводка ─────────────── */

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страниц: ${PAGES.length} — женских ${PAGES.filter((p) => p.template === 'women').length}, `
  + `мужских ${PAGES.filter((p) => p.template === 'men').length}\n`);
for (const item of PAGES) {
  const product = getProduct(item.id);
  process.stdout.write(`  ${product.title.padEnd(20)} ${item.page}  ${price(product.price)} ₽\n`);
}

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
