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
 *   thanks.js      — показ заказа на странице благодарности
 *   feedback.js    — форма обратной связи                  (в работе)
 *
 * Какая страница что запускает, решает атрибут data-page на <body>:
 *   home          — каталог, фильтры, корзина, оформление
 *   thanks-cart   — показ оформленного заказа
 */

import { initHeader } from './header.js';
import { renderCatalog } from './render.js';
import { initFilters } from './filters.js';
import { initModal } from './modal.js';
import { initCart } from './cart-ui.js';
import { initCheckout } from './checkout.js';
import { initThanks } from './thanks.js';

/**
 * Каталог: секции, фильтры, корзина и оформление.
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
}

/** Страница благодарности: показывает сохранённый заказ. */
function initThanksPage() {
  initHeader();
  initModal();
  initThanks();
}

/**
 * Запуск приложения.
 *
 * Признак страницы — data-page на <body>. Без него запускаем всё, что
 * относится к каталогу: так страница не сломается, если атрибут забыли.
 */
function init() {
  const page = document.body.dataset.page ?? 'home';

  if (page === 'thanks-cart') {
    initThanksPage();
    return;
  }

  initHome();
}

init();
