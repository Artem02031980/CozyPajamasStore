/**
 * filters-query.js — логика отбора товаров: фильтры и сортировка.
 *
 * Чистые функции: на вход товары и то, что выбрано в форме, на выходе
 * новый список. Ни DOM, ни состояния — поэтому её можно запускать
 * в проверках без браузера.
 *
 * Значения фильтров берутся из самой разметки: подпись чипса, aria-label
 * кружка и подпись цены. В data.js теги записаны ровно теми же строками,
 * поэтому сравнение — обычное равенство, без таблиц перевода, которые
 * пришлось бы синхронизировать руками.
 */

/**
 * @typedef {object} Filters
 * @property {string[]} types  выбранные типы изделия
 * @property {string[]} ages   выбранные категории возраста
 * @property {string[]} colors выбранные цвета
 * @property {string[]} prices подписи выбранных диапазонов цены
 */

/** Пустой набор фильтров: ничего не выбрано — показываем всё. */
export function emptyFilters() {
  return { types: [], ages: [], colors: [], prices: [] };
}

/** Выбран ли хоть один фильтр. */
export function hasAnyFilter(filters) {
  return Boolean(
    filters.types.length || filters.ages.length || filters.colors.length || filters.prices.length,
  );
}

/**
 * Разбирает подпись чипса цены в границы диапазона.
 *
 * Формат подписи в разметке: «до 4999₽», «5000 - 9999₽»,
 * «10000 - 14999₽». Числа бывают с пробелом-разделителем разрядов.
 *
 * @param {string} label
 * @returns {{min: number, max: number}|null} null, если это не диапазон цены
 */
export function parsePriceLabel(label) {
  if (!label || !label.includes('₽')) return null;

  const numbers = (label.match(/\d[\d\s\u00a0]*/g) ?? [])
    .map((raw) => Number(raw.replace(/[\s\u00a0]/g, '')))
    .filter(Number.isFinite);

  if (!numbers.length) return null;

  // «до 4999₽» — одно число и слово «до»: верхняя граница без нижней.
  // Граница слова \b здесь не годится: в JavaScript она понимает только
  // латиницу, и после кириллического «до» её просто нет.
  const isUpTo = /^\s*до\s/i.test(label);
  if (isUpTo || numbers.length === 1) {
    return isUpTo
      ? { min: 0, max: numbers[0] }
      : { min: numbers[0], max: numbers[0] };
  }

  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

/**
 * Подходит ли товар выбранным фильтрам.
 *
 * Внутри группы — «или» (Пижама ИЛИ Халатик), между группами — «и»
 * (тип И возраст И цвет И цена). Это обычное поведение фильтров каталога.
 *
 * @param {import('./data.js').Product} product
 * @param {Filters} filters
 * @returns {boolean}
 */
export function matchesFilters(product, filters) {
  const inList = (tags, selected) =>
    !selected.length || (tags ?? []).some((tag) => selected.includes(tag));

  if (!inList(product.types, filters.types)) return false;
  if (!inList(product.ages, filters.ages)) return false;
  if (!inList(product.colors, filters.colors)) return false;

  if (filters.prices.length) {
    const ranges = filters.prices.map(parsePriceLabel).filter(Boolean);
    const hit = ranges.some(({ min, max }) => product.price >= min && product.price <= max);
    if (!hit) return false;
  }

  return true;
}

/** Правила сортировки. Ключ приходит из значения <option> в разметке. */
const SORTERS = {
  /** Порядок каталога — тот, что задан в data.js. */
  default: null,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  'title-asc': (a, b) => a.title.localeCompare(b.title, 'ru'),
};

/**
 * Отбирает и сортирует товары секции.
 *
 * @param {import('./data.js').Product[]} products товары секции
 * @param {Filters} filters
 * @param {string} [sortKey='default'] ключ сортировки
 * @returns {import('./data.js').Product[]}
 */
export function selectProducts(products, filters, sortKey = 'default') {
  const selected = products.filter((product) => matchesFilters(product, filters));
  const sorter = SORTERS[sortKey];

  // slice: sort правит массив на месте, а исходный список трогать нельзя
  return sorter ? selected.slice().sort(sorter) : selected;
}

/** Доступные ключи сортировки — для проверок. */
export const sortKeys = Object.keys(SORTERS);
