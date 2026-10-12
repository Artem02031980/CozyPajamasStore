/**
 * modal.js — модальные окна: открытие, закрытие, фокус.
 *
 * Поведение одно для всех окон проекта, поэтому вынесено в модуль:
 * открытие по атрибуту, закрытие по ESC, по клику на затемнение и по
 * кнопке-крестику, ловушка фокуса внутри окна и блокировка прокрутки
 * страницы, пока окно открыто.
 *
 * Разметка окна (см. index.html):
 *   <div class="modal is-hidden" data-modal="cart" role="dialog"
 *        aria-modal="true" aria-labelledby="cart-title">
 *     <div class="modal__overlay" data-modal-close></div>
 *     <div class="modal__dialog">…<button data-modal-close>×</button></div>
 *   </div>
 *
 * Кто открывает: любая кнопка с data-modal-open="имя окна". Закрывают:
 * элементы с data-modal-close внутри окна и клавиша Escape.
 *
 * Ловушка фокуса обязательна: без неё Tab уводит в содержимое страницы
 * за окном, и человек с клавиатуры теряет, где он находится.
 */

import { $, $$, lockScroll, unlockScroll } from './utils.js';

/** Селекторы, по которым ищутся элементы, участвующие в фокусе. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Открытое сейчас окно — чтобы вернуть фокус туда, откуда пришли. */
let openModal = null;

/** Элемент, который был в фокусе до открытия. */
let lastFocused = null;

/**
 * Видимые элементы, доступные с клавиатуры внутри окна.
 * Скрытые проверяем через offsetParent: у display: none его нет,
 * и такие элементы ловушка учитывать не должна.
 *
 * @param {HTMLElement} root
 * @returns {HTMLElement[]}
 */
function focusableIn(root) {
  return $$(FOCUSABLE, root).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Открывает окно по имени.
 *
 * @param {string} name значение data-modal у окна
 * @returns {boolean} нашлось ли окно
 */
export function openModalByName(name) {
  const modal = $(`[data-modal="${name}"]`);
  if (!modal) {
    console.warn(`[modal] окно «${name}» не найдено`);
    return false;
  }

  return open(modal);
}

/**
 * Открывает окно-элемент.
 * @param {HTMLElement} modal
 * @returns {boolean}
 */
export function open(modal) {
  if (!modal || openModal === modal) return false;

  // Второе окно поверх первого не поддерживаем: сначала закрываем текущее
  if (openModal) close();

  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  openModal = modal;

  modal.classList.remove('is-hidden');
  modal.setAttribute('aria-hidden', 'false');
  lockScroll();

  /* Фокус ставим в первое поле или на кнопку закрытия: если оставить его
     на кнопке, которая открыла окно, Tab пойдёт по странице за окном. */
  const target = focusableIn(modal)[0] ?? modal;
  target.focus?.({ preventScroll: true });

  modal.dispatchEvent(new CustomEvent('modal:open', { bubbles: true }));
  return true;
}

/** Закрывает открытое окно и возвращает фокус на кнопку открытия. */
export function close() {
  if (!openModal) return false;

  const modal = openModal;
  openModal = null;

  modal.classList.add('is-hidden');
  modal.setAttribute('aria-hidden', 'true');
  unlockScroll();

  /* Фокус возвращаем туда, откуда окно открыли: иначе после закрытия
     он окажется в начале страницы, и клавиатурный пользователь потеряет
     место, на котором был. */
  if (lastFocused && document.contains(lastFocused)) {
    lastFocused.focus({ preventScroll: true });
  }
  lastFocused = null;

  modal.dispatchEvent(new CustomEvent('modal:close', { bubbles: true }));
  return true;
}

/** Открыто ли сейчас какое-нибудь окно. */
export function isOpen() {
  return Boolean(openModal);
}

/** Имя открытого окна — для проверок. */
export function openName() {
  return openModal?.dataset.modal ?? null;
}

/**
 * Обрабатывает клавиши внутри окна.
 * @param {KeyboardEvent} event
 */
function onKeydown(event) {
  if (!openModal) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key !== 'Tab') return;

  /* Ловушка фокуса: Tab с последнего элемента уходит на первый,
     Shift+Tab с первого — на последний. */
  const items = focusableIn(openModal);
  if (!items.length) {
    event.preventDefault();
    return;
  }

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (!openModal.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

/**
 * Подключает модальные окна страницы.
 *
 * Слушатели вешаются на document один раз и работают для всех окон:
 * окон может быть несколько, а кнопок открытия — сколько угодно,
 * и подписываться на каждую смысла нет.
 */
export function initModal() {
  document.addEventListener('keydown', onKeydown);

  /* Делегирование вместо обработчика на каждой кнопке: кнопки открытия
     есть в шапке и в карточках, а карточки перерисовываются фильтрами. */
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const opener = target.closest('[data-modal-open]');
    if (opener) {
      event.preventDefault();
      openModalByName(opener.dataset.modalOpen);
      return;
    }

    const closer = target.closest('[data-modal-close]');
    if (closer && openModal) {
      event.preventDefault();
      close();
    }
  });
}
