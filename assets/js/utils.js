/**
 * utils.js — мелкие помощники, общие для всех модулей.
 *
 * Здесь только чистые функции и работа с DOM. Никакой логики корзины,
 * каталога и фильтров — она живёт в своих модулях.
 */

/**
 * Найти один элемент.
 * @param {string} selector
 * @param {ParentNode} [scope=document] где искать
 * @returns {Element|null}
 */
export function $(selector, scope = document) {
  return scope.querySelector(selector);
}

/**
 * Найти все элементы. Возвращает настоящий массив, а не NodeList:
 * с ним работают map, filter и forEach без преобразований.
 * @param {string} selector
 * @param {ParentNode} [scope=document]
 * @returns {Element[]}
 */
export function $$(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

/**
 * Подписка на события через делегирование: один обработчик на контейнер
 * вместо обработчика на каждой карточке или кнопке.
 *
 * Нужно потому, что карточки товаров будет создавать JavaScript, и вешать
 * на каждую свой обработчик — значит заново подписываться после каждой
 * перерисовки каталога.
 *
 * @param {EventTarget} root контейнер, который не перерисовывается
 * @param {string} type тип события, например 'click'
 * @param {string} selector селектор цели внутри контейнера
 * @param {(event: Event, target: Element) => void} handler
 * @returns {() => void} функция отписки
 */
export function delegate(root, type, selector, handler) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target) handler(event, target);
  };

  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

/**
 * Ограничитель частоты вызовов: обработчик выполнится не чаще, чем раз
 * в wait мс. Нужен для resize и поиска по вводу.
 * @param {(...args: any[]) => void} fn
 * @param {number} [wait=200]
 * @returns {(...args: any[]) => void}
 */
export function debounce(fn, wait = 200) {
  let timerId;

  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Цена в рублях: 12500 → «12 500 ₽».
 * Разряды разделяются неразрывным пробелом, чтобы цена не рвалась по строке.
 * @param {number} value
 * @returns {string}
 */
export function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';

  return `${Math.round(number).toLocaleString('ru-RU').replace(/\s/g, '\u00a0')}\u00a0₽`;
}

/**
 * Склонение существительного: plural(3, 'товар', 'товара', 'товаров') → 'товара'.
 * @param {number} count
 * @param {string} one для 1
 * @param {string} few для 2–4
 * @param {string} many для 5 и больше
 * @returns {string}
 */
export function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Короткая уникальная строка — для id заказов и подобного.
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ключ позиции корзины: товар плюс размер.
 * Один товар в разных размерах — это две разные позиции, поэтому ключ
 * собирается из двух значений.
 * @param {string} productId
 * @param {string} [size]
 * @returns {string}
 */
export function variantKey(productId, size = '') {
  return `${productId}::${size || 'default'}`;
}

/** Разрешить прокрутку страницы (в CSS это класс .no-scroll). */
export function unlockScroll() {
  document.body.classList.remove('no-scroll');
}

/** Запретить прокрутку страницы, пока открыто модальное окно. */
export function lockScroll() {
  document.body.classList.add('no-scroll');
}

/**
 * Разобрать JSON без падения: битые данные в localStorage не должны
 * ломать страницу.
 * @param {string|null} raw
 * @param {*} [fallback=null]
 * @returns {*}
 */
export function parseJSON(raw, fallback = null) {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[utils] Битый JSON, берём значение по умолчанию', error);
    return fallback;
  }
}

/**
 * Экранирует строку для вставки в разметку.
 *
 * В корзину и заказ попадают данные, которых мы не писали: имя
 * загруженного файла приходит из поля выбора файла, а снимок заказа
 * читается из localStorage — его мог править кто угодно в браузере.
 * Такие строки в шаблонные строки нельзя: `<` в имени файла сломает
 * разметку (на Windows такие имена не создать, на macOS и Linux — можно).
 * Поэтому всё, что пришло от пользователя или из хранилища, проходит
 * через escapeHtml.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Абсолютный адрес файла проекта по пути от его корня.
 *
 * Нужен там, где картинку подставляет скрипт: `assets/images/...` — путь
 * от корня сайта, а страница товара лежит в product-pages/, и относительно
 * неё такой адрес указывал бы в product-pages/assets/... — картинка
 * не находилась бы. Считаем от самого модуля: utils.js всегда лежит
 * в assets/js/, поэтому два уровня вверх дают корень проекта, с какой бы
 * страницы функцию ни вызвали.
 *
 * @param {string} path путь от корня проекта, например 'assets/images/icons/icon-file.svg'
 * @returns {string} абсолютный адрес
 */
export function assetUrl(path) {
  const clean = String(path ?? '').replace(/^\/+/, '');
  return new URL(`../../${clean}`, import.meta.url).href;
}

/**
 * Адрес страницы проекта по пути от её корня.
 *
 * Та же беда, что у картинок: `thanks-cart.html` — путь от корня сайта,
 * а форма оформления стоит на странице товара в product-pages/, и
 * относительный адрес превращался в product-pages/thanks-cart.html —
 * браузер отдавал 404 вместо страницы благодарности. Считаем от модуля,
 * как assetUrl: utils.js лежит в assets/js/, два уровня вверх — корень.
 *
 * Готовые адреса не трогаем: `https://…`, `mailto:`, `/страница` и пути
 * вида `../страница` (их пишут страницы, которым нужен свой уровень)
 * возвращаются как есть или считаются от текущей страницы.
 *
 * @param {string} path путь от корня проекта, например 'thanks-cart.html'
 * @returns {string} адрес, который откроется с любой страницы
 */
export function pageUrl(path) {
  const raw = String(path ?? '').trim();
  if (!raw) return '';

  // Готовый адрес: схема (https:, mailto:) или корень сервера
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('/')) return raw;

  // Путь, который страница задала сама: он считается от её расположения
  if (raw.startsWith('../') || raw.startsWith('./')) {
    return new URL(raw, document.baseURI).href;
  }

  return new URL(`../../${raw}`, import.meta.url).href;
}
