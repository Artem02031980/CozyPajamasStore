/**
 * filters.js — постраничный показ товаров в секциях каталога.
 *
 * Пока здесь только пагинация: фильтры и сортировка появятся позже,
 * и место для них — этот же модуль.
 *
 * Сколько товаров на странице, зависит от ширины экрана:
 *   до 768px         — 5 карточек (сетка в одну колонку)
 *   от 768 до 1279px — 6 карточек (сетка в две колонки)
 *   от 1280px        — 9 карточек (сетка в три колонки)
 *
 * Числа привязаны к раскладке, поэтому при изменении ширины окна
 * страница пересчитывается заново: иначе на новом числе колонок
 * в последнем ряду оставались бы дыры.
 *
 * Разметку карточек создаёт render.js — здесь только выбор того,
 * что показать, и кнопки страниц.
 */

import { $, $$, debounce } from './utils.js';
import { getProducts } from './data.js';
import { renderCards } from './render.js';

/** Секции, которые показываются постранично. */
const PAGINATED_SECTIONS = ['women', 'men'];

/**
 * Сколько карточек показывать на странице при текущей ширине окна.
 *
 * Совпадает с числом колонок в сетке: при 2 колонках 6 карточек — это
 * ровно 3 полных ряда, при 3 колонках 9 — тоже полных ряда без остатка.
 *
 * @returns {number}
 */
export function getPerPage() {
  if (window.matchMedia?.('(min-width: 1280px)').matches) return 9;
  if (window.matchMedia?.('(min-width: 768px)').matches) return 6;
  return 5;
}

/**
 * Собирает <li> с номерами страниц.
 *
 * Кнопки, а не ссылки: страница переключается без перехода по адресу,
 * и ссылка с href вела бы себя как навигация по сайту. Стрелки идут
 * первым и последним пунктом списка, как в вёрстке.
 *
 * @param {number} current текущая страница
 * @param {number} total сколько всего страниц
 * @returns {string}
 */
function renderPagination(current, total) {
  const numbers = Array.from({ length: total }, (_, i) => {
    const page = i + 1;
    const active = page === current;
    return `
                <li>
                  <button
                    class="pagination__link${active ? ' is-active' : ''}"
                    type="button"
                    data-page="${page}"
                    ${active ? 'aria-current="page"' : ''}
                  >${page}</button>
                </li>`;
  }).join('');

  return `
                <li>
                  <button
                    class="pagination__arrow"
                    type="button"
                    data-page-step="-1"
                    aria-label="Предыдущая страница"
                    ${current === 1 ? 'disabled' : ''}
                  >‹</button>
                </li>${numbers}
                <li>
                  <button
                    class="pagination__arrow"
                    type="button"
                    data-page-step="1"
                    aria-label="Следующая страница"
                    ${current === total ? 'disabled' : ''}
                  >›</button>
                </li>`;
}

/**
 * Состояние постраничного показа по секциям.
 * @type {Map<string, {page: number, perPage: number, total: number}>}
 */
const state = new Map();

/**
 * Показывает нужную страницу секции: карточки и кнопки страниц.
 * @param {string} section
 * @param {number} [page] номер страницы; по умолчанию — текущая
 */
export function showPage(section, page) {
  const grid = $(`.goods-${section}__grid`);
  const pagination = $(`.goods-${section}__pagination, nav.pagination[data-section="${section}"]`);
  const all = getProducts(section);
  const perPage = getPerPage();
  const total = Math.max(1, Math.ceil(all.length / perPage));

  // Страницу держим в пределах: при смене ширины их число меняется
  const current = Math.min(Math.max(1, page ?? state.get(section)?.page ?? 1), total);
  state.set(section, { page: current, perPage, total });

  if (grid) {
    const from = (current - 1) * perPage;
    grid.innerHTML = renderCards(section, all.slice(from, from + perPage));
  }

  if (pagination) {
    const list = $('.pagination__list', pagination);
    if (list) {
      list.innerHTML = renderPagination(current, total);
      // Кнопок на одной странице не бывает — прячем пустую пагинацию
      pagination.classList.toggle('is-hidden', total <= 1);
    }
  }
}

/**
 * Навешивает обработчики пагинации на секцию.
 * @param {string} section
 */
function initSection(section) {
  const pagination = $(`nav.pagination[data-section="${section}"]`);
  if (!pagination) {
    console.warn(`[filters] не найдена пагинация для секции «${section}»`);
    return;
  }

  pagination.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('[data-page], [data-page-step]');
    if (!button || button.disabled) return;

    const current = state.get(section)?.page ?? 1;
    const step = button.dataset.pageStep;

    showPage(section, step ? current + Number(step) : Number(button.dataset.page));
  });
}

/**
 * Точка входа: включает постраничный показ в секциях женской
 * и мужской коллекций.
 */
export function initFilters() {
  PAGINATED_SECTIONS.forEach((section) => {
    // Первую страницу рисуем сразу — разметка каталога пустая
    initSection(section);
    showPage(section, 1);
  });

  /* При смене ширины число карточек на странице меняется, поэтому
     пересчитываем и перерисовываем. debounce: resize сыплется
     десятками событий, а перерисовка пересобирает всю сетку. */
  window.addEventListener('resize', debounce(() => {
    for (const section of PAGINATED_SECTIONS) {
      const current = state.get(section);
      // Остаёмся на той же странице, но с новым числом карточек
      showPage(section, current?.page ?? 1);
    }
  }, 200), { passive: true });
}

/**
 * Сколько страниц в секции при текущей ширине — для проверок.
 * @param {string} section
 * @returns {number}
 */
export function getPagesCount(section) {
  const perPage = getPerPage();
  return Math.max(1, Math.ceil(getProducts(section).length / perPage));
}

/** Список секций с пагинацией — для проверок. */
export const paginatedSections = PAGINATED_SECTIONS.slice();

/** Все кнопки страниц, какие есть на странице — для проверок. */
export function debugButtons() {
  return $$('.pagination__link, .pagination__arrow');
}
