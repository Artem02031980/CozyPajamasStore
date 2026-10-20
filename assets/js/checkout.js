/**
 * checkout.js — оформление заказа.
 *
 * Модуль собирает заказ из корзины и данных формы, проверяет поля
 * и сохраняет заказ в хранилище. Показывает заказ страница
 * thanks-cart.html (thanks.js).
 *
 * Проверки вынесены отдельными функциями и не трогают DOM: их гоняют
 * проверки без браузера (checks/checkout.mjs). Модуль только читает
 * значения полей и раскладывает ошибки по разметке.
 *
 * Заказ хранит снимок названий и цен, в отличие от корзины: корзина —
 * это список ссылок на каталог, а заказ — документ. Поменяется цена
 * в каталоге, и заказ за прошлый день не должен переписаться.
 */

import { $, $$, formatPrice } from './utils.js';
import * as cart from './cart.js';
import { writeOrder } from './storage.js';
import { getProduct } from './data.js';

/** Правила проверки полей. */
const RULES = {
  name: {
    test: (value) => value.trim().length >= 2,
    message: 'Укажите имя — как к вам обращаться',
  },
  phone: {
    test: (value) => (value.match(/\d/g) ?? []).length >= 10,
    message: 'Телефон нужен для связи: не меньше 10 цифр',
  },
  email: {
    // Почта необязательна: пустое значение ошибкой не считается
    test: (value) => value.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()),
    message: 'Похоже, в адресе почты опечатка',
  },
};

/**
 * Проверяет одно значение по имени поля.
 *
 * @param {string} field имя поля: name, phone, email
 * @param {string} value
 * @returns {string} текст ошибки или пустая строка
 */
export function validateField(field, value) {
  const rule = RULES[field];
  if (!rule) return '';

  return rule.test(String(value ?? '')) ? '' : rule.message;
}

/**
 * Проверяет все поля формы.
 *
 * @param {object} values значения по именам полей
 * @param {string[]} [fields] какие поля проверять; по умолчанию все из RULES
 * @returns {Record<string, string>} ошибки по полям; пустой объект — всё верно
 */
export function validate(values, fields = Object.keys(RULES)) {
  const errors = {};

  for (const field of fields) {
    const error = validateField(field, values[field]);
    if (error) errors[field] = error;
  }

  return errors;
}

/**
 * Номер заказа: дата и время.
 *
 * Читаемый номер нужен, чтобы человек мог назвать его по телефону:
 * «заказ 202610071832» понятнее, чем случайный набор символов.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function makeOrderNumber(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('');
}

/**
 * Собирает заказ из состава корзины и данных формы.
 *
 * @param {object} values значения формы: name, phone, email, comment
 * @param {object} [options]
 * @param {object} [options.terms] условия услуги «ПРИНТ»
 * @param {Date} [options.date] момент оформления — для проверок
 * @returns {object} заказ
 */
export function buildOrder(values, { terms = cart.getServiceTerms(), date = new Date() } = {}) {
  const lines = cart.getLines(terms);
  const totals = cart.getTotals(terms, lines);

  return {
    number: makeOrderNumber(date),
    createdAt: date.toISOString(),
    customer: {
      name: String(values.name ?? '').trim(),
      phone: String(values.phone ?? '').trim(),
      email: String(values.email ?? '').trim(),
      comment: String(values.comment ?? '').trim(),
    },
    /* Снимок позиций: id для ссылки на товар, название и цена — чтобы
       страница благодарности не зависела от текущего состояния каталога */
    items: lines.map((line) => ({
      id: line.id,
      title: line.product.title,
      price: line.product.price,
      qty: line.qty,
      size: line.size,
      sum: line.sum,
    })),
    totals: {
      products: totals.products,
      service: totals.service,
      serviceFree: totals.serviceFree,
      serviceQty: totals.serviceQty,
      total: totals.total,
      count: totals.count,
    },
  };
}

/**
 * Собирает заказ «в один клик»: один товар со страницы товара, без формы
 * и без корзины.
 *
 * Человек не вводит ни имени, ни телефона — по задумке это покупка одной
 * кнопкой, и страница благодарности показывает «Спасибо за заказ!» без
 * обращения по имени. Корзина не трогается: то, что в ней лежит, остаётся
 * на месте, а заказ сохраняется как отдельный документ.
 *
 * @param {string} productId id товара из data.js
 * @param {object} [options]
 * @param {string} [options.size] выбранный размер
 * @param {Date} [options.date] момент покупки — для проверок
 * @returns {object|null} заказ или null, если товара с таким id нет
 */
