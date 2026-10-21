#!/usr/bin/env node
/**
 * Проверка выбора размера перед добавлением в корзину.
 *
 * Кнопка «В корзину» в карточке каталога не может положить товар в корзину
 * сразу: размер там не выбран. Поэтому клик открывает окно с размерами,
 * и товар уходит в корзину только после подтверждения.
 *
 * Здесь проверяется то, что не трогает DOM: список размеров по секциям,
 * признак на кнопке карточки и связка модулей по тексту файлов.
 * Само окно проверяет браузерный запрос — checks/req-size-picker.mjs.
 *
 * Запуск: node checks/size-picker.mjs
 */

import { readFileSync } from 'node:fs';
import { PRODUCTS, SECTIONS, getProducts, getProduct, getSizes, SIZES_BY_SECTION } from '../assets/js/data.js';

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

// ─────────────── размеры в данных ───────────────

eq(SIZES_BY_SECTION.new, ['S', 'M', 'XL', 'XXL'], 'у «Новой коллекции» размеры S–XXL');
eq(SIZES_BY_SECTION.women, ['S', 'M', 'XL', 'XXL'], 'у женской коллекции размеры S–XXL');
eq(SIZES_BY_SECTION.men, ['S', 'M', 'XL', 'XXL'], 'у мужской коллекции размеры S–XXL');
eq(SIZES_BY_SECTION.other, ['Единый размер'], 'у «Других товаров» размер один — единый');

/* В карточке каталога у товара всегда есть из чего выбрать: если бы список
   оказался пустым, окно открылось бы пустым и товар нельзя было бы купить */
const noSizes = PRODUCTS.filter((p) => getSizes(p).length === 0);
eq(noSizes.map((p) => p.id), [], 'у каждого товара есть хотя бы один размер');

const noSection = PRODUCTS.filter((p) => !SECTIONS.includes(p.section));
eq(noSection.map((p) => p.id), [], 'у каждого товара секция из известного списка');

/* Свои размеры товара важнее размеров секции */
eq(getSizes(getProduct('goods-women-03')), ['S', 'M', 'XL', 'XXL'],
  'своё поле sizes у товара берётся первым');
eq(getSizes({ section: 'other', sizes: ['10', '20'] }), ['10', '20'],
  'свои размеры важнее списка секции');
eq(getSizes({ section: 'other' }), ['Единый размер'], 'без своих размеров — список секции');
eq(getSizes({ section: 'нет-такой' }), [], 'неизвестная секция — пустой список');
eq(getSizes(null), [], 'без товара — пустой список');
eq(getSizes(undefined), [], 'undefined — пустой список');

/* Одежда — четыре размера, «другие товары» — один */
const clothing = [...getProducts('new'), ...getProducts('women'), ...getProducts('men')];
eq([...new Set(clothing.map((p) => getSizes(p).length))], [4],
  'у всей одежды по четыре размера');
eq([...new Set(getProducts('other').map((p) => getSizes(p).length))], [1],
  'у «Других товаров» по одному размеру');

/* Размеры — строки без пробелов по краям: они попадают в data-атрибуты
   и в заказ, и « M» там был бы отдельной позицией */
const dirty = PRODUCTS.filter((p) => getSizes(p).some((s) => s !== s.trim() || !s));
eq(dirty.map((p) => p.id), [], 'в размерах нет пустых строк и пробелов по краям');

/* Окно выбора размера нужно там, где есть из чего выбирать. У пижам это
   четыре размера, у «Других товаров» — один: окно для них было бы пустым
   шагом, поэтому карточки этой секции кладут товар в корзину сразу */
const needsChoice = (product) => getSizes(product).length > 1;

eq([...new Set(getProducts('other').map(needsChoice))], [false],
  'у «Других товаров» окно выбора не открывается: размер один');
eq([...new Set(getProducts('women').map(needsChoice))], [true],
  'женским пижамам окно нужно');
eq([...new Set(getProducts('men').map(needsChoice))], [true],
  'мужским пижамам окно нужно');
eq([...new Set(getProducts('new').map(needsChoice))], [true],
  'пижамам «Новой коллекции» окно нужно');

// ─────────────── связка модулей ───────────────

const RENDER_JS = read('assets/js/render.js');
const CART_UI_JS = read('assets/js/cart-ui.js');
const SIZE_PICKER_JS = read('assets/js/size-picker.js');
const SCRIPT_JS = read('assets/js/script.js');
const INDEX_HTML = read('index.html');
const CSS = read('assets/css/blocks/size-picker.css');
const STYLE_CSS = read('assets/css/style.css');

