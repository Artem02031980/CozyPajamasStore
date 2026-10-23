#!/usr/bin/env node
/**
 * Проверка правила «без размера не покупаем» — без браузера.
 *
 * На странице товара размер выбирают рядом с кнопками, поэтому и «Добавить
 * в корзину», и «Купить в один клик» без него не работают: показывается
 * «Выберите размер» и фокус уходит на ряд размеров. Правило одно на обе
 * покупки и живёт в size-guard.js.
 *
 * Здесь проверяется связка: модуль на месте, оба обработчика им пользуются,
 * сообщение размечено в разметке обеих страниц, а кнопки, которым размер
 * не нужен (карточки каталога, услуга «ПРИНТ»), под правило не попадают.
 *
 * Само поведение в браузере меряют checks/req-product.mjs
 * и checks/req-product-men.mjs.
 *
 * Запуск: node checks/size-guard.mjs
 */

import { readFileSync, existsSync } from 'node:fs';

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(`${name}${detail ? ' -> ' + detail : ''}`);
};

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

ok(exists('assets/js/size-guard.js'), 'модуль size-guard.js на месте');

const GUARD = read('assets/js/size-guard.js');
const CART_UI = read('assets/js/cart-ui.js');
const CHECKOUT = read('assets/js/checkout.js');
const PRODUCT = read('assets/js/product.js');

// ─────────────── сам модуль ───────────────

ok(/export function blockWithoutSize/.test(GUARD), 'модуль отдаёт blockWithoutSize');
ok(/export function clearSizeError/.test(GUARD), 'модуль отдаёт clearSizeError');
ok(/\[data-size-error\]/.test(GUARD), 'сообщение ищется по data-size-error');
ok(/\[data-product-size\]/.test(GUARD), 'фокус ставится на ряд размеров');
ok(/trigger\.dataset\.cartSize/.test(GUARD), 'модуль смотрит выбранный размер у кнопки');
ok(/box\.hidden = false/.test(GUARD), 'сообщение показывается');
ok(/return true/.test(GUARD), 'при отсутствии размера покупка прерывается');

/* Правило включается разметкой: нет сообщения — нет требования */
ok(/if \(!box\) return false/.test(GUARD),
  'без сообщения в разметке размер не обязателен');
ok(/if \(trigger\.dataset\.cartSize\) return false/.test(GUARD),
  'с выбранным размером покупка проходит');

// ─────────────── кто пользуется ───────────────

ok(/from '\.\/size-guard\.js'/.test(CART_UI), 'cart-ui.js импортирует правило');
ok(/blockWithoutSize\(addButton\)/.test(CART_UI),
  'cart-ui.js проверяет размер перед добавлением в корзину');

const addAt = CART_UI.indexOf('cart.addItem(id');
const guardAt = CART_UI.indexOf('blockWithoutSize(addButton)');
ok(guardAt > 0 && guardAt < addAt, 'проверка стоит до добавления товара',
  `проверка ${guardAt}, добавление ${addAt}`);

ok(/from '\.\/size-guard\.js'/.test(CHECKOUT), 'checkout.js импортирует правило');
ok(/blockWithoutSize\(trigger\)/.test(CHECKOUT),
  'checkout.js проверяет размер перед покупкой в один клик');

/* Ищем вызов внутри initBuyNow: определение buildOneClickOrder стоит
   в файле выше, и сравнение позиций по всему файлу ничего не значит */
const buyNowBody = CHECKOUT.slice(CHECKOUT.indexOf('export function initBuyNow'));
const orderAt = buyNowBody.indexOf('buildOneClickOrder(');
const buyGuardAt = buyNowBody.indexOf('blockWithoutSize(trigger)');
ok(buyGuardAt > 0 && buyGuardAt < orderAt, 'проверка стоит до сборки заказа',
  `проверка ${buyGuardAt}, заказ ${orderAt}`);

ok(/clearSizeError\(\)/.test(PRODUCT),
  'product.js прячет сообщение, когда размер выбран');

/* Старого дубля быть не должно: правило живёт в одном месте */
ok(!/data-buy-now-error/.test(CART_UI + CHECKOUT + PRODUCT),
  'в модулях не осталось старого имени атрибута');
ok(!/toggleBuyNowError/.test(CHECKOUT), 'прежняя местная функция убрана');

// ─────────────── разметка страниц ───────────────

const PAGES = ['product-pages/klubnichnye-polya.html', 'product-pages/myatnyy-vecher.html'];

for (const page of PAGES) {
  const html = read(page);

  ok(/<p class="product__sizes-error" data-size-error role="alert" hidden>/.test(html),
    `${page}: сообщение размечено и скрыто`);
  ok(html.includes('Выберите размер'), `${page}: текст сообщения — «Выберите размер»`);

  /* Сообщение стоит в блоке размеров, а кнопки — в карточке товара:
     правило ищет его в пределах <article> */
  const sizesBlock = html.slice(
    html.indexOf('<div class="product__sizes">'),
    html.indexOf('class="product__buttons"'),
  );
  ok(sizesBlock.includes('data-size-error'),
    `${page}: сообщение стоит в блоке размеров`, `${sizesBlock.length} байт`);
  ok(/<article class="product__card">[\s\S]*?data-cart-add/.test(html),
    `${page}: кнопка корзины внутри карточки товара`);

  /* У обеих кнопок есть место под выбранный размер */
  const cartSizeAttrs = (html.match(/data-cart-size/g) ?? []).length;
  ok(cartSizeAttrs >= 2, `${page}: у обеих кнопок покупки есть data-cart-size`,
    `${cartSizeAttrs}`);
}

// ─────────────── кого правило не касается ───────────────

const INDEX = read('index.html');
const RENDER = read('assets/js/render.js');

ok(/data-select-size/.test(RENDER),
  'карточки каталога помечены data-select-size: там своё окно выбора');
ok(!/data-size-error/.test(INDEX),
  'на главной нет сообщения о размере: карточки идут через окно выбора');
ok(/data-cart-add="print"|data-print-price/.test(INDEX),
  'услуга «ПРИНТ» добавляется без размера — правила не касается');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Правило: blockWithoutSize() из size-guard.js, сообщение data-size-error\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
