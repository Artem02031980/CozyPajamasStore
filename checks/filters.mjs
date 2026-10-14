#!/usr/bin/env node
/**
 * Проверка логики фильтров и сортировки: filters-query.js плюс теги в data.js.
 *
 * Логика отбора отделена от DOM именно для этого: её можно прогнать
 * без браузера, целиком, за доли секунды. Раньше такие проверки писались
 * под каждую правку заново — теперь они лежат рядом с кодом.
 *
 * Запуск: node checks/filters.mjs
 */

import { readFileSync } from 'node:fs';
import {
  emptyFilters, hasAnyFilter, parsePriceLabel, matchesFilters, selectProducts, sortKeys,
} from '../assets/js/filters-query.js';
import { getProducts, PRODUCTS } from '../assets/js/data.js';

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

const women = getProducts('women');
const men = getProducts('men');
const both = [...women, ...men];
const titles = (list) => list.map((p) => p.title);

// ─────────────── разбор подписей цены ───────────────

eq(parsePriceLabel('до 4999₽'), { min: 0, max: 4999 }, 'цена: «до 4999₽»');
eq(parsePriceLabel('5000 - 9999₽'), { min: 5000, max: 9999 }, 'цена: «5000 - 9999₽»');
eq(parsePriceLabel('10000 - 14999₽'), { min: 10000, max: 14999 }, 'цена: «10000 - 14999₽»');
eq(parsePriceLabel('15 000 - 19 999₽'), { min: 15000, max: 19999 }, 'цена с пробелом в разрядах');
eq(parsePriceLabel('Пижама'), null, 'не цена: обычный чипс');
eq(parsePriceLabel(''), null, 'не цена: пустая подпись');

// ─────────────── теги в данных ───────────────

const noTags = both.filter((p) => !p.types?.length || !p.ages?.length || !p.colors?.length);
eq(noTags.map((p) => p.id), [], 'у всех товаров women и men есть теги типов, возрастов и цветов');

// Теги должны совпадать с подписями чипсов в разметке: иначе фильтр молча не сработает
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const chipLabels = [...html.matchAll(/class="filters__chip"[^>]*>([^<]+)</g)].map((m) => m[1].trim());
const colorLabels = [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
const productTags = new Set(both.flatMap((p) => [...p.types, ...p.ages, ...p.colors]));
const orphan = [...productTags].filter((tag) => !chipLabels.includes(tag) && !colorLabels.includes(tag));
eq(orphan, [], 'каждый тег товара имеет чипс или кружок в разметке');

/* Теги проверяем против чипсов СВОЕЙ секции, а не всей страницы.
   У женской и мужской коллекций наборы формулировок разные («Для юных дам»
   против «Для молодых людей»), и общая проверка пропустила бы мужской тег
   с женской подписью: чипс на странице есть, но не в этой секции — и фильтр
   молча не сработал бы. */
const labelsIn = (sectionClass) => {
  const formHtml = html.match(
    new RegExp(`<form[^>]*id="goods-${sectionClass}-filters"[\\s\\S]*?</form>`),
  )?.[0] ?? '';
  /* Группы берём по отдельности: чипсы типов, возрастов и цены лежат
     в разных <div class="filters__group">, и проверять их надо порознь —
     иначе диапазон цены попадёт в проверку возрастов. */
  const groups = [...formHtml.matchAll(
    /<div class="filters__group">([\s\S]*?)<\/div>/g,
  )].map((m) => m[1]);
  const chipsIn = (group = '') =>
    [...group.matchAll(/class="filters__chip"[^>]*>([^<]+)</g)].map((m) => m[1].trim());

  return {
    chips: chipsIn(formHtml),
    types: chipsIn(groups[0]),
    ages: chipsIn(groups[1]),
    colors: [...formHtml.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]),
  };
};

