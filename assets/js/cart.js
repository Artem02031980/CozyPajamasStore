/**
 * cart.js — логика корзины. Ни одной строки DOM.
 *
 * Модуль считает и меняет состав корзины, а показывает её render-cart.js.
 * Разделение то же, что у фильтров (filters-query.js ↔ filters.js):
 * чистые функции проверяются без браузера и не знают, где именно корзина
 * нарисована — в модальном окне или на странице оформления.
 *
 * Позиция корзины хранит только ссылку на товар и количество:
 *   { id, qty, size }
 * Название, цену и фото берём из data.js по id. Копировать их в хранилище
 * нельзя: поменяется цена в каталоге — в корзине останется старая.
 *
 * Услуга «ПРИНТ» — обычная позиция с id 'print', но по особым правилам:
 * она бесплатна, когда сумма товаров (без неё самой) дотянула до порога.
 * Правила живут здесь, а не в разметке: цена и порог читаются из кнопки,
 * но решение о скидке принимает этот модуль.
 */

import { getProduct } from './data.js';
import { readCart, writeCart, KEYS } from './storage.js';
import { variantKey } from './utils.js';

/** Идентификатор услуги «ПРИНТ». */
export const SERVICE_ID = 'print';

/**
 * Идентификатор позиции «свой макет».
 *
 * Человек загружает файл со своим дизайном, и стоимость такой печати
 * заранее неизвестна: её называет менеджер после просмотра макета.
 * Поэтому позиция идёт с нулевой ценой и пометкой в корзине — она
 * не товар каталога, а заявка.
 */
export const CUSTOM_PRINT_ID = 'print-custom';

/** Имя события, на которое подписывается интерфейс. */
export const CART_CHANGED = 'cart:change';

/**
 * Все позиции корзины в нормальном виде.
 * @returns {Array<{id: string, qty: number, size: string, file: string}>}
 */
export function getItems() {
  return readCart()
    .filter((line) => line && typeof line.id === 'string')
    .map((line) => ({
      id: line.id,
      qty: Math.max(1, Math.round(Number(line.qty) || 1)),
      size: typeof line.size === 'string' ? line.size : '',
      file: typeof line.file === 'string' ? line.file : '',
    }));
}

/** Сколько всего единиц в корзине — для счётчика в шапке. */
export function getCount() {
  return getItems().reduce((sum, line) => sum + line.qty, 0);
}

/**
 * Позиция вместе с данными товара — то, что нужно отрисовать.
 *
 * Услуга «ПРИНТ» товаром каталога не является, поэтому для неё собираем
 * описание на месте: цена и порог приходят из разметки кнопки.
 *
 * @param {{id: string, qty: number, size: string}} line
 * @param {object} [terms] условия услуги — нужны только для позиции «ПРИНТ»
 * @returns {{id: string, qty: number, size: string, product: object, sum: number}|null}
 */
export function toLine(line, terms = getServiceTerms()) {
  if (line.id === SERVICE_ID) {
    return {
      ...line,
      product: {
        id: SERVICE_ID,
        title: 'Услуга «ПРИНТ»',
        subtitle: 'Нанесение принта на выбранную пижаму',
        price: terms.price,
      },
      sum: terms.price * line.qty,
    };
  }

  /* Свой макет: цена неизвестна до просмотра файла, поэтому ноль и пометка
     для корзины — «стоимость уточнит менеджер» */
  if (line.id === CUSTOM_PRINT_ID) {
    return {
      ...line,
      custom: true,
      product: {
        id: CUSTOM_PRINT_ID,
        title: 'Свой макет',
        subtitle: `Файл: ${line.file || 'без имени'}`,
        price: 0,
      },
      sum: 0,
    };
  }

  const product = getProduct(line.id);
  if (!product) return null; // товар убрали из каталога — позицию не показываем

  return { ...line, product, sum: product.price * line.qty };
}

/**
 * Все позиции с данными товара.
 * Позиции, которых больше нет в каталоге, отбрасываются.
 *
 * @param {object} [terms] условия услуги
 * @returns {Array<object>}
 */
export function getLines(terms = getServiceTerms()) {
  return getItems().map((line) => toLine(line, terms)).filter(Boolean);
}

/**
 * Сумма товаров без услуги «ПРИНТ».
 * Именно она решает, бесплатна ли услуга, поэтому считается отдельно.
 * @param {Array<object>} [lines]
 * @returns {number}
 */
export function getProductsTotal(lines = getLines()) {
  return lines
    .filter((line) => line.id !== SERVICE_ID)
    .reduce((sum, line) => sum + line.sum, 0);
}

/** Есть ли в корзине услуга «ПРИНТ». */
export function hasService(lines = getLines()) {
  return lines.some((line) => line.id === SERVICE_ID);
}

/**
 * Условия услуги: цена и порог бесплатной выдачи.
 *
 * Значения приходят из разметки (data-print-price и data-print-free-from
 * у ссылки на каталог принтов): цена и порог — решение маркетинга, а не
 * логики, и в разметке они видны рядом с текстом. Здесь только значения
 * по умолчанию на случай, если атрибутов нет.
 *
 * @param {{price?: string, freeFrom?: string}} [attrs]
 * @returns {{price: number, freeFrom: number}}
 */
