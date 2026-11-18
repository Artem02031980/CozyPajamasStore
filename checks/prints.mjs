#!/usr/bin/env node
/**
 * Проверка секции принтов на главной и страницы каталога принтов — без браузера.
 *
 * Секция на главной: кнопка «Добавить услугу в корзину» стала ссылкой
 * «Посмотреть каталог принтов» на prints.html. Цена и порог услуги
 * по-прежнему лежат в разметке (data-print-price, data-print-free-from)
 * и читаются корзиной.
 *
 * Страница prints.html: каталог из 17 принтов, у каждого два состояния
 * рисунка, цена 500 ₽ и автор в описании. Карточки рисует render-prints.js
 * из prints.js — проверяются и данные, и разметка карточки, и то, что все
 * файлы картинок на месте.
 *
 * Живую страницу и корзину проверяет checks/req-prints.mjs.
 *
 * Запуск: node checks/prints.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { PRINTS, PRINT_PRICE, PRINT_SIZE, PRINT_AUTHOR, getPrint, printLabel } from '../assets/js/prints.js';
import { imageSize } from './lib/images.mjs';

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

const INDEX = read('index.html');
const PRINTS_HTML = exists('prints.html') ? read('prints.html') : '';
const SCRIPT = read('assets/js/script.js');
const CART_UI = read('assets/js/cart-ui.js');
const CHECKOUT = read('assets/js/checkout.js');
const STYLE = read('assets/css/style.css');
const RENDER = read('assets/js/render-prints.js');
const CART = read('assets/js/cart.js');
const RENDER_CART = read('assets/js/render-cart.js');

// ─────────────── ссылка в секции принтов на главной ───────────────

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
  'прежней кнопки «Добавить услугу в корзину» в секции нет');
ok(!/data-cart-add/.test(section),
  'в секции принтов нет кнопки корзины: решение принимается в каталоге');
ok(/class="[^"]*\bbutton\b/.test(link), 'ссылке оставлен класс button: вид не меняется');

eq(link.match(/data-print-price="([^"]+)"/)?.[1], '500', 'цена нанесения в разметке');
eq(link.match(/data-print-free-from="([^"]+)"/)?.[1], '15000', 'порог бесплатного нанесения в разметке');

ok(!/data-cart-add="print"/.test(INDEX), 'на главной нет кнопки, добавляющей услугу');
ok(CART_UI.includes("$('[data-print-price]')"),
  'cart-ui.js читает цену услуги из разметки, а не из константы');
ok(CHECKOUT.includes("$('[data-print-price]')"),
  'checkout.js читает цену услуги из разметки');
ok(!CART_UI.includes('data-cart-add="print"'), 'cart-ui.js не ищет кнопку услуги');
ok(!CHECKOUT.includes('data-cart-add="print"'), 'checkout.js не ищет кнопку услуги');

// ─────────────── данные принтов ───────────────

eq(PRINTS.length, 17, 'в каталоге 17 принтов');
eq(PRINT_PRICE, 500, 'цена принта — 500 ₽');
eq(PRINT_AUTHOR, 'Артём Мижорниев', 'автор рисунков указан в данных');

const ids = PRINTS.map((print) => print.id);
eq(ids.length, new Set(ids).size, 'идентификаторы принтов уникальны');
eq(ids[0], 'print-01', 'первый принт — print-01');
eq(ids.at(-1), 'print-17', 'последний принт — print-17');

const numbers = PRINTS.map((print) => print.number);
eq(numbers, Array.from({ length: 17 }, (_, index) => index + 1), 'нумерация идёт подряд с 1');

/* У каждого принта два состояния рисунка: обычное и инвертированное,
   и оба файла лежат на диске */
const missingFiles = PRINTS.flatMap((print) => [print.image, print.inverted])
  .filter((path) => !exists(path));
eq(missingFiles, [], 'файлы обоих состояний на месте');

const doubled = PRINTS.filter((print) => print.image === print.inverted);
eq(doubled, [], 'инверсия — отдельный файл, а не тот же самый');

