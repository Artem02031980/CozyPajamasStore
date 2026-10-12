/**
 * thanks.js — страница благодарности после оформления заказа.
 *
 * Читает сохранённый заказ (storage.js) и показывает его состав.
 * Заказ хранит снимок названий и цен, поэтому страница не зависит
 * от текущего каталога: заказ за прошлый день покажется таким, каким
 * его оформили.
 *
 * Если заказа нет — человек открыл страницу напрямую, — показываем
 * приглашение вернуться в каталог, а не пустой экран.
 */

import { $, formatPrice, plural } from './utils.js';
import { readOrder } from './storage.js';
import { renderOrderLines } from './render-cart.js';

/**
 * Приводит снимок позиций заказа к виду, который ждёт render-cart.js.
 *
 * В заказе позиции плоские ({id, title, price, qty, sum}), а отрисовка
 * ждёт вложенный product — так одна и та же функция рисует и корзину,
 * и состав заказа, и разметка не расходится.
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
function toLines(items) {
  return items.map((item) => ({
    id: item.id,
    qty: item.qty,
    size: item.size,
    sum: item.sum,
    product: {
      id: item.id,
      title: item.title,
      price: item.price,
    },
  }));
}

/** Показывает заказ на странице. */
export function initThanks() {
  const body = $('[data-thanks-body]');
  const empty = $('[data-thanks-empty]');
  if (!body) return;

  const order = readOrder();
  const hasOrder = Boolean(order && Array.isArray(order.items) && order.items.length);

  // Пустое состояние и заказ взаимоисключающие: показываем что-то одно
  body.classList.toggle('is-hidden', !hasOrder);
  empty?.classList.toggle('is-hidden', hasOrder);

  if (!hasOrder) return;

  const number = $('[data-thanks-number]');
  if (number) number.textContent = `Заказ № ${order.number}`;

  const date = $('[data-thanks-date]');
  if (date) {
    const created = new Date(order.createdAt);
    date.textContent = Number.isNaN(created.getTime())
      ? ''
      : created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const greeting = $('[data-thanks-greeting]');
  if (greeting) {
    greeting.textContent = order.customer?.name
      ? `${order.customer.name}, спасибо за заказ!`
      : 'Спасибо за заказ!';
  }

  const summary = $('[data-thanks-summary]');
  if (summary) {
    const { count, total } = order.totals;
    summary.textContent =
      `${count} ${plural(count, 'товар', 'товара', 'товаров')} на ${formatPrice(total)}`;
  }

  const items = $('[data-thanks-items]');
  if (items) items.innerHTML = renderOrderLines(toLines(order.items), order.totals.total);
}
