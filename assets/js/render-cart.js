/**
 * render-cart.js — разметка корзины: позиции, итоги, пустое состояние.
 *
 * Как и render.js, модуль только собирает HTML из данных: ни событий,
 * ни работы с хранилищем. Логика состава — в cart.js, обработчики — в
 * cart-ui.js. Такое разделение позволяет проверять разметку отдельно
 * и не тянуть DOM в логику.
 *
 * Классы — из blocks/cart.css: он же используется на странице оформления
 * и на странице благодарности, поэтому разметка здесь одна на всех.
 */

import { formatPrice, plural } from './utils.js';
import { SERVICE_ID } from './cart.js';

/**
 * Одна позиция корзины.
 *
 * Размер показывается, только если он выбран: на главной товар кладут
 * в корзину без размера, и подпись «Размер: —» выглядела бы ошибкой.
 *
 * @param {object} line позиция с данными товара (см. cart.js: toLine)
 * @returns {string}
 */
export function renderCartItem(line) {
  const { product, qty, size, sum } = line;
  const isService = line.id === SERVICE_ID;

  const meta = [
    size ? `Размер: ${size}` : '',
    isService ? product.subtitle : '',
  ].filter(Boolean).join(' · ');

  return `
      <li class="cart__item" data-cart-line="${line.id}" data-cart-size="${size}">
        ${isService
          ? '<div class="cart__image cart__image--service" aria-hidden="true">ПРИНТ</div>'
          : `<img class="cart__image" src="${product.image}" alt="${product.alt ?? ''}" width="80" height="107" />`}

        <div class="cart__info">
          <p class="cart__title">${product.title}</p>
          ${meta ? `<p class="cart__meta">${meta}</p>` : ''}
          <p class="cart__price">${formatPrice(sum)}</p>
        </div>

        <div class="quantity">
          <button
            class="quantity__button"
            type="button"
            data-cart-step="-1"
            aria-label="Уменьшить количество"
          >−</button>
          <span class="quantity__value" data-cart-qty>${qty}</span>
          <button
            class="quantity__button"
            type="button"
            data-cart-step="1"
            aria-label="Увеличить количество"
          >+</button>
        </div>

        <button class="cart__remove" type="button" data-cart-remove>Удалить</button>
      </li>`;
}

/**
 * Итоги корзины: сумма товаров, услуга и общая сумма.
 *
 * Когда услуга бесплатна, вместо нуля печатаем «бесплатно»: «0 ₽» читается
 * как ошибка расчёта. Когда платная — подсказываем, сколько осталось
 * добрать до бесплатной.
 *
 * @param {object} totals из cart.js: getTotals
 * @param {number} gap из cart.js: getFreeServiceGap
 * @returns {string}
 */
export function renderCartSummary(totals, gap) {
  const serviceRow = totals.serviceQty
    ? `
        <div class="cart__row">
          <span>Услуга «ПРИНТ»${totals.serviceQty > 1 ? ` × ${totals.serviceQty}` : ''}</span>
          <span>${totals.serviceFree ? 'бесплатно' : formatPrice(totals.service)}</span>
        </div>
        ${totals.serviceFree
          ? '<p class="cart__note">Услуга бесплатна: сумма товаров дотянула до порога</p>'
          : `<p class="cart__note">До бесплатной услуги осталось ${formatPrice(gap)}</p>`}`
    : `
        <p class="cart__note">
          Услугу «ПРИНТ» можно добавить к заказу: она бесплатна от
          ${formatPrice(15000)} в товарах
        </p>`;

  return `
      <div class="cart__summary">
        <div class="cart__row">
          <span>Товары</span>
          <span>${formatPrice(totals.products)}</span>
        </div>
        ${serviceRow}
        <div class="cart__total">
          <span>Итого</span>
          <span data-cart-total>${formatPrice(totals.total)}</span>
        </div>
      </div>`;
}

/**
 * Вся корзина: список позиций и итоги, либо пустое состояние.
 *
 * @param {Array<object>} lines позиции с данными товара
 * @param {object} totals
 * @param {number} gap
 * @returns {string}
 */
export function renderCart(lines, totals, gap) {
  if (!lines.length) {
    return `
      <div class="cart__empty">
        <p>В корзине пока пусто.</p>
        <p class="cart__note">Выберите пижаму в каталоге — она появится здесь.</p>
        <button class="button button--outline cart__continue" type="button" data-modal-close>
          Вернуться к покупкам
        </button>
      </div>`;
  }

  return `
      <ul class="cart__list">
        ${lines.map(renderCartItem).join('\n')}
      </ul>
      ${renderCartSummary(totals, gap)}
      <button class="button button--accent button--block cart__checkout" type="button" data-cart-checkout>
        Оформить заказ
      </button>
      <button class="cart__clear" type="button" data-cart-clear>Очистить корзину</button>`;
}

/**
 * Состав заказа для страницы благодарности: те же позиции, но без кнопок
 * количества и удаления — заказ уже оформлен, менять в нём нечего.
 *
 * @param {Array<object>} lines
 * @param {object} totals
 * @returns {string}
 */
export function renderOrderLines(lines, totals) {
  return `
      <ul class="cart__list cart__list--order">
        ${lines.map((line) => `
        <li class="cart__item">
          <div class="cart__info">
            <p class="cart__title">${line.product.title} × ${line.qty}</p>
            ${line.size ? `<p class="cart__meta">Размер: ${line.size}</p>` : ''}
          </div>
          <p class="cart__price">${formatPrice(line.sum)}</p>
        </li>`).join('\n')}
      </ul>
      <div class="cart__total">
        <span>Итого</span>
        <span>${formatPrice(totals.total)}</span>
      </div>`;
}

/**
 * Подпись со счётчиком: «3 товара». Склонение — через plural из utils.js.
 * @param {number} count
 * @returns {string}
 */
export function renderCountLabel(count) {
  return `${count} ${plural(count, 'товар', 'товара', 'товаров')}`;
}