/* Подпись и описание: автор в каждом описании, название не пустое */
const withoutAuthor = PRINTS.filter((print) => !print.text.includes(PRINT_AUTHOR));
eq(withoutAuthor, [], 'в описании каждого принта есть автор');
const withoutTitle = PRINTS.filter((print) => !print.title || !print.alt);
eq(withoutTitle, [], 'у каждого принта есть название и alt картинки');

eq(printLabel(PRINTS[0]), 'Принт 01. Good Morning!', 'подпись принта для корзины');
eq(getPrint('print-17')?.title, 'Доброе утро!', 'getPrint находит принт по id');
eq(getPrint('goods-women-01'), null, 'getPrint не путает принт с товаром каталога');

// ─────────────── страница prints.html ───────────────

ok(Boolean(PRINTS_HTML), 'файл prints.html лежит в корне проекта');
ok(/<html lang="ru">/.test(PRINTS_HTML), 'у страницы язык ru');
ok(/<title>[^<]*каталог принтов[^<]*<\/title>/i.test(PRINTS_HTML), 'в заголовке страницы каталог принтов');
ok(/href="assets\/css\/style\.css"/.test(PRINTS_HTML), 'страница подключает общие стили');
ok(/<body data-page="prints">/.test(PRINTS_HTML), 'страница помечена data-page="prints"');
ok(/<script type="module" src="assets\/js\/script\.js"><\/script>/.test(PRINTS_HTML),
  'подключён тот же модуль-вход, что и у остальных страниц');

/* Шапка, подвал, окно корзины — те же, что на остальных страницах */
ok(/class="header"/.test(PRINTS_HTML), 'на странице есть шапка');
ok(/data-cart-open/.test(PRINTS_HTML), 'в шапке работает кнопка корзины');
ok(/data-modal="cart"/.test(PRINTS_HTML), 'окно корзины на странице есть');
ok(/class="footer"/.test(PRINTS_HTML), 'есть подвал');

/* Содержимое: заголовок, автор, цена, правила нанесения, контейнер карточек */
ok(/class="prints__title"[^>]*>КАТАЛОГ ПРИНТОВ</.test(PRINTS_HTML), 'на странице есть заголовок каталога');
/* Имя в разметке может стоять с неразрывным пробелом — типографика
   ставит его между именем и фамилией, — поэтому ищем по любому пробелу
   или сущности &nbsp; */
const AUTHOR_RE = new RegExp(PRINT_AUTHOR.replace(/\s+/g, '(?:[\\s\\u00A0]|&nbsp;)+'));
const LEAD_BLOCK = PRINTS_HTML.slice(
  PRINTS_HTML.indexOf('prints__lead'),
  PRINTS_HTML.indexOf('prints__cost'),
);
ok(AUTHOR_RE.test(LEAD_BLOCK),
  'во вступлении назван автор рисунков');
ok(/class="prints__cost"[^>]*>[\s\S]{0,80}?500 ₽/.test(PRINTS_HTML),
  'цена принта стоит в шапке страницы');
ok(/class="prints__list"[^>]*data-prints-list/.test(PRINTS_HTML),
  'на странице есть контейнер для карточек');
ok(/Чёрное на светлом/.test(PRINTS_HTML) && /Белое на тёмном/.test(PRINTS_HTML),
  'на странице объяснено, как принт ложится на светлую и тёмную ткань');
ok(/не предполагают цветность|Без цветности/i.test(PRINTS_HTML),
  'сказано, что принты без цветности — только нанесение');
ok(!/Страница ещё не свёрстана/.test(PRINTS_HTML), 'заглушки на странице больше нет');

/* Разметки карточек в HTML нет: их рисует скрипт — как карточки на главной */
ok(!/prints__card/.test(PRINTS_HTML), 'карточки принтов не дублируются в разметке');

// ─────────────── отрисовка карточек ───────────────