for (const [section, list] of [['women', women], ['men', men]]) {
  const own = labelsIn(section);
  const wrong = [];
  for (const p of list) {
    for (const tag of [...p.types, ...p.ages]) {
      if (!own.chips.includes(tag)) wrong.push(`${p.id}: ${tag}`);
    }
    for (const color of p.colors) {
      if (!own.colors.includes(color)) wrong.push(`${p.id}: цвет ${color}`);
    }
  }
  eq(wrong, [], `теги секции ${section} совпадают с чипсами этой же секции`);

  /* У каждого чипса возраста должны быть товары: в макете возрастов ровно
     три, все три осмысленные. Пустой чипс возраста — признак того, что тег
     в данных переименовали, а разметку не тронули.

     Чипсы цены в проверку не входят: это готовые диапазоны из макета,
     и пустой диапазон («15000 - 19999₽») — норма. Чипсы типов, которых нет
     в каталоге («Пеньюар», «Футболка»), тоже оставлены как в макете,
     поэтому у типов проверяем только одностороннюю связь. */
  const emptyAgeChips = own.ages.filter((chip) => !list.some((p) => p.ages.includes(chip)));
  eq(emptyAgeChips, [], `в секции ${section} каждый чипс возраста обеспечен товарами`);

  const unlabeledTypes = [...new Set(list.flatMap((p) => p.types))]
    .filter((type) => !own.types.includes(type));
  eq(unlabeledTypes, [], `в секции ${section} каждый тип из данных имеет свой чипс`);
}

// ─────────────── фильтры ───────────────

const withTypes = (types) => ({ ...emptyFilters(), types });
const withAges = (ages) => ({ ...emptyFilters(), ages });
const withColors = (colors) => ({ ...emptyFilters(), colors });
const withPrices = (prices) => ({ ...emptyFilters(), prices });

eq(hasAnyFilter(emptyFilters()), false, 'пустой набор фильтров ничего не выбирает');
eq(hasAnyFilter(withTypes(['Пижама'])), true, 'непустой набор считается выбранным');

eq(selectProducts(women, emptyFilters()).length, 9, 'без фильтров видны все 9 товаров секции');
eq(selectProducts(women, withTypes(['Халатик'])).map((p) => p.title),
  ['Розовые поля', 'Спокойный сон III'], 'тип «Халатик» в женской коллекции');
eq(selectProducts(men, withTypes(['Халатик'])).map((p) => p.title),
  ['Белый халат', 'Облачный халат'], 'тип «Халатик» в мужской коллекции');
eq(selectProducts(women, withTypes(['Свитшот'])).map((p) => p.title),
  ['Тёмная ночь V'], 'тип «Свитшот»');

// Внутри группы — «или»
eq(selectProducts(women, withTypes(['Свитшот', 'Топ'])).map((p) => p.title),
  ['Розовые поля', 'Тёмная ночь V'], 'два типа в одной группе складываются');

// Цвета
eq(selectProducts(both, withColors(['Зелёный'])).map((p) => p.title),
  ['Изумрудный вечер'], 'цвет «Зелёный»');
eq(selectProducts(both, withColors(['Серый'])).map((p) => p.title),
  ['Морская дымка'], 'цвет «Серый»');
eq(selectProducts(both, withColors(['Розовый'])).length, 5, 'цвет «Розовый» — 5 товаров');
eq(selectProducts(both, withColors(['Белый'])).length, 9, 'цвет «Белый» — 9 товаров');
eq(selectProducts(both, withColors(['Мятный'])).map((p) => p.title),
  ['Мятный вечер'], 'цвет «Мятный» — новый кружок в палитре');

// Между группами — «и»
eq(selectProducts(both, { ...emptyFilters(), colors: ['Розовый'], ages: ['Для девушек'] })
  .map((p) => p.title),
  ['Клубичные поля', 'Розовые поля', 'Нетленная классика II'], 'цвет И возраст вместе');

// Цена
// Порядок — каталога, а не по возрастанию: фильтр не сортирует
eq(selectProducts(both, withPrices(['до 4999₽'])).map((p) => p.price),
  [3999, 4199, 2799, 4599, 4999], 'цена до 4999₽ — 5 товаров');