export function buildOneClickOrder(productId, { size = '', date = new Date() } = {}) {
  const product = getProduct(productId);
  if (!product) return null;

  const sum = product.price;

  return {
    number: makeOrderNumber(date),
    createdAt: date.toISOString(),
    customer: { name: '', phone: '', email: '', comment: 'Покупка в один клик' },
    items: [{
      id: product.id,
      title: product.title,
      price: product.price,
      qty: 1,
      size: String(size ?? ''),
      sum,
    }],
    /* Услуга «ПРИНТ» в покупку в один клик не попадает: её добавляют
       отдельной кнопкой, и без формы человек её не выбирал */
    totals: {
      products: sum,
      service: 0,
      serviceFree: false,
      serviceQty: 0,
      total: sum,
      count: 1,
    },
  };
}

/**
 * Строка «3 товара на 15 098 ₽» — для подтверждения и проверок.
 * @param {object} order
 * @returns {string}
 */
export function describeOrder(order) {
  const { count, total } = order.totals;
  const mod10 = count % 10;
  const mod100 = count % 100;

  const word = (mod10 === 1 && mod100 !== 11)
    ? 'товар'
    : ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100) ? 'товара' : 'товаров');

  return `${count} ${word} на ${formatPrice(total)}`;
}

/**
 * Читает значения формы.
 * @param {HTMLFormElement} form
 * @returns {Record<string, string>}
 */
export function readValues(form) {
  const values = {};
  $$('input, textarea', form).forEach((field) => {
    if (field.name) values[field.name] = field.value;
  });
  return values;
}

/**
 * Показывает ошибки в разметке: текст под полем и признак у самого поля.
 *
 * @param {HTMLFormElement} form
 * @param {Record<string, string>} errors
 */
function showErrors(form, errors) {
  $$('[data-checkout-field]', form).forEach((field) => {
    const message = errors[field.name] ?? '';
    const box = $(`[data-checkout-error="${field.name}"]`, form);

    if (box) box.textContent = message;
    field.classList.toggle('is-invalid', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  });

  // Фокус — на первое поле с ошибкой: иначе непонятно, что править
  $('.is-invalid', form)?.focus();
}

/** Условия услуги «ПРИНТ» из разметки кнопки. */
function serviceTermsFromPage() {
  const button = $('[data-cart-add="print"]');

  return cart.getServiceTerms({
    price: button?.dataset.printPrice,
    freeFrom: button?.dataset.printFreeFrom,
  });
}

/**
 * Отправляет заказ: проверяет, сохраняет и возвращает его.
 *
 * @param {HTMLFormElement} form
 * @returns {object|null} сохранённый заказ или null, если есть ошибки
 */
export function submitOrder(form) {
  const values = readValues(form);
  const errors = validate(values);

  if (Object.keys(errors).length) {
    showErrors(form, errors);
    return null;
  }

  // Пустая корзина: оформлять нечего — говорим об этом в самой форме
  const terms = serviceTermsFromPage();
  if (!cart.getLines(terms).length) {
    const box = $('[data-checkout-error="cart"]', form);
    if (box) box.textContent = 'Корзина пуста — сначала выберите товары в каталоге';
    return null;
  }

  const order = buildOrder(values, { terms });
  writeOrder(order);
  cart.clear();

  return order;
}

/**
 * Куда идти после оформления.
 *
 * Адрес задаётся атрибутом data-checkout-redirect у формы: страница товара
 * сможет вести на свою страницу благодарности, не переписывая модуль.
 * На главной атрибута нет — берём общий thanks-cart.html.
 *
 * @param {HTMLElement} form
 * @returns {string}
 */
function redirectFrom(form) {
  return form.dataset.checkoutRedirect || 'thanks-cart.html';
}

/**
 * Подключает форму оформления.
 *
 * Слушатели вешаются на document, а не на саму форму: форму создаёт
 * render-cart.js при первой отрисовке корзины, то есть позже запуска.
 * Обработчик, повешенный на форму при старте, не нашёл бы её и не сработал
 * никогда — проверка показала именно это: форма отправлялась, а валидация
 * молчала.
 */
export function initCheckout() {
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLElement) || !form.matches('[data-checkout-form]')) return;

    event.preventDefault();

    const order = submitOrder(form);
    if (order) window.location.href = redirectFrom(form);
  });

  /* Ошибку убираем, как только поле поправили: держать красную рамку
     до следующей отправки — значит ругаться на уже исправленное. */
  document.addEventListener('input', (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || !field.name) return;

    const form = field.closest('[data-checkout-form]');
    if (!form || !field.classList.contains('is-invalid')) return;

    field.classList.remove('is-invalid');
    field.setAttribute('aria-invalid', 'false');

    const box = $(`[data-checkout-error="${field.name}"]`, form);
    if (box) box.textContent = '';
  });
}

