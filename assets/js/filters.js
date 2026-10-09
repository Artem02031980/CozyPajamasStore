/**
 * filters.js — фильтры, сортировка и постраничный показ каталога.
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
 * Клик по кнопке страницы возвращает экран к началу списка товаров —
 * человек сразу видит товары новой страницы, как при переходе по ссылке
 * пагинации на сайте-образце.
 *
 * Отбор и сортировку считает filters-query.js — здесь только разметка,
 * события и состояние. Так логику отбора можно проверять без браузера.
 *
 * Разметку карточек создаёт render.js — здесь только выбор того,
 * что показать, и кнопки страниц.
 */

import { $, $$, delegate, debounce } from './utils.js';
import { getProducts } from './data.js';
import { renderCards } from './render.js';
import { emptyFilters, selectProducts, hasAnyFilter } from './filters-query.js';

/** Секции, которые показываются постранично и имеют фильтры. */
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
 * Состояние секции: страница, выбранные фильтры и сортировка.
 * @type {Map<string, {page: number, perPage: number, filters: import('./filters-query.js').Filters, sort: string}>}
 */
const state = new Map();

/**
 * Что сейчас в секции — для проверок и отладки.
 * @param {string} section
 */
function currentState(section) {
  return state.get(section) ?? {
    page: 1,
    perPage: getPerPage(),
    filters: emptyFilters(),
    sort: 'default',
  };
}

/**
 * Прокручивает страницу к началу списка товаров — так же, как это
 * выглядит при обычном переходе по ссылке.
 *
 * На сайте-образце (jackmenn.ru) пагинация сделана ссылками
 * (/catalog/page/2/): браузер грузит новую страницу сверху, и человек
 * видит начало товаров новой страницы, а не то место, где он кликнул.
 * Здесь перерисовка идёт без перезагрузки, поэтому положение экрана
 * ставим сами — по верхней границе сетки карточек.
 *
 * Именно сетка, а не секция: на ширине 1024–1279px фильтры стоят
 * над товарами (см. goods-women.css), и верх секции оказался бы
 * заголовком с фильтрами, а карточки — в 800+px ниже экрана.
 *
 * Отступ шапки берём из scroll-margin-top (layout.css), а не считаем
 * в JS: там же лежит высота шапки, и дублировать её незачем.
 *
 * @param {HTMLElement} target элемент, к началу которого возвращаем экран
 */
function scrollToGoodsStart(target) {
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - margin);

  const root = document.documentElement;
  const wasSmooth = root.style.scrollBehavior;
  // scroll-behavior: smooth из reset.css превратил бы правку в анимацию
  root.style.scrollBehavior = 'auto';
  window.scrollTo(0, top);
  root.style.scrollBehavior = wasSmooth;
}

/**
 * Показывает нужную страницу секции: карточки, счётчик и кнопки страниц.
 *
 * Товары берутся не из data.js напрямую, а из отбора по фильтрам
 * и сортировке: и число страниц, и счётчик считаются от того, что нашлось.
 *
 * @param {string} section
 * @param {number} [page] номер страницы; по умолчанию — текущая
 * @param {object} [options]
 * @param {boolean} [options.scrollToStart] вернуть экран к началу списка товаров
 */
export function showPage(section, page, { scrollToStart = false } = {}) {
  const grid = $(`.goods-${section}__grid`);
  const pagination = $(`nav.pagination[data-section="${section}"]`);
  const count = $(`.goods-${section} [data-goods-count]`);
  const perPage = getPerPage();

  const current = currentState(section);
  const pool = selectProducts(getProducts(section), current.filters, current.sort);
  const total = Math.max(1, Math.ceil(pool.length / perPage));

  // Страницу держим в пределах: после фильтрации их число меняется
  const pageNumber = Math.min(Math.max(1, page ?? current.page), total);
  state.set(section, { ...current, page: pageNumber, perPage });

  if (grid) {
    const from = (pageNumber - 1) * perPage;
    const shown = pool.slice(from, from + perPage);

    grid.innerHTML = shown.length
      ? renderCards(section, shown)
      : `<li class="goods__empty">По выбранным условиям ничего не нашлось.
           Снимите часть фильтров или нажмите «Сбросить фильтры».</li>`;
  }

  if (count) {
    count.textContent = pool.length
      ? `Найдено: ${pool.length}`
      : 'Ничего не найдено';
  }

  if (pagination) {
    const list = $('.pagination__list', pagination);
    if (list) {
      list.innerHTML = renderPagination(pageNumber, total);
      // Кнопок на одной странице не бывает — прячем пустую пагинацию
      pagination.classList.toggle('is-hidden', total <= 1);
    }
  }

  /* Клик по кнопке страницы: экран возвращается к началу списка товаров —
     человек сразу видит первую строку карточек новой страницы, как при
     переходе по ссылке пагинации на сайте-образце.

     Прежний вариант — удержать экран на месте — убран: на второй странице
     карточек меньше, страница становится короче, и сетка уезжала вверх
     под курсором (замер показывал сдвиг до 1125px). */
  if (scrollToStart && grid) scrollToGoodsStart(grid);

  /* Перерисовка без прокрутки (смена ширины окна, смена фильтров) экран
     не двигает: браузер оставляет прежний scrollY, а Chrome вдобавок сам
     правит прокрутку («scroll anchoring»). Компенсировать это не нужно —
     сетка стоит там же, меняется только её содержимое. */
}