eq(selectProducts(both, withPrices(['5000 - 9999₽'])).length, 11, 'цена 5000–9999₽ — 11 товаров');
eq(selectProducts(both, withPrices(['10000 - 14999₽'])).map((p) => p.title),
  ['Клубичные поля', 'Розовые поля'], 'цена 10000–14999₽');
eq(selectProducts(both, withPrices(['15000 - 19999₽'])), [], 'цена 15000–19999₽ — пусто, как в разметке');

// Комбинация, дающая пустой результат: фильтры не должны «сходить с ума»
eq(selectProducts(both, { ...emptyFilters(), types: ['Свитшот'], colors: ['Зелёный'] }), [],
  'несовместимые условия дают пустой список');

// ─────────────── сортировка ───────────────

eq(sortKeys, ['default', 'price-asc', 'price-desc', 'title-asc'], 'набор ключей сортировки');

const asc = selectProducts(women, emptyFilters(), 'price-asc').map((p) => p.price);
eq(asc, [...asc].sort((a, b) => a - b), 'сортировка по возрастанию цены');
const desc = selectProducts(women, emptyFilters(), 'price-desc').map((p) => p.price);
eq(desc, [...desc].sort((a, b) => b - a), 'сортировка по убыванию цены');
eq(selectProducts(women, emptyFilters(), 'default').map((p) => p.title), titles(women),
  'по умолчанию порядок каталога сохраняется');
eq(selectProducts(women, emptyFilters(), 'title-asc')[0].title, 'Клубичные поля',
  'сортировка по названию: первая по алфавиту');
eq(selectProducts(women, emptyFilters(), 'unknown-key').map((p) => p.title), titles(women),
  'неизвестный ключ сортировки не ломает порядок');

// Сортировка не должна трогать исходный массив
const before = titles(women);
selectProducts(women, emptyFilters(), 'price-desc');
eq(titles(women), before, 'исходный порядок товаров не меняется сортировкой');
eq(titles(getProducts('women')), before, 'порядок в data.js не меняется сортировкой');

// ─────────────── «Новая коллекция»: чередование, пары и картинки ───────

/* В «Новой коллекции» три женские карточки и три мужские, и они стоят
   вперемешку: 1/3/5 — женские на розовых позициях, 2/4/6 — мужские на
   серо-голубых. От позиции зависят три вещи: фон (goods-new.css),
   цвет названия и цвет кнопки (тег titleColor). Все три обязаны совпадать,
   иначе пижама окажется на чужом фоне или кнопка получит чужой цвет.

   Пол берём из проверочной таблицы по имени файла, а не из подписи:
   подпись — это текст, который мы же и правим, и опираться на неё в
   проверке нельзя. Таблица составлена просмотром картинок. */
const newItems = getProducts('new');
eq(newItems.length, 6, 'в новой коллекции шесть товаров');

/** Кто на картинке — установлено просмотром файлов, а не по подписям. */
const FILE_SEX = {
  'new_01.png': 'F', 'new_02.png': 'F', 'new_06.png': 'F',
  'new_03.png': 'M', 'new_04.png': 'M', 'new_05.png': 'M',
};

/** Кого ждёт позиция: нечётные — женские (розовые), чётные — мужские. */
const EXPECTED_SEX = ['F', 'M', 'F', 'M', 'F', 'M'];
const COLOUR_OF_SEX = { F: 'pink', M: 'blue' };

const fileName = (product) => product.image.split('/').pop();
const expectedColour = (position) => (position % 2 === 0 ? 'blue' : 'pink');

/* Все шесть файлов должны быть задействованы и не повторяться.
   Сравниваем отсортированные списки: порядок файлов по позициям —
   не то, что здесь проверяется. */
eq([...newItems.map(fileName)].sort(), Object.keys(FILE_SEX).slice().sort(),
  'каждый файл новой коллекции использован ровно один раз');

eq(newItems.map((p) => FILE_SEX[fileName(p)]), EXPECTED_SEX,
  'файлы разложены по позициям: женские на 1/3/5, мужские на 2/4/6');

