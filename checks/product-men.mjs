#!/usr/bin/env node
/**
 * Проверка мужской страницы товара «Мятный вечер» — без браузера.
 *
 * Страница собрана по образцу женской (klubnichnye-polya.html), поэтому
 * здесь проверяется то, чем она отличается и что легко сломать при правках:
 *
 *   1. данные товара в разметке совпадают с data.js (название, цена,
 *      состав, картинка, размеры M–XXXL, идентификаторы корзины);
 *   2. размеры в разметке, в данных и в окне выбора на главной — одни и те же;
 *   3. с карточки каталога на страницу ведёт ссылка (поле page);
 *   4. в CSS мужской акцент задан отдельным блоком и меняет розовое
 *      на голубое, а голубое на розовое;
 *   5. страница не тянет за собой женские хвосты — ни путей, ни текстов.
 *
 * Цвета в браузере меряет checks/req-product-men.mjs.
 *
 * Запуск: node checks/product-men.mjs
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

const PAGE = 'product-pages/myatnyy-vecher.html';
const ID = 'goods-men-01';

ok(exists(PAGE), `страница ${PAGE} существует`);
if (!exists(PAGE)) {
  process.stdout.write('НЕ ПРОШЛО: страницы нет\n');
  process.exit(1);
}

const html = read(PAGE);
const product = getProduct(ID);

// ─────────────── данные товара ───────────────

eq(product.title, 'Мятный вечер', 'название товара в данных');
ok(new RegExp(`<h1 class="product__title">${product.title}</h1>`).test(html),
  'название в разметке совпадает с данными');
ok(html.includes(`>${product.price.toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽<`),
  'цена в разметке совпадает с данными', String(product.price));
ok(html.includes(`<p class="product__composition">${product.subtitle}</p>`),
  'состав в разметке совпадает с данными', product.subtitle);
ok(html.includes(`src="../${product.image}"`), 'картинка товара в разметке', product.image);
ok(html.includes(`width="${product.width}"`) && html.includes(`height="${product.height}"`),
  'размеры картинки в разметке совпадают с данными');
ok(html.includes(`alt="${product.alt}"`), 'alt картинки взят из данных');
ok(/Пижама для мужчин/.test(html), 'подзаголовок — «Пижама для мужчин»');

// ─────────────── корзина и покупка ───────────────

ok(html.includes(`data-cart-add="${ID}"`), 'кнопка корзины добавляет этот товар');
ok(html.includes(`data-buy-now="${ID}"`), 'покупка в один клик оформляет этот товар');
ok(html.includes('data-buy-now-redirect="../thanks-cart.html"'),
  'покупка в один клик ведёт на страницу благодарности');
ok(html.includes('href="../prints.html"'), '«Выбрать из каталога» ведёт в каталог принтов');

/* Женских хвостов быть не должно: страница скопирована, и это главный риск */
const leftovers = ['goods-women-03', 'women/w03', 'Клубничные поля', 'для девушек'];
eq(leftovers.filter((needle) => html.includes(needle)), [],
  'в разметке нет следов женской страницы');

// ─────────────── размеры ───────────────

const markupSizes = [...html.matchAll(/data-product-size="([^"]+)"/g)].map((m) => m[1]);
eq(markupSizes, ['M', 'XL', 'XXL', 'XXXL'], 'размеры в разметке — M, XL, XXL, XXXL');
eq(product.sizes, ['M', 'XL', 'XXL', 'XXXL'], 'те же размеры в данных товара');

/* Окно выбора размера на главной берёт размеры из данных — значит
   у этого товара предложат те же четыре значения */
const { getSizes } = await import('../assets/js/data.js');
eq(getSizes(product), ['M', 'XL', 'XXL', 'XXXL'], 'окно выбора размера предложит те же размеры');
ok(!markupSizes.includes('S'), 'размера S у мужской пижамы нет');

// ─────────────── ссылка с карточки ───────────────

eq(product.page, PAGE, 'у товара есть адрес страницы');
ok(/product\.page \?\? 'product-pages\/'/.test(read('assets/js/render.js')),
  'render.js подставляет адрес из данных');
eq(getProduct(ID).page, PAGE, 'карточка «Мятный вечер» ведёт на эту страницу');

// ─────────────── вид товара и акцент ───────────────

ok(html.includes('<body data-page="product" data-section="men">'),
  'страница помечена видом товара «men»');
ok(html.includes('icon-circle_men.svg') === false, 'иконку разделителя выбирает CSS, а не разметка');

const css = read('assets/css/pages/product.css');

/* Акцент мужской коллекции — отдельный блок в конце файла */
const menBlock = css.slice(css.indexOf("[data-section='men'] .product__title"));
ok(menBlock.length > 0, 'в product.css есть блок мужского акцента');

const pairs = [
  ['название товара', "[data-section='men'] .product__title", /color:\s*var\(--color-blue\)/],
  ['пометка размера', "[data-section='men'] .product__chosen-size", /color:\s*var\(--color-pink\)/],
  ['рамка размера', "[data-section='men'] .product__size", /border-color:\s*var\(--color-blue\)/],
  ['кнопка корзины', "[data-section='men'] .product__button--cart.button--pink", /background-color:\s*var\(--color-blue\)/],
  ['контурная кнопка', "[data-section='men'] .button--outline-pink", /border-color:\s*var\(--color-blue\)/],
];

/** Тело правила по точному селектору. */
const ruleOf = (selector) => {
  const at = css.indexOf(selector + ' {');
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

for (const [name, selector, pattern] of pairs) {
  ok(pattern.test(ruleOf(selector)), `мужской акцент: ${name}`, ruleOf(selector).replace(/\s+/g, ' ').slice(0, 120));
}

/* Кнопка «Добавить в корзину» помечается классом button--pink, а вторая
   кнопка покупки — нет: иначе правило заливало бы обе */
ok(/\.product__button--cart>button--pink|\.product__button--cart\.button--pink/.test(css),
  'заливка кнопки корзины уточнена классом button--pink');

/* Иконки: у мужской коллекции свой файл каталога и своя иконка разделителя */
ok(exists('assets/images/icons/icon-catalog_blue.svg'), 'есть голубая иконка каталога');
ok(/\[data-section='men'\] \.product__button--print \.product__button-icon--catalog[\s\S]{0,120}?icon-catalog_blue\.svg/.test(css),
  'у мужской коллекции иконка каталога голубая');
ok(/\[data-section='men'\] \.product__divider[\s\S]{0,120}?icon-circle_men\.svg/.test(css),
  'у мужской коллекции кольцо-разделитель своё');
ok(/\[data-section='men'\][\s\S]{0,120}?bg_men\.png/.test(css), 'фон страницы — мужской');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страница: ${PAGE} (${html.length} байт)\n`);
process.stdout.write(`Товар: ${product.title} — ${product.price} ₽, размеры ${markupSizes.join(', ')}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
