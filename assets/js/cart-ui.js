/**
 * cart-ui.js — связывает корзину со страницей.
 *
 * Здесь события: кнопки «В корзину», шаг количества, удаление позиции,
 * очистка, открытие окна корзины и счётчик в шапке. Логика состава —
 * в cart.js, разметка — в render-cart.js.
 *
 * Перерисовка идёт по одному событию cart:change: любое изменение корзины
 * (с любой кнопки на странице) обновляет и модальное окно, и счётчик,
 * и итог. Иначе пришлось бы после каждого действия руками дёргать
 * три разных места.
 */

import { $, $$, delegate } from './utils.js';
import { openModalByName, close } from './modal.js';
import { CART_CHANGED, SERVICE_ID } from './cart.js';
import * as cart from './cart.js';
import { renderCart } from './render-cart.js';
import { blockWithoutSize } from './size-guard.js';

/** Сколько держать отзыв на кнопке «В корзину», мс. */
const FEEDBACK_MS = 1400;

/** Что было написано на кнопке до отзыва — чтобы вернуть текст. */
const originalLabels = new WeakMap();

/** Таймеры отзыва по кнопкам: повторное нажатие продлевает отзыв. */
const addedTimers = new WeakMap();

/**
 * Условия услуги «ПРИНТ» из разметки.
 *
 * Цена и порог лежат в data-атрибутах у ссылки на каталог принтов: это
 * решение маркетинга, и рядом с текстом их видно. Логика корзины читает
 * их отсюда, а не хранит у себя копию, которая разъедется с разметкой.
 *
 * Ищем по data-print-price, а не по data-cart-add: услугу больше не
 * добавляют кнопкой на главной — принт выбирают в каталоге, — и атрибут
 * действия здесь не нужен, достаточно атрибута с условиями.
 *
 * @returns {{price: number, freeFrom: number}}
 */
function serviceTerms() {
  const source = $('[data-print-price]');
  return cart.getServiceTerms({
    price: source?.dataset.printPrice,
    freeFrom: source?.dataset.printFreeFrom,
  });
}

/** Перерисовывает содержимое модального окна корзины. */
function renderBody() {
  const body = $('[data-cart-body]');
  if (!body) return;

  const terms = serviceTerms();
  const lines = cart.getLines(terms);
  const totals = cart.getTotals(terms, lines);
  const gap = cart.getFreeServiceGap(terms, lines);

  body.innerHTML = renderCart(lines, totals, gap);
}

/** Обновляет счётчик в шапке. */
function renderCounter() {
  const count = cart.getCount();

  $$('[data-cart-counter]').forEach((el) => {
    el.textContent = String(count);
    // Пустую корзину в шапке не прячем: счётчик «0» — это тоже информация
    el.classList.toggle('is-empty', count === 0);
  });
}

/** Обновляет всё, что зависит от состава корзины. */
function refresh() {
  renderCounter();
  renderBody();
}

/**
 * Показывает отзыв на кнопке: подтверждение вместо перехода в корзину.
 *
 * Окно корзины при добавлении не открываем намеренно: человек обычно
 * набирает несколько товаров подряд, и окно после каждого нажатия
 * пришлось бы закрывать. Отзыв на кнопке и счётчик в шапке показывают,
 * что товар добавился.
 *
 * Кнопку не отключаем: повторное нажатие — обычный способ набрать
 * несколько штук, и блокировка на время отзыва съедала бы такие клики.
 *
 * Меняем текст не у самой кнопки, а у её подписи (data-cart-label), если она
 * есть. Присваивание button.textContent стирает всё содержимое кнопки —
 * а внутри бывает иконка (страница товара), и после первого же нажатия она
 * исчезала навсегда. Если подписи нет, работает как раньше: кнопки карточек
 * состоят из одного текста.
 *
 * @param {HTMLButtonElement} button
 */
export function showAdded(button) {
  const label = button.querySelector('[data-cart-label]');
  const target = label ?? button;

  if (!originalLabels.has(button)) originalLabels.set(button, target.textContent.trim());

  target.textContent = 'В корзине';
  button.classList.add('is-added');

  window.clearTimeout(addedTimers.get(button));

  addedTimers.set(button, window.setTimeout(() => {
    target.textContent = originalLabels.get(button);
    button.classList.remove('is-added');
    addedTimers.delete(button);
  }, FEEDBACK_MS));
}

/** Подключает корзину к странице. */
export function initCart() {
  /* Делегирование на document: карточки перерисовываются фильтрами
     и пагинацией, и обработчик на каждой кнопке терялся бы при
     перерисовке. */
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // 1. Добавить товар или услугу
    const addButton = target.closest('[data-cart-add]');
    if (addButton) {
      /* Кнопки карточек помечены data-select-size: размер там не выбран,
         и добавлять без него нельзя. Такие клики обрабатывает
         size-picker.js — он откроет окно выбора размера, а в корзину
         товар попадёт уже с размером */
      if (addButton.hasAttribute('data-select-size')) return;

      /* На странице товара размер выбирают рядом с кнопкой, поэтому без
         него товар не добавляется: показываем «Выберите размер» и ставим
         фокус на ряд размеров (правило — в size-guard.js, включается
         сообщением data-size-error в карточке товара) */
      if (blockWithoutSize(addButton)) return;

      event.preventDefault();
      const id = addButton.dataset.cartAdd;

      cart.addItem(id, { qty: 1, size: addButton.dataset.cartSize ?? '' });
      showAdded(addButton);
      return;
    }

    // 2. Шаг количества в окне корзины
    const stepButton = target.closest('[data-cart-step]');
    if (stepButton) {
      event.preventDefault();
      const line = stepButton.closest('[data-cart-line]');
      if (line) {
        cart.changeQty(line.dataset.cartLine, Number(stepButton.dataset.cartStep), line.dataset.cartSize ?? '');
      }
      return;
    }

    // 3. Удалить позицию
    const removeButton = target.closest('[data-cart-remove]');
    if (removeButton) {
      event.preventDefault();
      const line = removeButton.closest('[data-cart-line]');
      if (line) cart.removeItem(line.dataset.cartLine, line.dataset.cartSize ?? '');
      return;
    }

    // 4. Очистить корзину целиком
    if (target.closest('[data-cart-clear]')) {
      event.preventDefault();
      cart.clear();
    }
  });

  /* Одно событие на все изменения: и от кнопок на странице, и от шага
     количества в окне. cart.js испускает его сам. */
  document.addEventListener(CART_CHANGED, refresh);

  // Кнопка «Корзина» в шапке открывает окно, если оно есть на странице
  const openButton = $('[data-cart-open]');
  if (openButton && $('[data-modal="cart"]')) {
    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      openModalByName('cart');
    });
  }

  refresh();
}

/** Закрыть окно корзины — нужно странице оформления после заказа. */
export { close };
