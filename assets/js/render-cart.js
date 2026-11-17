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

import { formatPrice, plural, assetUrl } from './utils.js';
import { SERVICE_ID, CUSTOM_PRINT_ID } from './cart.js';
import { getPrint, PRINT_PRICE } from './prints.js';

/**
 * Одна позиция корзины.
 *
 * Размер показывается, только если он выбран: на главной товар кладут
 * в корзину без размера, и подпись «Размер: —» выглядела бы ошибкой.
 *
 * У двух особых позиций вместо фотографии — плашка: у услуги «ПРИНТ»
 * надпись, у своего макета иконка файла (файл загружен, но картинки
 * у него ещё нет — её увидит менеджер).
 *
 * @param {object} line позиция с данными товара (см. cart.js: toLine)
 * @returns {string}
 */
export function renderCartItem(line, { printsFree = false } = {}) {
  const { product, qty, size, sum } = line;
  const isService = line.id === SERVICE_ID;
  const isCustom = line.id === CUSTOM_PRINT_ID;
  const isPrint = Boolean(getPrint(line.id));

  /* Цена позиции. У принта она может обнулиться: печать бесплатна, когда
     товаров набралось на порог, — тогда печатаем «бесплатно», а не 0 ₽.
     В снимке заказа сумма уже ноль (так и приходит со страницы
     благодарности), поэтому проверяем и её */
  const price = isCustom
    ? 'по согласованию'
    : (isPrint && (printsFree || sum === 0) ? 'бесплатно' : formatPrice(sum));

  const meta = [
    size ? `Размер: ${size}` : '',
    isService || isCustom || isPrint ? product.subtitle : '',
  ].filter(Boolean).join(' · ');

  /* Файл вынесен отдельной строкой: имя бывает длинным, и в общей подписи
     через точку оно терялось бы */
  const note = isCustom
    ? `<p class="cart__note cart__note--item">Стоимость уточнит менеджер: свяжется с вами отдельно</p>`
    : '';

  const picture = (() => {
    if (isService) return '<div class="cart__image cart__image--service" aria-hidden="true">ПРИНТ</div>';
    if (isCustom) return '<div class="cart__image cart__image--file" aria-hidden="true"></div>';

    /* Принт квадратный: картинка вписывается в квадратную плашку, а не
       обрезается под портрет пижамы */
    if (isPrint) {
      return `<img class="cart__image cart__image--print" src="${assetUrl(product.image)}" alt="${product.alt ?? ''}" width="80" height="80" />`;
    }

    /* Картинку подставляет скрипт, а страница товара лежит на уровень
       глубже корня: assetUrl считает адрес от корня проекта */
    return `<img class="cart__image" src="${assetUrl(product.image)}" alt="${product.alt ?? ''}" width="80" height="107" />`;
  })();

  return `
      <li class="cart__item" data-cart-line="${line.id}" data-cart-size="${size}">
        ${picture}

        <div class="cart__info">
          <p class="cart__title">${product.title}</p>
          ${meta ? `<p class="cart__meta">${meta}</p>` : ''}
          <p class="cart__price">${price}</p>
          ${note}
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
  /* Принты из каталога и услуга «ПРИНТ» — одна и та же печать, поэтому
     показываем их одной строкой и по одному правилу: бесплатно, когда
     товаров набралось на порог */
  const печать = (totals.printQty ?? 0) + (totals.serviceQty ?? 0);
  const печатьБесплатна = печать > 0
    && (totals.printsFree || totals.serviceFree)
    && (totals.prints ?? 0) + (totals.service ?? 0) === 0;

  const печатьRow = печать
    ? `
        <div class="cart__row" data-cart-print-row>
          <span>Печать «ПРИНТ»${печать > 1 ? ` × ${печать}` : ''}</span>
          <span data-cart-print-sum>${печатьБесплатна
            ? 'бесплатно'
            : formatPrice((totals.prints ?? 0) + (totals.service ?? 0))}</span>
        </div>
        ${печатьБесплатна
          ? '<p class="cart__note" data-cart-print-note>Печать бесплатна: сумма товаров дотянула до порога</p>'
          : `<p class="cart__note" data-cart-print-note>До бесплатной печати осталось ${formatPrice(gap)}</p>`}`
    : `
        <p class="cart__note" data-cart-print-note>
          Печать принтов стоит ${formatPrice(PRINT_PRICE)} и бесплатна от
          ${formatPrice(15000)} в товарах
        </p>`;

  return `
      <div class="cart__summary">
        <div class="cart__row">
          <span>Товары</span>
          <span>${formatPrice(totals.products)}</span>
        </div>
        ${печатьRow}
        <div class="cart__total">
          <span>Итого</span>
          <span data-cart-total>${formatPrice(totals.total)}</span>
        </div>
      </div>`;
}

/**
 * Форма оформления внутри окна корзины.
 *
 * Собирается здесь, а не в разметке, по той же причине, что и позиции:
 * показывать её имеет смысл только когда в корзине что-то есть.
 * Проверяет и отправляет её checkout.js — по data-атрибутам.
 *
 * @returns {string}
 */
function renderCheckoutForm() {
  return `
      <form
        class="checkout"
        data-checkout-form
        data-checkout-redirect="thanks-cart.html"
        novalidate
      >
        <h3 class="checkout__title">Оформление</h3>

        <!-- Поля идут перед кнопками: сначала заполняют, потом отправляют.
             Иначе ошибки проверки появлялись бы под кнопкой, ниже полей,
             и нажатие выглядело бы как «ничего не произошло».
             Имя и телефон обязательные — и атрибутом required, и звёздочкой
             в подписи; форма с novalidate, поэтому системных подсказок нет,
             проверяет checkout.js и пишет текст под полем -->
        <div class="checkout__row">
          <label class="checkout__field">
            <span class="checkout__label">
              Имя <span class="checkout__required" aria-hidden="true">*</span>
            </span>
            <input
              class="checkout__input"
              type="text"
              name="name"
              autocomplete="name"
              placeholder="Как к вам обращаться"
              required
              data-checkout-field
              aria-describedby="checkout-error-name"
            />
            <span class="checkout__error" id="checkout-error-name" data-checkout-error="name"></span>
          </label>

          <label class="checkout__field">
            <span class="checkout__label">
              Телефон <span class="checkout__required" aria-hidden="true">*</span>
            </span>
            <input
              class="checkout__input"
              type="tel"
              name="phone"
              autocomplete="tel"
              placeholder="+7 900 000-00-00"
              required
              data-checkout-field
              aria-describedby="checkout-error-phone"
            />
            <span class="checkout__error" id="checkout-error-phone" data-checkout-error="phone"></span>
          </label>
        </div>

        <label class="checkout__field">
          <span class="checkout__label">Почта <span class="checkout__optional">— не обязательно</span></span>
          <input
            class="checkout__input"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="Для чека и связи"
            data-checkout-field
            aria-describedby="checkout-error-email"
          />
          <span class="checkout__error" id="checkout-error-email" data-checkout-error="email"></span>
        </label>

        <div class="checkout__actions">
          <button class="button button--block cart__checkout" type="submit" data-cart-checkout>
            Оформить заказ
          </button>
          <button class="cart__clear" type="button" data-cart-clear>Очистить корзину</button>
        </div>

        <!-- Общая ошибка формы: пустая корзина и подобное -->
        <p class="checkout__error checkout__error--form" data-checkout-error="cart" role="alert"></p>
      </form>`;
}

/**
 * Вся корзина: список позиций, итоги и форма оформления — либо пустое
 * состояние.
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
        <button class="button cart__continue" type="button" data-modal-close>
          Вернуться к покупкам
        </button>
      </div>`;
  }

  return `
      <ul class="cart__list">
        ${lines.map((line) => renderCartItem(line, { printsFree: totals.printsFree })).join('\n')}
      </ul>
      ${renderCartSummary(totals, gap)}
      ${renderCheckoutForm()}`;
}

/**
 * Состав заказа для страницы благодарности: те же позиции, но без кнопок
 * количества и удаления — заказ уже оформлен, менять в нём нечего.
 *
 * @param {Array<object>} lines
 * @param {number} total итог заказа
 * @returns {string}
 */
export function renderOrderLines(lines, total) {
  /* Бесплатная печать в заказе сохранена нулём — печатаем «бесплатно»,
     чтобы цена не выглядела потерянной */
  const price = (line) => (line.sum === 0 && getPrint(line.id) ? 'бесплатно' : formatPrice(line.sum));

  return `
      <ul class="cart__list cart__list--order">
        ${lines.map((line) => `
        <li class="cart__item">
          <div class="cart__info">
            <p class="cart__title">${line.product.title} × ${line.qty}</p>
            ${line.size ? `<p class="cart__meta">Размер: ${line.size}</p>` : ''}
          </div>
          <p class="cart__price">${price(line)}</p>
        </li>`).join('\n')}
      </ul>
      <div class="cart__total">
        <span>Итого</span>
        <span>${formatPrice(total)}</span>
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

