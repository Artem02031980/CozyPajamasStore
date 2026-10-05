/**
 * header.js — поведение шапки.
 *
 * Сейчас здесь одно: бургер открывает и закрывает меню на мобильном.
 *
 * Как устроено раскрытие. На мобильном меню скрыто правилом
 * `.header__nav { display: none }` в header.css, а открытое состояние
 * помечается классом `.is-open` — он определён в том же файле рядом
 * с базовым правилом. Состояние читается из разметки, а не хранится
 * отдельной переменной: так состояние и `aria-expanded` не могут
 * разойтись.
 *
 * С 768px меню показывает CSS: бургер там остаётся, но открывать нечего —
 * рядом с ним уже стоит «Новая коллекция», а остальные пункты раскрываются
 * в меню бургера только на мобильном. Поэтому переключатель работает
 * исключительно ниже 768px, а при переходе через эту ширину состояние
 * сбрасывается.
 */

import { $ } from './utils.js';

/** С какой ширины меню раскрыто постоянно — совпадает с брейкпоинтом в CSS. */
const DESKTOP_QUERY = '(min-width: 768px)';

/** Открыто ли меню прямо сейчас. */
export function isMenuOpen() {
  const nav = $('[data-nav]');
  return Boolean(nav && nav.classList.contains('is-open'));
}

/**
 * Привести шапку к нужному состоянию: меню, класс и подпись кнопки.
 * @param {boolean} open
 */
export function setMenuState(open) {
  const burger = $('[data-burger]');
  const nav = $('[data-nav]');
  if (!burger || !nav) return;

  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Меню');
}

/** Переключить меню: открыть закрытое, закрыть открытое. */
export function toggleMenu() {
  setMenuState(!isMenuOpen());
}

/** Закрыть меню — например, после клика по пункту навигации. */
export function closeMenu() {
  setMenuState(false);
}

/** Точка входа: навешивает обработчики бургера. */
export function initHeader() {
  const burger = $('[data-burger]');
  const nav = $('[data-nav]');
  if (!burger || !nav) return;

  burger.addEventListener('click', () => {
    // С 768px меню раскрыто всегда, переключать нечего
    if (window.matchMedia(DESKTOP_QUERY).matches) return;

    toggleMenu();
  });

  // Переход через брейкпоинт сбрасывает состояние: иначе при возврате
  // на мобильную ширину меню осталось бы открытым с прошлого раза
  const desktop = window.matchMedia(DESKTOP_QUERY);
  let wasDesktop = desktop.matches;

  desktop.addEventListener('change', (event) => {
    if (event.matches === wasDesktop) return;

    wasDesktop = event.matches;
    closeMenu();
  });
}
