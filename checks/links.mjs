#!/usr/bin/env node
/**
 * Проверка связей между страницами и позиции «Свой макет» — без браузера.
 *
 * Что стережётся:
 *   1. карточка «Клубничные поля» на главной ведёт на свою страницу товара,
 *      «Солнце», «Русская душа», «Пшеничное поле», «Розовые поля» и «Тёмная
 *      ночь V» — на свои, а товары без страницы — на прежнюю заглушку;
 *   2. ссылка «Выбрать из каталога» на странице товара ведёт в каталог
 *      принтов (prints.html);
 *   3. загруженный макет становится позицией корзины «Свой макет»:
 *      нулевая сумма, пометка про менеджера и иконка файла;
 *   4. картинка товара в корзине строится от корня проекта, а не от текущей
 *      страницы — иначе на странице товара она не находилась бы.
 *
 * Клики и загрузку файла проверяет checks/req-product.mjs в браузере.
 *
 * Запуск: node checks/links.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { PRODUCTS, getProduct } from '../assets/js/data.js';

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

const RENDER = read('assets/js/render.js');
const CART = read('assets/js/cart.js');
const RENDER_CART = read('assets/js/render-cart.js');
const PRODUCT_JS = read('assets/js/product.js');
const PRODUCT_HTML = read('product-pages/klubnichnye-polya.html');

// ─────────────── карточка ведёт на страницу товара ───────────────

/* Адрес страницы живёт в данных: у товара есть поле page */
const withPage = PRODUCTS.filter((product) => product.page);
eq(withPage.map((product) => product.id), [
  'goods-new-01', 'goods-new-02', 'goods-new-03', 'goods-new-04', 'goods-new-05', 'goods-new-06',
  'goods-women-01', 'goods-women-02', 'goods-women-03', 'goods-women-04', 'goods-women-05',
  'goods-women-06', 'goods-men-01', 'goods-other-16',
], 'страницы размечены у четырнадцати товаров: шесть новинок, шесть женских, мужская и подушка');

/* Адреса новинок — отдельным списком: их проверяет ещё checks/product-new.mjs,
   а здесь важно, что ссылка с карточки каталога не ведёт в пустоту */
const NEW_PAGES = {
  'goods-new-01': 'product-pages/nezhnoe-schaste.html',
  'goods-new-02': 'product-pages/nochnaya-svoboda.html',
  'goods-new-03': 'product-pages/spokoynaya-noch-iv.html',
  'goods-new-04': 'product-pages/ogon-prometeya.html',
  'goods-new-05': 'product-pages/rozovye-perekrestki.html',
  'goods-new-06': 'product-pages/vygodnaya-filosofiya.html',
};

for (const [id, page] of Object.entries(NEW_PAGES)) {
  eq(getProduct(id).page, page, `адрес страницы «${getProduct(id).title}»`);
}

eq(getProduct('goods-women-01').page, 'product-pages/solntse.html',
  'адрес страницы «Солнца»');
eq(getProduct('goods-women-02').page, 'product-pages/russkaya-dusha.html',
  'адрес страницы «Русской души»');
eq(getProduct('goods-women-04').page, 'product-pages/pshenichnoe-pole.html',
  'адрес страницы «Пшеничного поля»');
eq(getProduct('goods-women-05').page, 'product-pages/rozovye-polya.html',
  'адрес страницы «Розовых полей»');
eq(getProduct('goods-women-06').page, 'product-pages/temnaya-noch-v.html',
  'адрес страницы «Тёмной ночи V»');
eq(getProduct('goods-women-03').page, 'product-pages/klubnichnye-polya.html',
  'адрес страницы «Клубничных полей»');
eq(getProduct('goods-men-01').page, 'product-pages/myatnyy-vecher.html',
  'адрес страницы «Мятного вечера»');
eq(getProduct('goods-other-16').page, 'product-pages/lyanyanoy-damask.html',
  'адрес страницы «Льняного дамаска»');

for (const page of withPage) {
  ok(exists(page.page), `файл страницы «${page.title}» на месте`, page.page);
}

/* У каждого адреса из данных есть файл: ссылка не должна вести в пустоту */
const missingPages = withPage
  .filter((product) => !exists(product.page))
  .map((product) => product.page);
eq(missingPages, [], 'у всех товаров с адресом файл страницы существует');

ok(/product\.page \?\? 'product-pages\/'/.test(RENDER),
  'render.js берёт адрес из данных, а без него оставляет заглушку');
ok(/href="\$\{href\}"/.test(RENDER), 'href карточки подставляется переменной');
ok(!/href="product-pages\/"[\s\S]{0,40}data-product-id/.test(RENDER),
  'жёсткой ссылки на папку в шаблоне не осталось');

// ─────────────── каталог принтов ───────────────

ok(/href="\.\.\/prints\.html"/.test(PRODUCT_HTML),
  '«Выбрать из каталога» ведёт на prints.html');