ok(/export function renderPrints/.test(RENDER), 'render-prints.js отдаёт renderPrints');
ok(/data-prints-list/.test(RENDER), 'скрипт ищет контейнер по data-prints-list');

const card = RENDER.slice(0, RENDER.indexOf('export function renderPrints'));

for (const [needle, name] of [
  ['prints__image', 'картинка принта'],
  ['prints__preview--dark', 'тёмная плашка превью'],
  ['prints__name', 'название принта'],
  ['prints__text', 'описание принта'],
  ['prints__price', 'цена принта'],
  ['data-cart-add', 'кнопка «В корзину»'],
  ['print.image', 'обычное состояние рисунка'],
  ['print.inverted', 'инвертированное состояние'],
]) {
  ok(card.includes(needle), `в карточке есть ${name}`, needle);
}

ok((card.match(/prints__image/g) ?? []).length >= 2, 'в карточке два изображения');
ok(/formatPrice\(PRINT_PRICE\)/.test(card), 'цена берётся из PRINT_PRICE, а не вписана числом');
ok(/loading="lazy"/.test(card), 'картинки грузятся лениво: 34 файла на страницу');

/* Кнопка «В корзину» — как в карточках каталога на главной: компактная,
   со скруглением --radius-xs и белой иконкой корзины перед подписью */
ok(/prints__button-icon/.test(card), 'у кнопки есть иконка корзины');
ok(/<span class="prints__button-label" data-cart-label>В корзину<\/span>/.test(card),
  'подпись кнопки обёрнута в span с data-cart-label: отзыв не сотрёт иконку');

