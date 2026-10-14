/**
 * feedback.js — форма обратной связи «Задайте вопрос».
 *
 * Данные никуда не уходят: сайт учебный, сервера у него нет. Модуль делает
 * то же, что и положено форме на статичном сайте: проверяет текст, кладёт
 * его в хранилище и ведёт на страницу благодарности. Показать сообщение
 * помогает thanks.js.
 *
 * Проверка вынесена отдельной функцией и не трогает DOM: её гоняют
 * проверки без браузера (checks/feedback.mjs), как validateField
 * в checkout.js. Модуль только читает значение поля и раскладывает
 * ошибку по разметке.
 *
 * Без скрипта форма работает сама: у неё есть action и method, поэтому
 * браузер уйдёт на thanks-feedback.html обычной отправкой. Там сообщения
 * не будет — страница скажет, что вопрос не сохранился, и позовёт обратно.
 */

import { $ } from './utils.js';
import { writeMessage } from './storage.js';

/**
 * Пределы длины вопроса.
 *
 * MIN — не придирка: сообщение из одного символа невозможно ни прочитать,
 * ни ответить на него. MAX совпадает с атрибутом maxlength у поля, чтобы
 * проверка и браузер не расходились: браузер обрежет ввод, а модуль
 * отбраковал бы то же значение по другой границе.
 */
export const LIMITS = { min: 10, max: 1000 };

/**
 * Проверяет вопрос из формы.
 *
 * @param {string} value текст из поля
 * @returns {string} текст ошибки или пустая строка, если всё в порядке
 */
export function validateQuestion(value) {
  const question = String(value ?? '').trim();

  if (!question) return 'Напишите вопрос — поле пустое';
  if (question.length < LIMITS.min) {
    return `Слишком коротко: нужно не меньше ${LIMITS.min} символов`;
  }
  if (question.length > LIMITS.max) {
    return `Слишком длинно: не больше ${LIMITS.max} символов`;
  }

  return '';
}

/**
 * Кладёт вопрос в хранилище.
 *
 * @param {string} value текст из поля
 * @param {Date} [date] момент отправки — для проверок
 * @returns {object|null} сохранённое сообщение или null, если текст не прошёл
 */
export function submitQuestion(value, date = new Date()) {
  const question = String(value ?? '').trim();
  if (validateQuestion(question)) return null;

  const message = { question, createdAt: date.toISOString() };
  writeMessage(message);

  return message;
}

/**
 * Показывает ошибку: текст под полем и признак у самого поля.
 *
 * Ошибку получает и поле (aria-invalid), а не только текст: с клавиатуры
 * и на слух человек узнаёт о ней именно от поля.
 *
 * @param {HTMLFormElement} form
 * @param {string} message
 */
function showError(form, message) {
  const field = $('[data-feedback-field]', form);
  const box = $('[data-feedback-error]', form);

  if (box) {
    box.textContent = message;
    box.classList.toggle('is-hidden', !message);
  }

  if (field) {
    field.classList.toggle('is-invalid', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  // Фокус — в поле: иначе непонятно, что править
  if (message) field?.focus();
}

/**
 * Куда идти после отправки.
 *
 * Адрес задаётся атрибутом data-feedback-redirect у формы: страница товара
 * сможет вести на свою страницу благодарности, не переписывая модуль.
 * На главной атрибута нет — берём общий thanks-feedback.html.
 *
 * @param {HTMLElement} form
 * @returns {string}
 */
function redirectFrom(form) {
  return form.dataset.feedbackRedirect || 'thanks-feedback.html';
}

/**
 * Подключает форму обратной связи.
 *
 * Слушатели вешаются на document, как в checkout.js: так поведение формы
 * не зависит от того, когда её разметка оказалась на странице, и один
 * обработчик обслуживает все формы с этим атрибутом.
 */
export function initFeedback() {
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLElement) || !form.matches('[data-feedback-form]')) return;

    event.preventDefault();

    const field = $('[data-feedback-field]', form);
    const error = validateQuestion(field?.value);

    showError(form, error);
    if (error) return;

    submitQuestion(field.value);
    window.location.href = redirectFrom(form);
  });

  /* Ошибку убираем, как только текст поправили: держать красную рамку
     до следующей отправки — значит ругаться на уже исправленное. */
  document.addEventListener('input', (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || !field.matches('[data-feedback-field]')) return;

    const form = field.closest('[data-feedback-form]');
    if (!form || !field.classList.contains('is-invalid')) return;

    field.classList.remove('is-invalid');
    field.setAttribute('aria-invalid', 'false');
    $('[data-feedback-error]', form)?.classList.add('is-hidden');
  });
}
