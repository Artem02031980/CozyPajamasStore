/**
 * script.js — ТОЧКА ВХОДА. Единственный скрипт, подключённый к странице:
 *
 *   <script type="module" src="assets/js/script.js"></script>
 *
 * Здесь только импорты и запуск: ни одной строки логики.
 * Что делает каждый модуль:
 *
 *   utils.js     — мелкие помощники: поиск элементов, делегирование, цена
 *   storage.js   — работа с localStorage
 *   header.js    — бургер и меню в шапке
 *   data.js      — каталог товаров
 *   render.js    — отрисовка карточек из данных
 *   filters-query.js — отбор и сортировка товаров
 *   filters.js   — фильтры, сортировка и постраничный показ каталога
 *   cart.js      — логика корзины: состав, количество, итоги
 *   render-cart.js — разметка корзины
 *   cart-ui.js   — кнопки корзины, окно, счётчик в шапке
 *   modal.js     — модальные окна: ESC, фокус, блокировка прокрутки
 *   checkout.js  — оформление заказа                      (в работе)
 *   thanks.js    — страница благодарности                 (в работе)
 *   feedback.js  — форма обратной связи                   (в работе)
 */

import { initHeader } from './header.js';
import { renderCatalog } from './render.js';
import { initFilters } from './filters.js';
import { initModal } from './modal.js';
import { initCart } from './cart-ui.js';

/**
 * Запуск приложения.
 * Скрипт подключён с type="module", поэтому браузер выполняет его после
 * разбора разметки — ждать DOMContentLoaded не нужно.
 */
function init() {
  /* Порядок важен: сначала секции без пагинации, потом женская и мужская.
     initFilters сам рисует первую страницу этих двух секций, поэтому
     renderCatalog их не трогает — иначе одна отрисовка затирала бы другую. */
  renderCatalog();
  initFilters();
  initHeader();
  initModal();
  initCart();
}

init();
