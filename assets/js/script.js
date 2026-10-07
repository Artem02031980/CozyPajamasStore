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
 *   filters.js   — постраничный показ каталога            (фильтры и сортировка — дальше)
 *   modal.js     — модальные окна                         (в работе)
 *   cart.js      — логика корзины                         (в работе)
 *   checkout.js  — оформление заказа                      (в работе)
 *   thanks.js    — страница благодарности                 (в работе)
 *   feedback.js  — форма обратной связи                   (в работе)
 */

import { initHeader } from './header.js';
import { renderCatalog } from './render.js';
import { initFilters } from './filters.js';

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
}

init();