ok(RENDER_JS.includes('data-select-size'),
  'render.js умеет ставить признак выбора размера',
  'в render.js нет признака выбора размера');
ok(/getSizes\(product\)\.length > 1/.test(RENDER_JS),
  'признак ставится по числу размеров, а не по названию секции');
ok(/\$\{selectSize\}/.test(RENDER_JS),
  'признак подставляется в разметку кнопки условно');
ok(/data-cart-add="\$\{product\.id\}"\$\{selectSize\}/.test(RENDER_JS),
  'признак стоит на той же кнопке, что и data-cart-add');

/* cart-ui.js обязан отступить: иначе товар добавится без размера,
   и окно будет открываться уже после добавления */
ok(CART_UI_JS.includes('data-select-size'), 'cart-ui.js знает про признак');
ok(/hasAttribute\('data-select-size'\)\)\s*return/.test(CART_UI_JS),
  'cart-ui.js пропускает такие клики и товар сам не добавляет');

ok(SIZE_PICKER_JS.includes("getProduct(cardButton.dataset.cartAdd)"),
  'окно берёт товар по id из кнопки');
ok(SIZE_PICKER_JS.includes('getSizes(product)'), 'размеры берутся из данных');
ok(SIZE_PICKER_JS.includes('openModalByName(MODAL)'), 'окно открывается через modal.js');
ok(SIZE_PICKER_JS.includes('addItem('), 'товар добавляется только из обработчика окна');
ok(SIZE_PICKER_JS.includes('close()'), 'после добавления окно закрывается');

/* Добавление в корзину должно быть ровно в одном месте модуля —
   в confirm(), иначе товар снова начнёт добавляться без размера */
eq((SIZE_PICKER_JS.match(/addItem\(/g) ?? []).length, 1,
  'addItem вызывается в size-picker.js один раз');

ok(SCRIPT_JS.includes('initSizePicker'), 'точка входа запускает выбор размера');

// ─────────────── разметка и стили окна ───────────────

ok(INDEX_HTML.includes('data-modal="size"'), 'на главной есть окно выбора размера');
ok(INDEX_HTML.includes('data-size-picker'), 'в окне есть контейнер под размеры');
ok(/data-modal="size"[\s\S]{0,400}?aria-labelledby="size-title"/.test(INDEX_HTML),
  'у окна есть заголовок для скринридера');
ok(INDEX_HTML.includes('>Выберите размер<'), 'заголовок окна — «Выберите размер»');

/* Второе окно не должно ломать первое: корзина осталась на месте */
ok(INDEX_HTML.includes('data-modal="cart"'), 'окно корзины не пострадало');

ok(CSS.length > 0, 'size-picker.css не пустой', `${CSS.length} байт`);
ok(STYLE_CSS.includes("url('blocks/size-picker.css')"), 'size-picker.css подключён в style.css');
ok(/\.size-picker__size\.is-active/.test(CSS), 'у выбранного размера есть оформление');
ok(/#fe0000/.test(CSS), 'сообщение об ошибке красное, как в остальных формах');

/* Содержимое окна выровнено по центру: название, ряды размеров и кнопка
   стоят на одной оси. Раньше чипсы прижимались влево, а кнопка — в центр,
   и окно выглядело собранным из двух разных блоков */
const cssRule = (selector) => {
  const at = CSS.indexOf(selector + ' {');
  return at < 0 ? '' : CSS.slice(at, CSS.indexOf('}', at));
};

ok(/text-align:\s*center/.test(cssRule('.size-picker__product')),
  'название товара по центру окна', cssRule('.size-picker__product').replace(/\s+/g, ' '));
ok(/justify-content:\s*center/.test(cssRule('.size-picker__sizes')),
  'ряды размеров по центру окна', cssRule('.size-picker__sizes').replace(/\s+/g, ' '));
ok(/align-self:\s*center/.test(cssRule('.size-picker__confirm')),
  'кнопка подтверждения по центру окна');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Размеры по секциям: ${SECTIONS
  .map((s) => `${s} — ${SIZES_BY_SECTION[s].join('/')}`).join(', ')}\n`);
process.stdout.write(`Товаров с размерами: ${PRODUCTS.filter((p) => getSizes(p).length).length} `
  + `из ${PRODUCTS.length}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((f) => process.stdout.write(`  FAIL ${f}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
