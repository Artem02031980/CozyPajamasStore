#!/usr/bin/env node
/**
 * Проверка страницы товара «Синий жираф» (секция «Другие товары») —
 * без браузера.
 *
 * Плед отличается от пижам не только текстом: у него нет размеров
 * и принта, поэтому со страницы убраны блок размеров с сообщением
 * «Выберите размер», подпись «Добавить принт» с двумя кнопками и полем
 * файла, а также строка состава. Зато надзаголовок стал двумя строками
 * и крупнее. Здесь проверяется и то, что убрано, и то, что осталось.
 *
 * Цвета в браузере меряет checks/req-product-other.mjs.
 *
 * Запуск: node checks/product-other-siniy-zhiraf.mjs
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

const PAGE = 'product-pages/siniy-zhiraf.html';
const ID = 'goods-other-26';

ok(exists(PAGE), `страница ${PAGE} существует`);
if (!exists(PAGE)) {
  process.stdout.write('НЕ ПРОШЛО: страницы нет\n');
  process.exit(1);
}

const html = read(PAGE);
const product = getProduct(ID);

// ─────────────── данные товара ───────────────

eq(product.title, 'Синий жираф', 'название товара в данных');
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

// ─────────────── подпись под фото ───────────────

ok(html.includes('<p class="product__subtitle">Другие товары — мягкая игрушка</p>'),
  'под фото одна подпись: «Другие товары — мягкая игрушка»');
ok(!html.includes('product__type'), 'второй строки надзаголовка больше нет');

/* Порядок: фото, подпись, название, цена, кнопки — всё в одной колонке */
const galleryAt = html.indexOf('class="product__gallery"');
const subtitleAt = html.indexOf('product__subtitle');
const titleAt = html.indexOf('class="product__title"');
const priceAt = html.indexOf('class="product__price"');
const buttonsAt = html.indexOf('class="product__buttons"');
ok(galleryAt < subtitleAt && subtitleAt < titleAt && titleAt < priceAt && priceAt < buttonsAt,
  'порядок: фото, подпись, название, цена, кнопки',
  `${galleryAt} / ${subtitleAt} / ${titleAt} / ${priceAt} / ${buttonsAt}`);

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

/* У пледа нет размеров, поэтому и data-cart-size не нужен: правило
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
   через запятую в одной группе, и поиск «селектор + {» его не находит */
const blockWith = (needle) => {
  const blocks = css.match(/[^{}]+\{[^{}]*\}/g) ?? [];
  return blocks.find((block) => block.slice(0, block.indexOf('{')).includes(needle)) ?? '';
};

const body = "body[data-page='product'][data-section='other']";

ok(/font-size:\s*var\(--fs-16\)/.test(ruleOf(`${body} .product__subtitle`)),
  'подпись под фото мельче названия (16px)',
  ruleOf(`${body} .product__subtitle`).replace(/\s+/g, ' '));

/* Раскладка: с 768px фото слева, сведения справа. Колонка сведений
   фиксирована (300px) и не сжимается — место отдаётся фото */
