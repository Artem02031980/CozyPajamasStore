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
import { SERVICE_ID, CUSTOM_PRINT_ID, lineKey } from './cart.js';
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
export function renderCartItem(line, { print = null, freeFrom = 15000 } = {}) {
  const { product, qty, size, sum } = line;
  const isService = line.id === SERVICE_ID;
  const isCustom = line.id === CUSTOM_PRINT_ID;
  const isPrint = Boolean(getPrint(line.id));
  const isPrinting = isPrint || isService;

  /* Цена позиции. Бесплатных принтов столько, сколько раз порог уложился
     в сумму товаров, и они раздаются по порядку позиций: в одной позиции
     часть единиц может быть бесплатной, часть — платной. Тогда печатаем
     стоимость платных, а сколько обнулилось — подписью ниже.
     В снимке заказа сумма уже с вычетом, поэтому её тоже уважаем */
  const price = isCustom
    ? 'по согласованию'
    : (isPrinting && (print?.cost === 0 || (print === null && sum === 0))
      ? 'бесплатно'
      : formatPrice(isPrinting && print ? print.cost : sum));

  const meta = [
    size ? `Размер: ${size}` : '',
    isService || isCustom || isPrint ? product.subtitle : '',
  ].filter(Boolean).join(' · ');

  /* Файл вынесен отдельной строкой: имя бывает длинным, и в общей подписи
     через точку оно терялось бы. У печати своя подпись: сколько единиц
     из позиции бесплатны */
  const note = isCustom
    ? `<p class="cart__note cart__note--item">Стоимость уточнит менеджер: свяжется с вами отдельно</p>`
    : (isPrinting && print && print.free > 0
      ? `<p class="cart__note cart__note--item">Бесплатно ${print.free} из ${qty}: по одному принту за каждые ${formatPrice(freeFrom)} в товарах</p>`
      : '');

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
  /* Принты из каталога и услуга «ПРИНТ» — одна и та же печать: одна
     строка в итогах. Бесплатных единиц столько, сколько раз порог
     уложился в сумму товаров, остальные стоят PRINT_PRICE */
  const печать = totals.printQty ?? 0;
  const бесплатно = totals.freePrints ?? 0;

  const подсказка = (() => {
    if (!печать) {
      return `Печать принтов стоит ${formatPrice(totals.printPrice ?? PRINT_PRICE)}
        и бесплатна от ${formatPrice(totals.freeFrom ?? 15000)} в товарах`;
    }

    if (totals.printsFree) {
      return `Печать бесплатна: по одному принту за каждые ${formatPrice(totals.freeFrom ?? 15000)} в товарах`;
    }

    if (бесплатно > 0) {
      return `Бесплатных принтов: ${бесплатно} из ${печать} — по одному за каждые
        ${formatPrice(totals.freeFrom ?? 15000)} в товарах. До следующего
        осталось ${formatPrice(gap)}`;
    }

    return `До бесплатного принта осталось ${formatPrice(gap)}`;
  })();

  const печатьRow = печать
    ? `
        <div class="cart__row" data-cart-print-row>
          <span>Печать «ПРИНТ»${печать > 1 ? ` × ${печать}` : ''}</span>
          <span data-cart-print-sum>${totals.printsFree
            ? 'бесплатно'
            : formatPrice(totals.prints ?? 0)}</span>
        </div>
        <p class="cart__note" data-cart-print-note>${подсказка}</p>`
    : `
        <p class="cart__note" data-cart-print-note>${подсказка}</p>`;

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
        ${lines.map((line) => renderCartItem(line, {
          print: totals.printLines?.[lineKey(line)] ?? null,
          freeFrom: totals.freeFrom,
        })).join('\n')}
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

