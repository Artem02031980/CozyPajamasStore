/**
 * header.js — поведение шапки.
 *
 * Сейчас здесь одно: бургер открывает и закрывает меню.
 *
 * Как устроено раскрытие. Открытое состояние помечается классом `.is-open`
 * на контейнере меню — правила для него лежат в header.css рядом с базовым.
 * Состояние читается из разметки, а не хранится отдельной переменной:
 * так класс и `aria-expanded` не могут разойтись.
 *
 * Раскрытие работает на всех ширинах, где есть бургер, то есть до 1024px.
 * Выше 768px меню при открытии тоже накрывает экран, а в закрытом виде
 * в строке шапки виден активный пункт — так задумано в макете.
 */

import { $ } from './utils.js';

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
    toggleMenu();
  });
}
