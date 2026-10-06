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
 *
 * Меню закрывается тремя способами: бургером, кликом по пункту навигации
 * и кликом по пустому месту наложения. Два последних — делегированием
 * с контейнера меню: обработчиков ровно два, сколько бы пунктов ни было.
 */

import { $, delegate } from './utils.js';

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

/** Точка входа: навешивает обработчики бургера и меню. */
export function initHeader() {
  const burger = $('[data-burger]');
  const nav = $('[data-nav]');
  if (!burger || !nav) return;

  burger.addEventListener('click', () => {
    toggleMenu();
  });

  /* Закрытие меню кликом внутри наложения — два случая, два обработчика.
     По пункту навигации меню закрывается, и браузер уходит по якорю:
     preventDefault здесь был бы ошибкой, он отменил бы сам переход
     к разделу, ради которого пункт и нажимают. Плавность даёт
     scroll-behavior в reset.css, отступ от шапки — scroll-margin-top
     у разделов.

     event.detail > 0 отсекает активацию с клавиатуры: Enter и пробел
     на ссылке дают click с detail = 0, и от нажатия клавиши меню
     закрываться не должно. */
  delegate(nav, 'click', '.header__link', (event, link) => {
    if (event.detail === 0) return;
    if (link.getAttribute('href')) closeMenu();
  });

  /* Клик по пустому месту наложения. Проверяем отсутствие ссылки
     под курсором, а не равенство event.target контейнеру: у наложения
     большие внутренние поля, и клик по ним пришёл бы уже от nav —
     по контейнеру такой клик меню не закрыл бы. */
  nav.addEventListener('click', (event) => {
    if (event.detail === 0) return;
    const link = event.target instanceof Element ? event.target.closest('.header__link') : null;
    if (!link) closeMenu();
  });

  /* Клик по видимой строке шапки над наложением: бургер, логотип, корзина,
     иконки соцсетей. Слушаем документ, потому что до nav такие клики
     не доходят — наложение начинается ниже строки шапки. */
  document.addEventListener('click', (event) => {
    if (!isMenuOpen()) return;
    if (event.detail === 0) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (burger.contains(target)) return;   // по бургеру меню закрывает его собственный обработчик
    if (nav.contains(target)) return;      // внутри меню — обработчики выше
    closeMenu();
  });
}
