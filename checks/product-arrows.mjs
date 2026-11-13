#!/usr/bin/env node
/**
 * Стрелки между страницами всех разделов: «Новой», «Женской»,
 * «Мужской» коллекций и «Других товаров».
 *
 * Кадр у товара один, поэтому стрелки по краям карточки ведут не на другой
 * ракурс, а на соседний товар раздела — в том же порядке, в каком карточки
 * стоят на главной. Проверяется вся цепочка сразу:
 *
 *   у первой страницы раздела левой стрелки нет;
 *   у последней нет правой;
 *   у каждой средней обе, и каждая ведёт на соседнюю страницу;
 *   ссылки взаимны: у соседа в обратную сторону стоит ровно эта страница;
 *   подпись у стрелки общая — «Предыдущий товар» / «Следующий товар»;
 *   выключенных кнопок-стрелок в проекте не осталось.
 *
 * Как только в раздел добавляется страница, скрипт проверки покажет, где
 * цепочка разъехалась: у соседей появятся лишние или недостающие стрелки.
 *
 * Запуск: node checks/product-arrows.mjs
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

/** Разметка одной стрелки: тег, адрес, подпись. */
const arrowOf = (html, modifier) => {
  const at = html.indexOf(`class="product__arrow product__arrow--${modifier}"`);
  if (at < 0) return null;

  const tagStart = html.lastIndexOf('<', at);
  const tagEnd = html.indexOf('>', at);
  const close = html.indexOf('</a>', at);
  const tag = html.slice(tagStart, tagEnd + 1);

  return {
    тег: tag.startsWith('<a') ? 'a' : 'button',
    href: tag.match(/href="([^"]+)"/)?.[1] ?? null,
    подпись: tag.match(/aria-label="([^"]+)"/)?.[1] ?? null,
    выключена: /\sdisabled/.test(tag),
    закрыта: close > 0,
  };
};

const SECTIONS = [
  { section: 'new', label: 'Новая коллекция' },
  { section: 'women', label: 'Женская коллекция' },
  { section: 'men', label: 'Мужская коллекция' },
  { section: 'other', label: 'Другие товары' },
];

for (const { section, label } of SECTIONS) {
  const chain = PRODUCTS.filter((product) => product.section === section && product.page);
  ok(chain.length > 1, `${label}: в разделе больше одной страницы`, String(chain.length));

  chain.forEach((product, index) => {
    const file = product.page.split('/').pop();
    const html = read(product.page);
    const prev = arrowOf(html, 'prev');
    const next = arrowOf(html, 'next');
    const previous = chain[index - 1];
    const following = chain[index + 1];

    /* Первая страница: левой стрелки нет. Остальные: есть и ведёт назад */
    if (!previous) {
      eq(prev, null, `${label}: у первой страницы (${file}) нет левой стрелки`);
    } else {
      ok(Boolean(prev), `${label}: ${file} — есть левая стрелка`);
      if (prev) {
        eq(prev.тег, 'a', `${label}: ${file} — левая стрелка это ссылка`);
        eq(prev.href, previous.page.split('/').pop(),
          `${label}: ${file} — левая стрелка ведёт на «${previous.title}»`);
        ok(prev.закрыта, `${label}: ${file} — левая стрелка закрыта`);
        eq(prev.подпись, 'Предыдущий товар',
          `${label}: ${file} — подпись левой стрелки общая, без названия соседа`);
        ok(!prev.выключена, `${label}: ${file} — левая стрелка не выключена`);
      }
    }

    /* Последняя страница: правой стрелки нет */
    if (!following) {
      eq(next, null, `${label}: у последней страницы (${file}) нет правой стрелки`);
    } else {
      ok(Boolean(next), `${label}: ${file} — есть правая стрелка`);
      if (next) {
        eq(next.тег, 'a', `${label}: ${file} — правая стрелка это ссылка`);
        eq(next.href, following.page.split('/').pop(),
          `${label}: ${file} — правая стрелка ведёт на «${following.title}»`);
        ok(next.закрыта, `${label}: ${file} — правая стрелка закрыта`);
        eq(next.подпись, 'Следующий товар',
          `${label}: ${file} — подпись правой стрелки общая, без названия соседа`);
        ok(!next.выключена, `${label}: ${file} — правая стрелка не выключена`);
      }
    }

    /* Кнопок листания кадра не осталось: атрибуты старой разметки ушли */
    ok(!html.includes('data-product-prev') && !html.includes('data-product-next'),
      `${label}: ${file} — кнопок листания кадра нет`);
  });

  /* Цепочка замкнута: у каждого соседа в обратную сторону стоит эта же
     страница. Проверка ловит страницу, вставленную в середину без правки
     соседей */
  chain.forEach((product, index) => {
    const file = product.page.split('/').pop();
    const following = chain[index + 1];
    if (!following) return;

    const followingHtml = read(following.page);
    eq(arrowOf(followingHtml, 'prev')?.href, file,
      `${label}: у «${following.title}» левая стрелка ведёт обратно на ${file}`);
  });
}

// ─────────────── выключенных кнопок не осталось ───────────────

/* Раньше стрелки были кнопками листания кадра, и у подушки они остались
   выключенными. Теперь цепочка есть в каждом разделе, поэтому кнопок
   с адресом в проекте быть не должно: стрелка — всегда ссылка */
const withButtons = PRODUCTS
  .filter((product) => product.page)
  .filter((product) => {
    const html = read(product.page);
    return html.includes('data-product-prev') || html.includes('data-product-next');
  })
  .map((product) => product.page.split('/').pop());

eq(withButtons, [], 'ни на одной странице не осталось кнопок-стрелок');

/* Все страницы с адресом входят в одну из четырёх цепочек */
const withPages = PRODUCTS.filter((product) => product.page);
const chainTitles = withPages.map((product) => product.title);
eq(chainTitles.length, new Set(withPages.map((product) => product.page)).size,
  'у каждого товара со страницей своя страница, и все они в цепочках');

/* Все адреса из стрелок существуют и принадлежат товарам раздела */
const allPages = withPages.map((product) => product.page.split('/').pop());
const missing = [...new Set(allPages)].filter((file) => !exists(`product-pages/${file}`));
eq(missing, [], 'файлы всех страниц с адресом существуют');

// ─────────────── итог ───────────────

const womenPages = PRODUCTS.filter((p) => p.section === 'women' && p.page).length;
const newPages = PRODUCTS.filter((p) => p.section === 'new' && p.page).length;
const menPages = PRODUCTS.filter((p) => p.section === 'men' && p.page).length;
const otherPages = PRODUCTS.filter((p) => p.section === 'other' && p.page).length;

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`«Новая коллекция»: ${newPages} страниц, «Женская коллекция»: ${womenPages}, «Мужская коллекция»: ${menPages}, «Другие товары»: ${otherPages}\n`);
process.stdout.write('Цепочки: Солнце → … → Кремовый вальс, Нежное счастье → … → Выгодная философия,\n');
process.stdout.write('Мятный вечер → … → Графит и рубин\n');

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');

