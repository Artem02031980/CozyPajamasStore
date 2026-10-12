/**
 * storage.js — единственная точка работы с localStorage.
 *
 * Прямых обращений к localStorage в других модулях быть не должно:
 * тогда в одном месте видно, что и под какими ключами хранится, и легко
 * заменить хранилище, не обходя весь проект.
 *
 * Ключи:
 *   cozy-pajamas:cart  — текущая корзина, массив позиций
 *   cozy-pajamas:order — последний оформленный заказ, его читает страница
 *                        благодарности
 */

import { parseJSON } from './utils.js';

/** Ключи хранилища. Вынесены наружу, чтобы модули не писали их строками. */
export const KEYS = {
  cart: 'cozy-pajamas:cart',
  order: 'cozy-pajamas:order',
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