const BUTTON_CSS = read('assets/css/pages/prints.css');
ok(/\.prints__button \{[\s\S]{0,400}?border-radius: var\(--radius-xs\)/.test(BUTTON_CSS),
  'скругление кнопки — --radius-xs, как у кнопок в карточках каталога');
ok(/\.prints__button \{[\s\S]{0,400}?flex: none/.test(BUTTON_CSS),
  'кнопка не растягивается: ширина по содержимому');
ok(!/\.prints__button \{[\s\S]{0,400}?flex: 1 1/.test(BUTTON_CSS),
  'прежнего растягивания кнопки не осталось');
ok(/\.prints__button-icon \{[\s\S]{0,400}?cart-white\.svg/.test(BUTTON_CSS),
  'иконка — белая корзина, тот же файл, что на странице товара');

// ─────────────── корзина ───────────────

ok(/from '\.\/prints\.js'/.test(CART), 'cart.js берёт принты из prints.js');
ok(/const print = getPrint\(line\.id\)/.test(CART), 'toLine находит принт по id');
ok(/price: PRINT_PRICE/.test(CART), 'цена принта в корзине берётся из константы');
ok(/Boolean\(getPrint\(id\)\)/.test(CART), 'addItem принимает id принта');
ok(/cart__image--print/.test(RENDER_CART), 'у принта в корзине своя квадратная картинка');
ok(/cart__image--print/.test(read('assets/css/blocks/cart.css')),
  'квадратная картинка принта описана в стилях корзины');

// ─────────────── запуск страницы и стили ───────────────

ok(/function initPrintsPage\(\)/.test(SCRIPT), 'в script.js есть запуск страницы принтов');
const printsBranch = SCRIPT.slice(SCRIPT.indexOf('function initPrintsPage'));
const body = printsBranch.slice(0, printsBranch.indexOf('}'));
for (const init of ['initHeader', 'initModal', 'initCart', 'renderPrints']) {
  ok(body.includes(`${init}()`), `страница принтов запускает ${init}`);
}
ok(/page === 'prints'/.test(SCRIPT), 'ветка prints подключена в init()');

ok(STYLE.includes("url('pages/prints.css')"), 'стили страницы принтов подключены');
ok(exists('assets/css/pages/prints.css'), 'файл стилей страницы принтов на месте');

// ─────────────── страница в структуре сайта ───────────────

/* Шрифты: без подключения Roboto Slab страница открывалась системным
   шрифтом, хотя все остальные свёрстаны им */
ok(/fonts\.googleapis\.com\/css2\?family=Roboto\+Slab:wght@400;700/.test(PRINTS_HTML),
  'шрифты Roboto Slab подключены, как на остальных страницах');

/* Меню ведёт в каталог: пункт «Принты» — это и есть эта страница.
   На страницах товаров путь на уровень выше */
ok(/class="header__link" href="prints\.html" aria-current="page">Принты/.test(PRINTS_HTML),
  'на странице принтов пункт меню «Принты» помечен как текущий');
ok(!/header__link" href="[^"]*#goods-print"/.test(INDEX),
  'на главной пункт меню «Принты» ведёт в каталог, а не на якорь');
const PRODUCT_PAGE = read('product-pages/solntse.html');
ok(/class="header__link" href="\.\.\/prints\.html">Принты/.test(PRODUCT_PAGE),
  'со страницы товара пункт меню «Принты» ведёт в каталог');
ok(!/header__link" href="\.\.\/index\.html#goods-print"/.test(PRODUCT_PAGE),
  'старой ссылки на якорь в меню страницы товара не осталось');

// ─────────────── свой макет в начале страницы ───────────────

const uploadBlock = (() => {
  const at = PRINTS_HTML.indexOf('class="prints__upload"');
  return at < 0 ? '' : PRINTS_HTML.slice(at, PRINTS_HTML.indexOf('class="prints__notes"', at));
})();

ok(uploadBlock.length > 0, 'в начале страницы есть блок «Свой макет»');
ok(/Добавить свой макет/.test(uploadBlock), 'кнопка подписана «Добавить свой макет»');
ok(/<label[^>]*for="prints-upload"/.test(uploadBlock),
  'кнопка — это label для скрытого поля: окно выбора откроет браузер');
ok(/<input[^>]*type="file"[^>]*id="prints-upload"[\s\S]{0,400}?data-print-upload/.test(uploadBlock)
  || /<input[^>]*id="prints-upload"[^>]*type="file"/.test(uploadBlock),
  'на странице есть поле выбора файла');
ok(/accept="\.pdf,\.jpg,\.jpeg,\.png,\.psd,\.tiff,\.tif/.test(uploadBlock),
  'в accept перечислены те же форматы, что на странице товара');
ok(/data-print-file/.test(uploadBlock), 'есть место под пометку о выбранном файле');
ok(/Стоимость\s+уточнит менеджер/.test(uploadBlock),
  'человеку сказано, что стоимость своего макета уточнит менеджер');

/* Блок стоит до правил нанесения и до карточек — в начале страницы */
ok(PRINTS_HTML.indexOf('prints__upload') < PRINTS_HTML.indexOf('prints__notes'),
  'блок «Свой макет» стоит до правил нанесения');
ok(PRINTS_HTML.indexOf('prints__upload') < PRINTS_HTML.indexOf('data-prints-list'),
  'блок «Свой макет» стоит до списка карточек');

/* Кнопка «Добавить свой макет» выглядит как её близнец на странице товара:
   скругление --radius-sm (8px), кегль 14px, высота control-height,
   розовая рамка и розовый текст, при наведении — синяя заливка */
const UPLOAD_BUTTON_CSS = (() => {
  const css = read('assets/css/pages/prints.css');
  const at = css.indexOf('.prints__upload-button {');
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
})();

ok(/border-radius: var\(--radius-sm\)/.test(UPLOAD_BUTTON_CSS),
  'скругление кнопки — --radius-sm (8px), как у «Добавить свой макет» на странице товара',
  UPLOAD_BUTTON_CSS.replace(/\s+/g, ' ').slice(0, 120));
ok(/font-size: var\(--fs-14\)/.test(UPLOAD_BUTTON_CSS),
  'кегль кнопки — 14px, как у кнопок страницы товара');
ok(/min-height: var\(--control-height\)/.test(UPLOAD_BUTTON_CSS),
  'высота кнопки — общая control-height');
ok(/color: var\(--color-pink\)/.test(UPLOAD_BUTTON_CSS)
  && /border: var\(--border-width-thin\) solid var\(--color-pink\)/.test(UPLOAD_BUTTON_CSS),
  'рамка и текст розовые, как у «Добавить свой макет» на странице товара');
ok(!/border-radius: var\(--radius-pill\)/.test(UPLOAD_BUTTON_CSS),
  'пилюли от базовой кнопки на этой кнопке нет');

/* Подключение: тот же модуль, что на странице товара, но со своими классами */
ok(/initPrintFileUpload\(\{ block: 'prints__upload-note' \}\)/.test(SCRIPT),
  'страница принтов подключает загрузку макета со своими классами пометки');
ok(/export function initPrintFileUpload/.test(read('assets/js/product.js')),
  'функция загрузки макета экспортирована из product.js');
for (const selector of ['prints__upload-note--error', 'prints__upload-note-icon']) {
  ok(read('assets/css/pages/prints.css').includes(selector),
    `в стилях есть состояние «${selector}»`);
}
/* Состояние «макет добавлен» отдельного оформления не требует — оно
   показывает иконку и текст, — но класс должен ставиться модулем */
ok(/\$\{block\}--added/.test(read('assets/js/product.js')),
  'модуль ставит пометку «макет добавлен» через тот же префикс классов');

/* Скругления — из шкалы сайта: панели 12px, превью 8px, кнопка-пилюля */
const PRINTS_CSS = read('assets/css/pages/prints.css');
ok(/\.prints__card \{[\s\S]{0,400}?border-radius: var\(--radius-md\)/.test(PRINTS_CSS),
  'карточка скруглена на --radius-md, как другие панели сайта');
ok(/\.prints__image \{[\s\S]{0,300}?border-radius: var\(--radius-sm\)/.test(PRINTS_CSS),
  'превью скруглены на --radius-sm, как картинки карточек');
ok(!/--radius-lg|--radius-xl/.test(PRINTS_CSS),
  'выпадающих из шкалы скруглений на странице нет');

// ─────────────── размеры принтов: разметка, данные и файлы ─────────────

/* В карточке были width="1024" height="1024", а файлы — 700×700:
   пропорции совпадали, поэтому глазами не видно, но браузер резервировал
   неверное место, а атрибутам нельзя было верить. Теперь размер берётся
   из PRINT_SIZE, и это проверяется с трёх сторон */

eq(PRINT_SIZE, 700, 'сторона квадрата принта — 700 px');

const RENDER_PRINTS = read('assets/js/render-prints.js');
ok(/width="\$\{PRINT_SIZE\}"/.test(RENDER_PRINTS) && /height="\$\{PRINT_SIZE\}"/.test(RENDER_PRINTS),
  'карточка берёт размеры из PRINT_SIZE, а не пишет число');
ok(!/width="1024"/.test(RENDER_PRINTS) && !/height="1024"/.test(RENDER_PRINTS),
  'числа 1024 в разметке карточки не осталось');

/* Файлы всех принтов и их тёмных версий должны совпадать с PRINT_SIZE */
const wrongFiles = [];
for (const print of PRINTS) {
  for (const rel of [print.image, print.inverted]) {
    const file = new URL(`../${rel}`, import.meta.url);
    if (!existsSync(file)) { wrongFiles.push(`${rel}: файла нет`); continue; }
    const size = imageSize(readFileSync(file));
    if (!size) { wrongFiles.push(`${rel}: формат не распознан`); continue; }
    if (size.width !== PRINT_SIZE || size.height !== PRINT_SIZE) {
      wrongFiles.push(`${rel}: ${size.width}×${size.height}`);
    }
  }
}
eq(wrongFiles, [], 'все 34 файла принтов — ровно PRINT_SIZE');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Принтов: ${PRINTS.length}, цена: ${PRINT_PRICE} ₽, автор: ${PRINT_AUTHOR}\n`);
process.stdout.write(`Ссылка: «Посмотреть каталог принтов» → prints.html\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');


