/**
 * script.js — ТОЧКА ВХОДА. Единственный скрипт, подключённый к странице:
 *
 *   <script type="module" src="assets/js/script.js"></script>
 *
 * Здесь только импорты и запуск: ни одной строки логики.
 * Что делает каждый модуль:
 *
 *   utils.js       — мелкие помощники: поиск элементов, делегирование, цена
 *   storage.js     — работа с localStorage
 *   header.js      — бургер и меню в шапке
 *   data.js        — каталог товаров
 *   render.js      — отрисовка карточек из данных
 *   filters-query.js — отбор и сортировка товаров
 *   filters.js     — фильтры, сортировка и постраничный показ каталога
 *   cart.js        — логика корзины: состав, количество, итоги
 *   render-cart.js — разметка корзины
 *   cart-ui.js     — кнопки корзины, окно, счётчик в шапке
 *   modal.js       — модальные окна: ESC, фокус, блокировка прокрутки
 *   checkout.js    — форма оформления заказа
 *   thanks.js      — показ заказа и вопроса на страницах благодарности
 *   feedback.js    — форма обратной связи
 *   product.js     — галерея, размеры и услуга на странице товара
 *
 * Какая страница что запускает, решает атрибут data-page на <body>:
 *   home             — каталог, фильтры, корзина, оформление, форма вопроса
 *   product          — галерея, размеры, услуга «ПРИНТ», корзина
 *   thanks-cart      — показ оформленного заказа
 *   thanks-feedback  — показ вопроса из формы обратной связи
 */

import { initHeader } from './header.js';
import { renderCatalog } from './render.js';
import { initFilters } from './filters.js';
import { initModal } from './modal.js';
import { initCart } from './cart-ui.js';
import { initCheckout } from './checkout.js';
import { initThanks, initThanksFeedback } from './thanks.js';
import { initFeedback } from './feedback.js';
import { initProduct } from './product.js';

/**
 * Каталог: секции, фильтры, корзина, оформление и форма вопроса.
 * Скрипт подключён с type="module", поэтому браузер выполняет его после
 * разбора разметки — ждать DOMContentLoaded не нужно.
 */
function initHome() {
  /* Порядок важен: сначала секции без пагинации, потом женская и мужская.
     initFilters сам рисует первую страницу этих двух секций, поэтому
     renderCatalog их не трогает — иначе одна отрисовка затирала бы другую. */
  renderCatalog();
  initFilters();
  initHeader();
  initModal();
  initCart();
  initCheckout();
  initFeedback();
}

/** Страница благодарности за заказ: показывает сохранённый заказ. */
function initThanksCartPage() {
  initHeader();
  initModal();
  initThanks();
}

/** Страница благодарности за вопрос: показывает сохранённое сообщение. */
function initThanksFeedbackPage() {
  initHeader();
  initModal();
  initThanksFeedback();
}

/**
 * Страница товара: галерея, размеры, услуга «ПРИНТ» и корзина.
 * Форма обратной связи на этой странице не выводится, поэтому
 * initFeedback здесь не вызывается.
 */
function initProductPage() {
  initHeader();
  initModal();
  initCart();
  initProduct();
}

/**
 * Запуск приложения.
 *
 * Признак страницы — data-page на <body>. Без него запускаем всё, что
 * относится к каталогу: так страница не сломается, если атрибут забыли.
 */
function init() {
  const page = document.body.dataset.page ?? 'home';

  if (page === 'product') {
    initProductPage();
    return;
  }

  if (page === 'thanks-cart') {
    initThanksCartPage();
    return;
  }

  if (page === 'thanks-feedback') {
    initThanksFeedbackPage();
    return;
  }

  initHome();
}

init();
