/**
 * slider.js — листание ленты карточек стрелками.
 *
 * Лента в «Других товарах» — это обычный горизонтальный список с прокруткой
 * (goods-other__track), а не карусель с перелистыванием: так она работает
 * и без скрипта. Модуль только добавляет стрелки: они прокручивают ленту
 * на ширину одной карточки и выключаются на краях.
 *
 * Карточки в ленте рисует filters.js — этот же модуль их и фильтрует,
 * поэтому после перерисовки ленты положение и стрелки нужно обновить:
 * для этого у модуля есть reset().
 */

import { $, $$, debounce } from './utils.js';

/** Кнопка листания и её направление. */
const ARROWS = [
  { selector: '[data-slider-prev]', step: -1, edge: 'start' },
  { selector: '[data-slider-next]', step: 1, edge: 'end' },
];

/**
 * Прокрутка ленты: у неё может быть плавное поведение из CSS, но при
 * ручной прокрутке шаг должен быть мгновенным — иначе два быстрых нажатия
 * складываются и лента уезжает дальше, чем на карточку.
 *
 * @param {HTMLElement} track
 * @param {number} left
 * @param {boolean} smooth
 */
function scrollTrack(track, left, smooth) {
  const root = document.documentElement;
  const wasSmooth = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  track.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  root.style.scrollBehavior = wasSmooth;
}

/**
 * Шаг прокрутки — ширина карточки плюс зазор между ними.
 * Считаем по живой геометрии: ширина карточки зависит от ширины экрана,
 * а зазор задан в CSS (24px, с 1280px — 32px).
 *
 * @param {HTMLElement} track
 * @returns {number}
 */
function stepOf(track) {
  const first = track.firstElementChild;
  if (!first) return track.clientWidth;

  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
  return first.getBoundingClientRect().width + gap;
}

/**
 * Подключает стрелки к ленте.
 *
 * @param {string} [section='other'] секция, чья лента листается
 * @returns {{reset: () => void, step: (direction: number) => void}|null}
 */
export function initSlider(section = 'other') {
  const track = $(`.goods-${section}__track`);
  const arrows = $$(`.goods-${section}__slider [data-slider-prev], .goods-${section}__slider [data-slider-next]`);
  if (!track || !arrows.length) return null;

  /** Обновляет доступность стрелок по положению прокрутки. */
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    // Лента короче своей ширины — листать нечего, стрелки не нужны
    const nothingToScroll = max <= 1;

    for (const { selector, edge } of ARROWS) {
      const button = $(selector, track.closest(`.goods-${section}__slider`) ?? document);
      if (!button) continue;

      const atEdge = edge === 'start'
        ? track.scrollLeft <= 1
        : track.scrollLeft >= max - 1;

      button.disabled = nothingToScroll || atEdge;
      button.classList.toggle('is-hidden', nothingToScroll);
    }
  };

  for (const { selector, step } of ARROWS) {
    const button = $(selector, track.closest(`.goods-${section}__slider`) ?? document);
    if (!button) continue;

    button.addEventListener('click', () => {
      scrollTrack(track, track.scrollLeft + step * stepOf(track), true);
      // Положение меняется плавно, поэтому стрелки обновляем после прокрутки
      window.setTimeout(update, 350);
    });
  }

  /* Прокрутка колесом, тачпадом и клавиатурой меняет положение без наших
     кнопок — стрелки должны это учитывать. */
  track.addEventListener('scroll', debounce(update, 120), { passive: true });
  window.addEventListener('resize', debounce(update, 200), { passive: true });

  update();

  return {
    /** Возвращает ленту в начало и пересчитывает стрелки. */
    reset() {
      scrollTrack(track, 0, false);
      update();
    },
    /** Прокручивает ленту на одну карточку — для проверок. */
    step(direction) {
      scrollTrack(track, track.scrollLeft + direction * stepOf(track), false);
      update();
    },
  };
}