/* Цвет карточки: у каждой позиции — свой, и он же определяет цвет кнопки.
   Тег обязателен у всех шести: без него карточка наследует button--pink
   и её кнопка при наведении чернеет от правила .button--pink:hover. */
eq(newItems.map((p) => p.titleColor), newItems.map((_, i) => expectedColour(i + 1)),
  'цвет задан у всех шести карточек и чередуется по позиции');

eq(newItems.map((p) => p.titleColor === COLOUR_OF_SEX[FILE_SEX[fileName(p)]]),
  [true, true, true, true, true, true],
  'цвет карточки совпадает с полом на её картинке');

/* Размеры в данных должны совпадать с файлами: они были сдвинуты вместе
   с привязкой картинок, и width/height не совпадали с реальными. */
const sizeMismatch = newItems.filter((p) => {
  const bytes = readFileSync(new URL(`../assets/images/products/new/${fileName(p)}`, import.meta.url));
  const isPng = bytes.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (!isPng) return false;
  return bytes.readUInt32BE(16) !== p.width || bytes.readUInt32BE(20) !== p.height;
});
eq(sizeMismatch.map((p) => p.id), [],
  'ширина и высота в данных совпадают с файлами картинок');

/* Цвет кнопки задаёт тег titleColor, и он должен быть у каждого товара
   секции с фильтрами: без тега кнопка получает класс button--pink, у
   которого своё правило :hover с тёмным фоном, и розовая кнопка при
   наведении чернеет. Секции красятся по покупателю: женская розовая,
   мужская серо-голубая — как соответствующие карточки «Новой коллекции». */
const SECTION_COLOUR = { women: 'pink', men: 'blue' };
for (const [section, colour] of Object.entries(SECTION_COLOUR)) {
  const list = getProducts(section);
  eq([...new Set(list.map((p) => p.titleColor))], [colour],
    `у всех товаров секции ${section} задан цвет карточки «${colour}»`);
}

eq([...new Set([...women, ...men].map((p) => p.titleColor))].sort(), ['blue', 'pink'],
  'в каталоге встречаются оба цвета кнопок');

// «Другие товары» без тега: там кнопка остаётся базовой розовой
eq(getProducts('other').filter((p) => p.titleColor).map((p) => p.id), [],
  'в «Других товарах» цвет не задан — кнопки остаются как были');

// ─────────────── картинки: пути и размеры ───────────────

/* После переименования папок (men/01.png → m01.png, картинки «Других
   товаров» разъехались по папкам типов) главный риск — старый путь
   в данных: карточка тогда молча показывает пустое место. */
const brokenImages = PRODUCTS.filter((p) => {
  try {
    readFileSync(new URL(`../${p.image}`, import.meta.url));
    return false;
  } catch {
    return true;
  }
});
eq(brokenImages.map((p) => `${p.id} → ${p.image}`), [],
  'у всех товаров картинка существует по указанному пути');

const sizeMismatchAll = PRODUCTS.filter((p) => {
  const bytes = readFileSync(new URL(`../${p.image}`, import.meta.url));
  const isPng = bytes.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (!isPng) return false;
  return bytes.readUInt32BE(16) !== p.width || bytes.readUInt32BE(20) !== p.height;
});
eq(sizeMismatchAll.map((p) => p.id), [],
  'ширина и высота в данных совпадают с файлами картинок');

// ─────────────── сводка по чипсам ───────────────

const coverageTypes = [...new Set(both.flatMap((p) => p.types))]
  .map((type) => `${type}:${selectProducts(both, withTypes([type])).length}`).sort();
const coverageColors = [...new Set(both.flatMap((p) => p.colors))]
  .map((color) => `${color}:${selectProducts(both, withColors([color])).length}`).sort();

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Товаров в каталоге: ${PRODUCTS.length} (women ${women.length}, men ${men.length})\n`);
process.stdout.write(`Типы: ${coverageTypes.join(', ')}\n`);
process.stdout.write(`Цвета: ${coverageColors.join(', ')}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((f) => process.stdout.write(`  FAIL ${f}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
