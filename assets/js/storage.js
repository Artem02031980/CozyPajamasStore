/**
 * storage.js — единственная точка работы с хранилищем браузера.
 *
 * Прямых обращений к localStorage и sessionStorage в других модулях быть
 * не должно: тогда в одном месте видно, что и под какими ключами хранится,
 * и легко заменить хранилище, не обходя весь проект.
 *
 * localStorage — то, что переживает закрытие браузера:
 *   cozy-pajamas:cart    — текущая корзина, массив позиций
 *   cozy-pajamas:order   — последний оформленный заказ, его читает страница
 *                          благодарности
 *   cozy-pajamas:message — последний вопрос из формы обратной связи, его
 *                          читает thanks-feedback.html
 *
 * sessionStorage — то, что нужно только текущей вкладке и только до её
 * закрытия:
 *   cozy-pajamas:pages   — на какой странице каталога стоял человек,
 *                          по секциям ({women: 2, men: 1})
 */

import { parseJSON } from './utils.js';

/** Ключи хранилища. Вынесены наружу, чтобы модули не писали их строками. */
export const KEYS = {
  cart: 'cozy-pajamas:cart',
  order: 'cozy-pajamas:order',
  message: 'cozy-pajamas:message',
  pages: 'cozy-pajamas:pages',
};

/**
 * Доступ к localStorage.
 * В приватном режиме браузера или при запрете хранилища обращение может
 * выбросить исключение — тогда возвращаем null, и вызывающий код работает
 * как с пустым хранилищем.
 * @returns {Storage|null}
 */
function storage() {
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('[storage] localStorage недоступен', error);
    return null;
  }
}

/**
 * Прочитать корзину.
 * @returns {Array<object>} массив позиций; пустой массив, если данных нет
 */
export function readCart() {
  const store = storage();
  if (!store) return [];

  const value = parseJSON(store.getItem(KEYS.cart), []);
  return Array.isArray(value) ? value : [];
}

/**
 * Записать корзину целиком.
 * @param {Array<object>} items
 */
export function writeCart(items) {
  const store = storage();
  if (!store) return;

  try {
    store.setItem(KEYS.cart, JSON.stringify(Array.isArray(items) ? items : []));
  } catch (error) {
    console.error('[storage] Не удалось сохранить корзину', error);
  }
}

/** Удалить корзину из хранилища. */
export function clearCart() {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(KEYS.cart);
  } catch (error) {
    console.error('[storage] Не удалось очистить корзину', error);
  }
}

/**
 * Прочитать последний заказ.
 *
 * Массив заказом не считается: typeof [] тоже 'object', и без отдельной
 * проверки в хранилище вместо заказа вернулся бы список. Читающая сторона
 * ждёт объект с полями, и падала бы уже на них.
 *
 * @returns {object|null}
 */
export function readOrder() {
  const store = storage();
  if (!store) return null;

  const value = parseJSON(store.getItem(KEYS.order), null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return value;
}

/**
 * Сохранить заказ — его покажет страница благодарности.
 * @param {object} order
 */
export function writeOrder(order) {
  const store = storage();
  if (!store) return;

  try {
    store.setItem(KEYS.order, JSON.stringify(order));
  } catch (error) {
    console.error('[storage] Не удалось сохранить заказ', error);
  }
}

/** Удалить сохранённый заказ. */
export function clearOrder() {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(KEYS.order);
  } catch (error) {
    console.error('[storage] Не удалось удалить заказ', error);
  }
}

/**
 * Прочитать последний вопрос из формы обратной связи.
 *
 * Массив сообщением не считается — по той же причине, что и у заказа:
 * typeof [] тоже 'object', и без проверки читающая сторона получила бы
 * список вместо объекта с полями.
 *
 * @returns {object|null} { question, createdAt }
 */
export function readMessage() {
  const store = storage();
  if (!store) return null;

  const value = parseJSON(store.getItem(KEYS.message), null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return value;
}

/**
 * Сохранить вопрос — его покажет страница благодарности.
 * @param {object} message
 */
export function writeMessage(message) {
  const store = storage();
  if (!store) return;

  try {
    store.setItem(KEYS.message, JSON.stringify(message));
  } catch (error) {
    console.error('[storage] Не удалось сохранить сообщение', error);
  }
}

/** Удалить сохранённое сообщение. */
export function clearMessage() {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(KEYS.message);
  } catch (error) {
    console.error('[storage] Не удалось удалить сообщение', error);
  }
}

/**
 * Доступ к sessionStorage.
 *
 * Отдельно от localStorage: страницы каталога нужны только текущей вкладке.
 * Открыв сайт в новой вкладке, человек ожидает увидеть каталог с начала,
 * а не чужую вторую страницу. В приватном режиме обращение может выбросить
 * исключение — тогда работаем как с пустым хранилищем.
 *
 * @returns {Storage|null}
 */
function session() {
  try {
    return window.sessionStorage;
  } catch (error) {
    console.warn('[storage] sessionStorage недоступен', error);
    return null;
  }
}

/**
 * Прочитать, на каких страницах каталога стоял человек.
 *
 * Нужно, чтобы случайная перезагрузка страницы (её делает и сам браузер,
 * выгружая вкладку из памяти) не отбрасывала человека с середины каталога
 * в самое начало: страница каталога живёт в JS, и без записи она теряется.
 *
 * @returns {Record<string, number>} например {women: 2, men: 3}
 */
export function readPages() {
  const store = session();
  if (!store) return {};

  const value = parseJSON(store.getItem(KEYS.pages), {});
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  /* В хранилище могло попасть что угодно: оставляем только пары
     «секция — положительное число», иначе мусор уедет в номер страницы */
  const pages = {};
  for (const [section, page] of Object.entries(value)) {
    const number = Number(page);
    if (Number.isInteger(number) && number > 0) pages[section] = number;
  }

  return pages;
}

/**
 * Запомнить, на какой странице каталога стоит человек.
 * @param {Record<string, number>} pages
 */
export function writePages(pages) {
  const store = session();
  if (!store) return;

  try {
    store.setItem(KEYS.pages, JSON.stringify(pages));
  } catch (error) {
    console.error('[storage] Не удалось сохранить страницы каталога', error);
  }
}