/**
 * Куда вести после покупки в один клик.
 *
 * Адрес задаётся атрибутом data-buy-now-redirect у кнопки: страница товара
 * лежит на уровень глубже корня и ведёт на ../thanks-cart.html, а главная
 * смогла бы вести на thanks-cart.html. Без атрибута берём адрес для корня.
 *
 * @param {HTMLElement} button
 * @returns {string}
 */
function buyNowRedirectFrom(button) {
  return button.dataset.buyNowRedirect || 'thanks-cart.html';
}

/**
 * Показывает или скрывает сообщение «Выберите размер».
 *
 * Где искать сообщение и что именно проверять, решает разметка, а не модуль:
 * если рядом с кнопкой есть элемент с data-buy-now-error, значит для этой
 * кнопки размер обязателен, и текст ошибки лежит в этом элементе. Так модуль
 * не знает ни про размеры, ни про то, как они называются на странице.
 *
 * @param {HTMLElement} trigger кнопка «Купить в один клик»
 * @param {boolean} show
 * @returns {boolean} true, если сообщение найдено
 */
function toggleBuyNowError(trigger, show) {
  const scope = trigger.closest('article') ?? document;
  const box = scope.querySelector('[data-buy-now-error]');
  if (!box) return false;

  box.hidden = !show;
  return true;
}

/**
 * Подключает кнопки «Купить в один клик».
 *
 * Покупка сразу становится заказом: он сохраняется в хранилище, и человек
 * попадает на страницу благодарности с составом и суммой. Корзина не
 * используется вовсе — ни добавляется в неё товар, ни очищается: то, что
 * человек складывал раньше, остаётся на месте.
 *
 * Если у кнопки есть сообщение об ошибке в разметке, покупка без размера
 * не проходит: вместо перехода показывается «Выберите размер» и фокус
 * уходит на ряд размеров. Иначе в заказ ушла бы позиция без размера,
 * а человек даже не заметил бы, что не выбрал.
 *
 * Проект учебный, поэтому заказ создаётся без имени и телефона и никто
 * ни с кем не связывается — страница благодарности об этом честно
 * предупреждает.
 *
 * Слушатель на document, как и у формы: кнопка может появиться на любой
 * странице, и вешать обработчик на каждую не нужно.
 */
export function initBuyNow() {
  document.addEventListener('click', (event) => {
    const button = event.target;
    if (!(button instanceof Element)) return;

    const trigger = button.closest('[data-buy-now]');
    if (!trigger) return;

    event.preventDefault();

    const size = trigger.dataset.cartSize ?? '';
    const scope = trigger.closest('article') ?? document;

    /* Размер обязателен только там, где в разметке есть сообщение.
       Проверяем до сборки заказа: заказ с пустым размером уже нельзя
       отличить от заказа товара, у которого размеров нет */
    const sizeRequired = Boolean(scope.querySelector('[data-buy-now-error]'));

    if (sizeRequired && !size) {
      toggleBuyNowError(trigger, true);

      /* Фокус на первый размер: сообщение объясняет, что делать, а фокус
         избавляет от поиска ряда с размерами */
      scope.querySelector('[data-product-size]')?.focus();

      return;
    }

    const order = buildOneClickOrder(trigger.dataset.buyNow, { size });
    if (!order) return;

    toggleBuyNowError(trigger, false);
    writeOrder(order);
    window.location.href = buyNowRedirectFrom(trigger);
  });
}
