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
 *   checkout.js    — форма оформления заказа и покупка в один клик
 *   thanks.js      — показ заказа и вопроса на страницах благодарности
 *   feedback.js    — форма обратной связи
 *   product.js     — размеры и выбор файла макета на странице товара
 *   size-picker.js — выбор размера в окне перед добавлением в корзину
 *   footer-year.js — год в подписи подвала страниц товаров
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
import { initSizePicker } from './size-picker.js';
import { initCheckout, initBuyNow } from './checkout.js';
import { initThanks, initThanksFeedback } from './thanks.js';
import { initFeedback } from './feedback.js';
import { initProduct, initPrintFileUpload } from './product.js';
import { initFooterYear } from './footer-year.js';
import { renderPrints } from './render-prints.js';

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
  /* После initCart: кнопки карточек помечены data-select-size, cart-ui
     такие клики пропускает, а окно выбора размера их перехватывает */
  initSizePicker();
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
 * Страница товара: размеры, выбор файла макета, корзина и покупка в один клик.
 * Форма обратной связи на этой странице не выводится, поэтому
 * initFeedback здесь не вызывается.
 */
function initProductPage() {
  initHeader();
  initModal();
  initCart();
  initProduct();
  initBuyNow();
}

/**
 * Каталог принтов — пока заглушка: свёрстано только окружение страницы
 * (шапка с меню и счётчиком, окно корзины), самого каталога нет.
 * Когда он появится, сюда добавятся его модули — как initFilters на главной.
 */
function initPrintsPage() {
  initHeader();
  initModal();
  initCart();
  /* Карточки принтов рисуются из prints.js: у всех 17 разметка одинаковая */
  renderPrints();
  /* «Добавить свой макет» в шапке страницы: проверка формата и позиция
     «Свой макет» в корзине. Тот же модуль, что на странице товара,
     только со своими классами пометки */
  initPrintFileUpload({ block: 'prints__upload-note' });
}

/**
 * Запуск приложения.
 *
 * Признак страницы — data-page на <body>. Без него запускаем всё, что
 * относится к каталогу: так страница не сломается, если атрибут забыли.
 */
function init() {
  /* Год в подвале: нужен и страницам товаров, и любым другим, где
     появится маркер data-copyright-year, поэтому запускается до выбора
     набора скриптов */
  initFooterYear();

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

  if (page === 'prints') {
    initPrintsPage();
    return;
  }

  initHome();
}

init();