ok(exists('prints.html'), 'страница каталога принтов существует');

/* Новые страницы собираются из того же шаблона, и ссылка на каталог принтов
   должна остаться в них такой же — иначе блок принта поведёт в пустоту */
for (const page of ['product-pages/solntse.html', 'product-pages/russkaya-dusha.html',
  'product-pages/pshenichnoe-pole.html', 'product-pages/rozovye-polya.html',
  'product-pages/temnaya-noch-v.html']) {
  ok(exists(page), `страница ${page} существует`);
  ok(/href="\.\.\/prints\.html"/.test(read(page)),
    `на странице ${page} «Выбрать из каталога» ведёт на prints.html`);
}

// ─────────────── позиция «Свой макет» ───────────────

ok(/export const CUSTOM_PRINT_ID = 'print-custom'/.test(CART),
  'в cart.js есть идентификатор позиции «свой макет»');
ok(CART.includes('CUSTOM_PRINT_ID'), 'cart.js знает эту позицию в toLine/addItem');
ok(/file: typeof line\.file === 'string'/.test(CART),
  'состав позиции хранит имя файла');
ok(/options\.file|file = ''/.test(CART), 'addItem принимает имя файла');

/* Цена неизвестна: позиция не должна попадать в сумму товаров */
ok(/sum: 0/.test(CART), 'у позиции «Свой макет» нулевая сумма');
ok(/Стоимость уточнит менеджер|уточнит стоимость/.test(CART)
  || /уточнит менеджер/.test(RENDER_CART),
  'пометка про менеджера есть в модулях');

ok(RENDER_CART.includes('CUSTOM_PRINT_ID'), 'render-cart.js знает позицию «Свой макет»');
ok(/cart__image--file/.test(RENDER_CART), 'в корзине рисуется плашка с иконкой файла');
ok(/по согласованию/.test(RENDER_CART), 'цена показана как «по согласованию»');
ok(exists('assets/images/icons/icon-file.svg'), 'иконка файла лежит в assets');

const cartCss = read('assets/css/blocks/cart.css');
ok(/\.cart__image--file[\s\S]{0,200}?icon-file\.svg/.test(cartCss),
  'иконка файла подключена в стилях корзины');

// ─────────────── загрузка макета на странице товара ───────────────

ok(/import \{ addItem, CUSTOM_PRINT_ID \} from '\.\/cart\.js'/.test(PRODUCT_JS),
  'product.js кладёт макет в корзину через модуль корзины');
ok(/addItem\(CUSTOM_PRINT_ID, \{ qty: 1, file: name \}\)/.test(PRODUCT_JS),
  'имя файла уезжает в позицию корзины');
ok(/product__print-file-icon/.test(PRODUCT_JS),
  'подпись после загрузки собирается с иконкой файла');
ok(/Макет добавлен в корзину/.test(PRODUCT_JS),
  'подпись говорит, что макет добавлен');
ok(/уточнит менеджер/.test(PRODUCT_JS),
  'подпись предупреждает, что стоимость уточнит менеджер');
ok(/product__print-file--added/.test(read('assets/css/pages/product.css')),
  'у подписи «файл добавлен» есть оформление');

/* Неподходящий формат не должен попадать в корзину: проверка стоит
   до вызова addItem */
const uploadBody = PRODUCT_JS.slice(PRODUCT_JS.indexOf('function initPrintUpload'));
const addAt = uploadBody.indexOf('addItem(');
const guardAt = uploadBody.indexOf('if (!ok)');
ok(guardAt > 0 && guardAt < addAt, 'неподходящий файл отсекается до добавления',
  `проверка ${guardAt}, добавление ${addAt}`);

// ─────────────── картинка в корзине ───────────────

ok(/export function assetUrl/.test(read('assets/js/utils.js')),
  'в utils.js есть построение абсолютного адреса');
ok(/assetUrl\(product\.image\)/.test(RENDER_CART),
  'картинка в корзине строится через assetUrl');
ok(!/src="\$\{product\.image\}"/.test(RENDER_CART),
  'прямого относительного пути к картинке в корзине не осталось');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Карточка «Клубничные поля» → product-pages/klubnichnye-polya.html\n`);
process.stdout.write(`Карточка «Солнце» → product-pages/solntse.html\n`);
process.stdout.write(`Карточка «Русская душа» → product-pages/russkaya-dusha.html\n`);
process.stdout.write(`Карточка «Пшеничное поле» → product-pages/pshenichnoe-pole.html\n`);
process.stdout.write(`Карточка «Розовые поля» → product-pages/rozovye-polya.html\n`);
process.stdout.write(`Карточка «Тёмная ночь V» → product-pages/temnaya-noch-v.html\n`);
process.stdout.write(`Ссылка «Выбрать из каталога» → prints.html\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