/**
 * Читает выбранные фильтры из формы.
 *
 * Группы различаются по порядку, как в разметке: тип изделия, возраст,
 * палитра цветов, цена. Порядок задан вёрсткой и меняется только вместе
 * с ней — зато не нужно проставлять data-атрибуты на каждом чипсе.
 *
 * Подписи чипсов и aria-label кружков совпадают со значениями тегов
 * в data.js, поэтому таблиц перевода нет.
 *
 * @param {HTMLFormElement} form
 * @returns {import('./filters-query.js').Filters}
 */
function readFilters(form) {
  const groups = $$('.filters__group', form);
  const chosen = (group) => (group ? $$('.filters__chip.is-active', group) : []);
  const label = (button) => button.textContent.trim();

  const filters = emptyFilters();
  filters.types = chosen(groups[0]).map(label);
  filters.ages = chosen(groups[1]).map(label);
  filters.prices = chosen(groups[3]).map(label);
  filters.colors = $$('.filters__color.is-active', form).map((b) => b.getAttribute('aria-label'));

  return filters;
}

/**
 * Собирает и подключает фильтры, сортировку и пагинацию одной секции.
 * @param {string} section
 */
function initSection(section) {
  const pagination = $(`nav.pagination[data-section="${section}"]`);
  const form = $(`#goods-${section}-filters`);
  if (!pagination) {
    console.warn(`[filters] не найдена пагинация для секции «${section}»`);
    return;
  }

  /* Перерисовка после смены фильтра. Страница сбрасывается на первую:
     иначе человек остался бы, например, на второй странице списка из трёх
     товаров и увидел пустоту. Экран при этом не дёргаем — фильтры стоят
     рядом с сеткой, и прыжок был бы неожиданным. */
  const refresh = () => showPage(section, 1);

  /** Переключает выбор и перерисовывает список. */
  const toggleChoice = (el) => {
    el.classList.toggle('is-active');
    el.setAttribute('aria-pressed', String(el.classList.contains('is-active')));

    state.set(section, { ...currentState(section), filters: readFilters(form) });
    refresh();
  };

  pagination.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('[data-page], [data-page-step]');
    if (!button || button.disabled) return;

    const currentPage = currentState(section).page;
    const step = button.dataset.pageStep;
    const next = step ? currentPage + Number(step) : Number(button.dataset.page);

    // Страница та же — ничего не делаем: не дёргаем экран зря
    if (next === currentPage) return;

    // scrollToStart: как переход по ссылке на новую страницу каталога —
    // экран возвращается к началу товаров (см. scrollToGoodsStart)
    showPage(section, next, { scrollToStart: true });
  });

  if (!form) {
    console.warn(`[filters] не найдена форма фильтров для секции «${section}»`);
    return;
  }

  // Чипс типа, возраста или цены: выбор снимается повторным нажатием
  delegate(form, 'click', '.filters__chip', (event, chip) => {
    event.preventDefault();
    toggleChoice(chip);
  });

  // Кружок палитры: цветов можно выбрать несколько
  delegate(form, 'click', '.filters__color', (event, color) => {
    event.preventDefault();
    toggleChoice(color);
  });

  // Сброс: снимаем выбор со всех чипсов и кружков
  delegate(form, 'click', '.filters__reset', (event) => {
    event.preventDefault();
    $$('.is-active', form).forEach((el) => {
      el.classList.remove('is-active');
      el.setAttribute('aria-pressed', 'false');
    });

    state.set(section, { ...currentState(section), filters: emptyFilters() });
    refresh();
  });

  // Сортировка: значение option совпадает с ключом в filters-query.js
  const sortSelect = $(`.goods-${section} [data-goods-sort]`);
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.set(section, { ...currentState(section), sort: sortSelect.value, page: 1 });
      showPage(section, 1);
    });
  }

  /* Раскрытие фильтров на мобильном: форма лежит с .is-hidden, кнопка её
     показывает. С 768px фильтры развёрнуты всегда — там секционные стили
     перебивают .is-hidden через display: flex !important, а сама кнопка
     скрыта. Поэтому обработчик работает только до 768px: иначе клик по
     невидимой кнопке дёргал бы класс вхолостую. */
  const toggle = $(`#goods-${section} [data-filters-toggle]`);
  const narrow = window.matchMedia?.('(max-width: 767px)');

  if (toggle && narrow) {
    toggle.addEventListener('click', () => {
      if (!narrow.matches) return;

      const opened = form.classList.toggle('is-hidden') === false;
      toggle.setAttribute('aria-expanded', String(opened));
      toggle.textContent = opened ? 'Скрыть фильтры' : 'Установить фильтры';
    });
  }
}

/**
 * Точка входа: включает фильтры, сортировку и постраничный показ
 * в секциях женской и мужской коллекций.
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
 * Сколько страниц в секции при текущей ширине и выбранных фильтрах —
 * для проверок.
 * @param {string} section
 * @returns {number}
 */
export function getPagesCount(section) {
  const perPage = getPerPage();
  const current = currentState(section);
  const pool = selectProducts(getProducts(section), current.filters, current.sort);
  return Math.max(1, Math.ceil(pool.length / perPage));
}

/** Список секций с пагинацией — для проверок. */
export const paginatedSections = PAGINATED_SECTIONS.slice();

/** Все кнопки страниц, какие есть на странице — для проверок. */
export function debugButtons() {
  return $$('.pagination__link, .pagination__arrow');
}

/** Что выбрано в секции — для проверок. */
export function debugState(section) {
  const current = currentState(section);
  return { page: current.page, sort: current.sort, filters: { ...current.filters } };
}

export { hasAnyFilter };