const mainRule = (() => {
  const blocks = css.match(/@media[^{]*\{[\s\S]*?\n\}/g) ?? [];
  return blocks.find((block) => block.includes(`${body} .product__main`)) ?? '';
})();
ok(mainRule.includes(`${body} .product__main`),
  'для страницы подушки есть своё правило раскладки');
ok(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+300px/.test(mainRule),
  'с 768px фото слева, сведения справа, колонка сведений 300px',
  mainRule.replace(/\s+/g, ' ').slice(0, 200));

ok(/align-items:\s*flex-start/.test(ruleOf(`${body} .product__info`)),
  'сведения выровнены по левому краю');
ok(/text-align:\s*left/.test(ruleOf(`${body} .product__info`)),
  'текст выровнен по левому краю');
ok(/align-items:\s*stretch/.test(ruleOf(`${body} .product__buttons`)),
  'кнопки идут на всю ширину колонки');

/* Название в одну строку — с 768px, где колонка уже широкая */
const nowrapBlock = (css.match(/@media[^{]*\{[\s\S]*?\n\}/g) ?? [])
  .find((block) => block.includes(`${body} .product__title`)) ?? '';
ok(/white-space:\s*nowrap/.test(nowrapBlock),
  'с 768px название стоит в одну строку', nowrapBlock.replace(/\s+/g, ' ').slice(0, 160));

/* Фото крупнее, а галерея — по высоте кадра. У фото два правила (высота
   и ограничение ширины в медиазапросе), поэтому ищем среди всех блоков */
const imageRules = (css.match(/[^{}]+\{[^{}]*\}/g) ?? [])
  .filter((block) => block.slice(0, block.indexOf('{')).includes(`${body} .product__image`));
ok(imageRules.some((block) => /max-height:\s*520px/.test(block)),
  'фото может занимать высоту колонки (до 520px)',
  imageRules.map((block) => block.replace(/\s+/g, ' ')).join(' | ').slice(0, 200));
/* Подпись сразу под фото: у галереи два правила (прижатие влево и высота),
   поэтому ищем среди всех блоков с этим селектором */
const galleryRules = (css.match(/[^{}]+\{[^{}]*\}/g) ?? [])
  .filter((block) => block.slice(0, block.indexOf('{')).includes(`${body} .product__gallery`));
ok(galleryRules.some((block) => /min-height:\s*0/.test(block)),
  'подпись стоит сразу под фото, без запаса по высоте',
  galleryRules.map((block) => block.replace(/\s+/g, ' ')).join(' | ').slice(0, 200));

/* Акцент: название бежевое, кнопки — общей палитры (розовое с синим).
   У названия два правила: цвет и запрет переноса с 768px, — поэтому
   ищем среди всех блоков с этим селектором, а не в первом попавшемся */
const titleRules = (css.match(/[^{}]+\{[^{}]*\}/g) ?? [])
  .filter((block) => block.slice(0, block.indexOf('{')).includes(`${body} .product__title`));
ok(titleRules.some((block) => /color:\s*var\(--color-beige\)/.test(block)),
  'название бежевое, а не розовое',
  titleRules.map((block) => block.replace(/\s+/g, ' ')).join(' | ').slice(0, 200));

const cartRule = ruleOf(`${body} .product__button--cart.button--pink`);
ok(/background-color:\s*var\(--color-pink\)/.test(cartRule),
  'кнопка корзины с розовой заливкой', cartRule.replace(/\s+/g, ' '));
ok(/color:\s*var\(--color-white\)/.test(cartRule), 'текст кнопки белый');

const cartHover = blockWith(`${body} .product__button--cart.button--pink:hover`);
ok(/background-color:\s*var\(--color-blue\)/.test(cartHover),
  'при наведении кнопка становится синей', cartHover.replace(/\s+/g, ' ').slice(0, 160));
ok(/color:\s*var\(--color-white\)/.test(cartHover), 'и текст на ней белый');

const outline = ruleOf(`${body} .button--outline-pink`);
ok(/border-color:\s*var\(--color-pink\)/.test(outline),
  'у контурной кнопки розовая рамка', outline.replace(/\s+/g, ' '));
ok(/color:\s*var\(--color-pink\)/.test(outline), 'и розовый текст');

const outlineHover = blockWith(`${body} .button--outline-pink:hover`);
ok(/background-color:\s*var\(--color-blue\)/.test(outlineHover),
  'при наведении контурная кнопка заливается синим',
  outlineHover.replace(/\s+/g, ' ').slice(0, 160));
ok(/border-color:\s*var\(--color-blue\)/.test(outlineHover),
  'и рамка становится синей');
ok(/color:\s*var\(--color-white\)/.test(outlineHover), 'и текст на ней белый');

/* Фото выровнено по левому краю колонки */
ok(/justify-content:\s*flex-start/.test(ruleOf(`${body} .product__gallery`)),
  'фото прижато к левому краю колонки',
  ruleOf(`${body} .product__gallery`).replace(/\s+/g, ' '));

/* Размеры с 768px: фото и кнопки покупки — до 300px */
const media768 = (css.match(/@media \(min-width: 768px\) \{[\s\S]*?\n\}/g) ?? [])
  .find((block) => block.includes(`${body} .product__image`)) ?? '';

/** Тело правила внутри медиазапроса по точному селектору. */
const mediaRule = (selector) => {
  const at = media768.indexOf(selector + ' {');
  return at < 0 ? '' : media768.slice(at, media768.indexOf('}', at));
};

ok(/max-width:\s*min\(300px,\s*100%\)/.test(mediaRule(`${body} .product__image`)),
  'с 768px фото ограничено 300px и шириной колонки',
  mediaRule(`${body} .product__image`).replace(/\s+/g, ' '));
ok(/max-width:\s*300px/.test(mediaRule(`${body} .product__buttons .product__button`)),
  'с 768px кнопки покупки ограничены 300px');

/* С 1280px содержимое левой колонки — одна группа шириной 300px, стоящая
   по центру своей половины карточки (440px): по 70px с каждой стороны.
   Группа именно одна, а не каждый блок по центру: иначе у фото, подписи,
   названия и кнопок были бы разные левые края */
const media1280 = (css.match(/@media \(min-width: 1280px\) \{[\s\S]*?\n\}/g) ?? [])
  .find((block) => block.includes(`${body} .product__main`)) ?? '';
ok(/grid-template-columns:\s*minmax\(0,\s*300px\)/.test(media1280),
  'с 1280px колонка фото по ширине содержимого', media1280.replace(/\s+/g, ' ').slice(0, 200));
ok(/justify-content:\s*center/.test(media1280),
  'и стоит по центру своей половины карточки');

/* Иконки и фон — от вида товара */
ok(/\[data-section='other'\] \.product__divider[\s\S]{0,120}?icon-circle_other\.svg/.test(css),
  'кольцо-разделитель — из «других товаров»');
ok(/\[data-section='other'\][\s\S]{0,160}?bg_other\.png/.test(css), 'фон страницы — bg_other.png');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страница: ${PAGE} (${html.length} байт)\n`);
process.stdout.write(`Товар: ${product.title} — ${product.price} ₽, «Мягкая игрушка»\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');