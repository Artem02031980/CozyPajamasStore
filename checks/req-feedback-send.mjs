/**
 * Запрос: успешная отправка формы обратной связи.
 *
 * Подмена location.href в Chrome не проходит: href у location
 * неконфигурируемый, переопределение молча не применяется, и вкладка
 * уходит на thanks-feedback.html — контекст страницы пропадает вместе
 * с переходом, поэтому замер заканчивается сообщением харнесса
 * «Inspected target navigated or closed».
 *
 * Это и есть ожидаемый исход: короткий и пустой вопрос вкладку не уводит
 * (см. checks/req-feedback.mjs), а полный — уводит. Что страница
 * благодарности показывает ровно эту запись, проверяет
 * checks/req-thanks-feedback.mjs.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-feedback-send.mjs --widths 1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const form = document.querySelector('[data-feedback-form]');
const field = form.querySelector('[data-feedback-field]');
const error = form.querySelector('[data-feedback-error]');

const QUESTION = 'Подскажите, есть ли пижама ростом 170 см?';

field.value = QUESTION;
field.dispatchEvent(new Event('input', { bubbles: true }));

press(form.querySelector('.feedback__submit'));
await frame();
await new Promise((r) => setTimeout(r, 250));

/* Сюда доходим, только если перехода не случилось: тогда видно, что
   осталось в хранилище и не показана ли ошибка */
const stored = localStorage.getItem('cozy-pajamas:message');
const saved = stored ? JSON.parse(stored) : null;

return {
  переходСостоялся: false,
  путь: location.pathname,
  запись: stored,
  вопрос: saved?.question ?? null,
  времяЗаписано: Boolean(saved?.createdAt && !Number.isNaN(new Date(saved.createdAt).getTime())),
  ошибкаВидна: !error.classList.contains('is-hidden'),
  классПоля: field.className,
};
