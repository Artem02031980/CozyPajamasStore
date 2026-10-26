#!/usr/bin/env node
/**
 * Проверка страницы товара «Мамино счастье VI» — без браузера.
 *
 * Страница собрана по женскому образцу (klubnichnye-polya.html), поэтому
 * проверяется то, что задаёт именно этот товар и что легко сломать при правках:
 *
 *   1. данные в разметке совпадают с data.js — название, цена, состав,
 *      фото с настоящими пикселями файла, описание и характеристики;
 *   2. подпись над названием собрана из вида изделия и возрастной группы;
 *   3. размеры одинаковы в разметке, в данных и в окне выбора на главной
 *      (S, M, XL, XXL — набор секции women);
 *   4. корзина и покупка в один клик ведут на этот товар;
 *   5. от шаблона и от соседних страниц не осталось чужих данных.
 *
 * Замеры и клики в браузере — checks/req-product-new.mjs.
 *
 * Запуск: node checks/product-mamino-schaste-vi.mjs
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

const PAGE = 'product-pages/mamino-schaste-vi.html';
const ID = 'goods-women-07';

ok(exists(PAGE), `страница ${PAGE} существует`);
if (!exists(PAGE)) {
  process.stdout.write('НЕ ПРОШЛО: страницы нет\n');
  process.exit(1);
}

const html = read(PAGE);
const product = getProduct(ID);

// ─────────────── данные товара ───────────────

eq(product.title, 'Мамино счастье VI', 'название товара в данных');
ok(html.includes(`<h1 class="product__title">${product.title}</h1>`),
  'название в разметке совпадает с данными');
ok(html.includes(`<p class="product__price">${price(product.price)} ₽</p>`),
  'цена в разметке совпадает с данными', String(product.price));
ok(html.includes(`<p class="product__composition">${product.subtitle}</p>`),
  'состав в разметке совпадает с данными', product.subtitle);
ok(html.includes(`src="../${product.image}"`), 'фото товара в разметке', product.image);
ok(html.includes(`width="${product.width}"`) && html.includes(`height="${product.height}"`),
  'размеры фото в разметке совпадают с данными');
ok(html.includes(`alt="${product.alt}"`), 'alt фото взят из данных');

/* Подпись над названием: вид изделия плюс возрастная группа со строчной.
   Вид берётся не из types[0]: там первая часть состава («Брюки»), а подпись
   называет изделие целиком — у пижамных страниц это «Пижама» */
const labelOf = (item) => `Пижама ${item.ages[0].charAt(0).toLowerCase()}${item.ages[0].slice(1)}`;
eq(product.ages, ['Для девушек'], 'возрастная группа товара в данных');
ok(html.includes(`<p class="product__subtitle">${labelOf(product)}</p>`),
  `подпись «${labelOf(product)}»`);

// ─────────────── описание и характеристики ───────────────

ok(flat(html).includes(flat(product.description)), 'описание в разметке совпадает с данными');

for (const detail of product.details) {
  ok(html.includes(`<dt class="product__details-name">${detail.name}</dt>`),
    `характеристика «${detail.name}»`);
  ok(html.includes(`<dd class="product__details-value">${detail.value}</dd>`),
    `значение «${detail.name}»`);
}

eq((html.match(/class="product__details-name"/g) ?? []).length, product.details.length,
  'число характеристик на странице');
eq(product.details.map((detail) => detail.name),
  ['Сезон', 'Материал', 'Состав материала', 'Коллекция', 'Стиль'],
  'у женской страницы пять характеристик: сезон, материал, состав, коллекция, стиль');

// ─────────────── заголовок вкладки и meta description ───────────────

ok(html.includes(`<title>${product.title} — пижама женская | Магазин уютных пижам</title>`),
  'title вкладки');
const meta = html.match(/name="description"\s+content="([^"]+)"/);
ok(meta?.[1]?.includes(`«${product.title}»`) === true, 'meta description называет товар');
ok(meta?.[1]?.includes(price(product.price) + ' ₽') === true, 'meta description называет цену');

// ─────────────── размеры ───────────────

const sizes = getSizes(product);
const chips = [...html.matchAll(/data-product-size="([^"]+)"/g)].map((match) => match[1]);
eq(sizes, ['S', 'M', 'XL', 'XXL'], 'размеры товара в данных — набор секции women');
eq(chips, sizes, 'чипы размеров на странице совпадают с данными');
ok(html.includes('data-size-error'), 'у товара есть размеры — есть и подсказка о них');
ok(!html.includes('XXXL'), 'размера XXXL, которого нет в данных, нет на странице');

// ─────────────── корзина и покупка ───────────────

ok(html.includes(`data-cart-add="${ID}"`), 'кнопка корзины добавляет этот товар');
ok(html.includes(`data-buy-now="${ID}"`), 'покупка в один клик оформляет этот товар');
ok(html.includes('data-buy-now-redirect="../thanks-cart.html"'),
  'покупка в один клик ведёт на страницу благодарности');
ok(html.includes('href="../prints.html"'), '«Выбрать из каталога» ведёт в каталог принтов');
ok(html.includes('data-print-upload'), 'поле для своего макета на месте');

// ─────────────── каркас страницы ───────────────

ok(html.includes('<body data-page="product" data-section="women">'),
  'страница помечена видом товара «women» — от него фон и акцент');
ok(html.includes('data-modal="cart"'), 'окно корзины на месте');
ok(html.includes('src="../assets/js/script.js"'), 'скрипт подключён');
ok(html.includes('class="footer__copyright"'), 'подвал на месте');
ok(html.includes('href="../index.html#goods-women"'), 'ссылка на женскую коллекцию ведёт на главную');

// ─────────────── ссылка с карточки каталога ───────────────

eq(product.page, PAGE, 'у товара есть адрес страницы');
eq(getProduct('goods-women-07').page, PAGE, 'карточка «Мамино счастье VI» ведёт на эту страницу');
ok(/product\.page \?\? 'product-pages\/'/.test(read('assets/js/render.js')),
  'render.js подставляет адрес из данных');

// ─────────────── чужих данных не осталось ───────────────

const leftovers = ['Клубничные поля', 'Солнце', 'Русская душа', 'Пшеничное поле',
  'Розовые поля', 'Тёмная ночь V', 'goods-women-01', 'goods-women-02',
  'goods-women-03', 'goods-women-04', 'goods-women-05', 'goods-women-06',
  'w01.png', 'w02.png', 'w03.png', 'w04.png', 'w05.png', 'w06.png',
  '12 199', '7 699', '3 999', '6 599', '12 999', '4 199',
  'махров', 'велсофт', 'Весна-Лето 2023', 'Майка',
  'width="385"', 'height="1159"', 'width="294"', 'height="1034"',
  'width="349"', 'height="1135"', 'width="365"', 'height="1152"',
  'width="471"', 'height="1113"', 'width="346"', 'height="1148"']
  .filter((needle) => html.includes(needle));
eq(leftovers, [], 'в разметке нет данных шаблона и соседних страниц');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страница: ${PAGE} (${html.length} байт)\n`);
process.stdout.write(`Товар: ${product.title} — ${price(product.price)} ₽, `
  + `размеры ${chips.join(', ')}, характеристик ${product.details.length}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
