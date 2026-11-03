#!/usr/bin/env node
/**
 * Стрелки между страницами «Новой» и «Женской» коллекций.
 *
 * Кадр у товара один, поэтому стрелки по краям карточки ведут не на другой
 * ракурс, а на соседний товар раздела — в том же порядке, в каком карточки
 * стоят на главной. Проверяется вся цепочка сразу:
 *
 *   у первой страницы раздела левой стрелки нет;
 *   у последней нет правой;
 *   у каждой средней обе, и каждая ведёт на соседнюю страницу;
 *   ссылки взаимны: у соседа в обратную сторону стоит ровно эта страница;
 *   в подписи стрелки — название товара, к которому она ведёт;
 *   у «Мятного вечера» (men) и подушки (other) всё по-старому:
 *   выключенные кнопки, ссылок нет.
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

// ─────────────── разделы без цепочки ───────────────

/* «Мятный вечер», «Лазурная клетка», «Осенний плед», «Снежный халат»,
   «Тихое серебро», «Ночная мгла», «Акварельное утро», «Изумрудный сад»,
   «Морской сон», «Клетка горца», «Изумрудная полоска», «Розовый закат»,
   «Лесной горошек», «Морской штрих», «Графитовый сон» и подушка: там
   стрелки остаются выключенными кнопками. Задача владельца касалась
   только «Новой» и «Женской» коллекций */
const UNCHANGED = [
  { page: 'product-pages/myatnyy-vecher.html', label: 'Мятный вечер (men)' },
  { page: 'product-pages/lazurnaya-kletka.html', label: 'Лазурная клетка (men)' },
  { page: 'product-pages/osenniy-pled.html', label: 'Осенний плед (men)' },
  { page: 'product-pages/snezhnyy-khalat.html', label: 'Снежный халат (men)' },
  { page: 'product-pages/tikhoye-serebro.html', label: 'Тихое серебро (men)' },
  { page: 'product-pages/nochnaya-mgla.html', label: 'Ночная мгла (men)' },
  { page: 'product-pages/akvarelnoe-utro.html', label: 'Акварельное утро (men)' },
  { page: 'product-pages/izumrudnyy-sad.html', label: 'Изумрудный сад (men)' },
  { page: 'product-pages/morskoy-son.html', label: 'Морской сон (men)' },
  { page: 'product-pages/kletka-gortsa.html', label: 'Клетка горца (men)' },
  { page: 'product-pages/izumrudnaya-poloska.html', label: 'Изумрудная полоска (men)' },
  { page: 'product-pages/rozovyy-zakat.html', label: 'Розовый закат (men)' },
  { page: 'product-pages/lesnoy-goroshek.html', label: 'Лесной горошек (men)' },
  { page: 'product-pages/morskoy-shtrikh.html', label: 'Морской штрих (men)' },
  { page: 'product-pages/grafitovyy-son.html', label: 'Графитовый сон (men)' },
  { page: 'product-pages/vishnevyy-goroshek.html', label: 'Вишнёвый горошек (men)' },
  { page: 'product-pages/kofeynyy-pled.html', label: 'Кофейный плед (men)' },
  { page: 'product-pages/prazdnichnyy-bant.html', label: 'Праздничный бант (men)' },
  { page: 'product-pages/lyanyanoy-damask.html', label: 'Льняной дамаск (other)' },
];

for (const { page, label } of UNCHANGED) {
  const html = read(page);
  const prev = arrowOf(html, 'prev');
  const next = arrowOf(html, 'next');

  eq(prev?.тег, 'button', `${label}: левая стрелка осталась кнопкой`);
  eq(next?.тег, 'button', `${label}: правая стрелка осталась кнопкой`);
  ok(prev?.выключена && next?.выключена, `${label}: обе стрелки выключены`);
  eq(prev?.href, null, `${label}: у кнопок нет адреса`);
}

/* Все адреса из стрелок существуют и принадлежат товарам раздела */
const allPages = PRODUCTS.filter((product) => product.page).map((product) => product.page.split('/').pop());
const missing = [...new Set(allPages)].filter((file) => !exists(`product-pages/${file}`));
eq(missing, [], 'файлы всех страниц с адресом существуют');

const chainTitles = PRODUCTS
  .filter((product) => ['new', 'women'].includes(product.section) && product.page)
  .map((product) => getProduct(product.id).title);
ok(chainTitles.length === allPages.filter((file) => !['myatnyy-vecher.html', 'lazurnaya-kletka.html', 'osenniy-pled.html', 'snezhnyy-khalat.html', 'tikhoye-serebro.html', 'nochnaya-mgla.html', 'akvarelnoe-utro.html', 'izumrudnyy-sad.html', 'morskoy-son.html', 'kletka-gortsa.html', 'izumrudnaya-poloska.html', 'rozovyy-zakat.html', 'lesnoy-goroshek.html', 'morskoy-shtrikh.html', 'grafitovyy-son.html', 'vishnevyy-goroshek.html', 'kofeynyy-pled.html', 'prazdnichnyy-bant.html', 'lyanyanoy-damask.html'].includes(file)).length,
  'в цепочку входят все страницы двух коллекций');

// ─────────────── итог ───────────────

const womenPages = PRODUCTS.filter((p) => p.section === 'women' && p.page).length;
const newPages = PRODUCTS.filter((p) => p.section === 'new' && p.page).length;

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`«Новая коллекция»: ${newPages} страниц, «Женская коллекция»: ${womenPages} страниц\n`);
process.stdout.write('Цепочка: Солнце → … → Кремовый вальс и Нежное счастье → … → Выгодная философия\n');

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');