export function getServiceTerms(attrs = {}) {
  const price = Number(attrs.price);
  const freeFrom = Number(attrs.freeFrom);

  return {
    price: Number.isFinite(price) && price >= 0 ? price : 500,
    freeFrom: Number.isFinite(freeFrom) && freeFrom > 0 ? freeFrom : 15000,
  };
}

/**
 * Итог корзины: сумма товаров, стоимость услуги и общая сумма.
 *
 * Услуга бесплатна, когда сумма товаров дотянула до порога. Считаем её
 * стоимость нулём, а не вычитаем скидку из итога: так в интерфейсе видно
 * «бесплатно», а не «500 ₽ минус 500 ₽».
 *
 * @param {object} [terms] условия услуги
 * @param {Array<object>} [lines]
 * @returns {{products: number, service: number, serviceFree: boolean,
 *            serviceQty: number, total: number, count: number}}
 */
export function getTotals(terms = getServiceTerms(), lines = getLines()) {
  const products = getProductsTotal(lines);
  const serviceQty = lines
    .filter((line) => line.id === SERVICE_ID)
    .reduce((sum, line) => sum + line.qty, 0);

  const serviceFree = serviceQty > 0 && products >= terms.freeFrom;
  const service = serviceFree ? 0 : serviceQty * terms.price;

  return {
    products,
    service,
    serviceFree,
    serviceQty,
    total: products + service,
    count: lines.reduce((sum, line) => sum + line.qty, 0),
  };
}

/**
 * Сколько не хватает до бесплатной услуги.
 * @param {object} [terms]
 * @param {Array<object>} [lines]
 * @returns {number} 0, если добирать нечего
 */
export function getFreeServiceGap(terms = getServiceTerms(), lines = getLines()) {
  const products = getProductsTotal(lines);
  return Math.max(0, terms.freeFrom - products);
}

/**
 * Добавляет товар или увеличивает количество, если он уже в корзине.
 *
 * @param {string} id идентификатор товара
 * @param {object} [options]
 * @param {number} [options.qty=1]
 * @param {string} [options.size='']
 * @param {string} [options.file=''] имя загруженного макета
 * @returns {Array<object>} новый состав корзины
 */
export function addItem(id, { qty = 1, size = '', file = '' } = {}) {
  /* Услуга «ПРИНТ» и свой макет товарами каталога не являются — у них свои
     правила, поэтому проверка на каталог их не касается. */
  const special = id === SERVICE_ID || id === CUSTOM_PRINT_ID;

  if (!special && !getProduct(id)) {
    console.warn(`[cart] товара «${id}» нет в каталоге`);
    return getItems();
  }

  const items = getItems();
  const key = variantKey(id, size);
  const found = items.find((line) => variantKey(line.id, line.size) === key);

  if (found) {
    /* Новый файл заменяет прошлый: два «своих макета» без размера — это
       одна заявка, и количество у неё всегда одно */
    if (file) found.file = file;
    if (id !== CUSTOM_PRINT_ID) found.qty += Math.max(1, Math.round(qty));
  } else {
    items.push({ id, qty: Math.max(1, Math.round(qty)), size, file });
  }

  return commit(items);
}

/**
 * Меняет количество позиции. Ноль и меньше — позиция удаляется.
 *
 * @param {string} id
 * @param {number} qty
 * @param {string} [size='']
 * @returns {Array<object>}
 */
export function setQty(id, qty, size = '') {
  const key = variantKey(id, size);
  const items = getItems().map((line) =>
    (variantKey(line.id, line.size) === key ? { ...line, qty: Math.round(qty) } : line));

  return commit(items.filter((line) => line.qty > 0));
}

/**
 * Увеличивает или уменьшает количество позиции на шаг.
 *
 * @param {string} id
 * @param {number} [step=1]
 * @param {string} [size='']
 * @returns {Array<object>}
 */
export function changeQty(id, step = 1, size = '') {
  const key = variantKey(id, size);
  const line = getItems().find((item) => variantKey(item.id, item.size) === key);
  if (!line) return getItems();

  return setQty(id, line.qty + step, size);
}

/**
 * Удаляет позицию.
 * @param {string} id
 * @param {string} [size='']
 * @returns {Array<object>}
 */
export function removeItem(id, size = '') {
  const key = variantKey(id, size);
  return commit(getItems().filter((line) => variantKey(line.id, line.size) !== key));
}

/**
 * Очищает корзину.
 * @returns {Array<object>}
 */
export function clear() {
  return commit([]);
}

/**
 * Записывает состав и сообщает об изменении.
 *
 * Событие нужно интерфейсу: счётчик в шапке, список в модальном окне и
 * состав заказа на странице благодарности — разные места, и подписывать
 * каждое на свои кнопки было бы нельзя. Одно событие на изменение корзины
 * держит их согласованными.
 *
 * Проверка на существование document — ради проверок в Node: логику
 * корзины гоняем без браузера, и там события испускать некуда.
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
function commit(items) {
  writeCart(items);

  if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
    document.dispatchEvent(new CustomEvent(CART_CHANGED, { detail: { items } }));
  }

  return items;
}

/** Ключи хранилища — чтобы другие модули не писали их строками. */
export { KEYS };
