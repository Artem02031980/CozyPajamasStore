/**
 * thanks.js — страницы благодарности.
 *
 * Их две, и обе читают своё из хранилища (storage.js):
 *
 *   thanks-cart.html     — состав оформленного заказа;
 *   thanks-feedback.html — вопрос из формы обратной связи.
 *
 * Разметку различает атрибут на <body>: data-page="thanks-cart" или
 * "thanks-feedback". Обе страницы хранят снимок данных, поэтому не зависят
 * от текущего каталога: заказ за прошлый день покажется таким, каким его
 * оформили.
 *
 * Если данных нет — человек открыл страницу напрямую или отправил форму
 * без скрипта, — показываем понятный текст и путь назад, а не пустой экран.
 */

import { $, formatPrice, plural } from './utils.js';
import { readOrder, readMessage } from './storage.js';
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

/**
 * Показывает вопрос из формы обратной связи.
 *
 * Сообщение хранится как есть — показываем его в <p> через textContent,
 * а не через innerHTML: это текст от человека, и разметкой он быть
 * не должен. Переносы строк сохраняет CSS (white-space: pre-line).
 */
export function initThanksFeedback() {
  const body = $('[data-thanks-body]');
  const empty = $('[data-thanks-empty]');
  if (!body) return;

  const message = readMessage();
  const hasMessage = Boolean(message && String(message.question ?? '').trim());

  // Пустое состояние и сообщение взаимоисключающие: показываем что-то одно
  body.classList.toggle('is-hidden', !hasMessage);
  empty?.classList.toggle('is-hidden', hasMessage);

  if (!hasMessage) return;

  const date = $('[data-thanks-date]');
  if (date) {
    const created = new Date(message.createdAt);
    date.textContent = Number.isNaN(created.getTime())
      ? 'Вопрос отправлен'
      : `Отправлено ${created.toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })}, ${created.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }

  const question = $('[data-thanks-question]');
  if (question) question.textContent = String(message.question).trim();
}
