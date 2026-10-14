/**
 * Запрос: поле вопроса не сохраняет прошлый текст.
 *
 * Настоящая перезагрузка здесь не годится: она уничтожает контекст, в котором
 * считается запрос, и харнесс отвечает «Inspected target navigated or closed».
 * Возврат назад по-настоящему проверяется отдельно, в checks/req-feedback-back.mjs,
 * где переходы делает сам управляющий скрипт.
 *
 * Здесь проверяются две вещи, и обе видны без перезагрузки:
 *   — чистая загрузка: поле пустое;
 *   — событие pageshow, которое браузер шлёт при возврате из кеша страницы
 *     (bfcache): модуль обязан очистить поле и на него, потому что load
 *     в этом случае не приходит вовсе.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-feedback-reset.mjs --widths 1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const field = document.querySelector('[data-feedback-field]');
const error = document.querySelector('[data-feedback-error]');

const snapshot = (step) => ({
  step,
  значение: field.value,
  длина: field.value.length,
  ошибкаПоказана: !error.classList.contains('is-hidden'),
  текстОшибки: error.textContent.trim(),
  классПоля: field.className,
  ariaInvalid: field.getAttribute('aria-invalid'),
});

const steps = [snapshot('чистая загрузка')];

/* Ошибка на экране, затем возврат из кеша: текст и подпись обязаны уйти */
field.value = 'Коротко';
field.dispatchEvent(new Event('input', { bubbles: true }));
press(document.querySelector('.feedback__submit'));
await frame();
await new Promise((r) => setTimeout(r, 200));
steps.push(snapshot('после неудачной отправки'));

window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
await frame();
steps.push(snapshot('после pageshow (возврат из кеша)'));

/* И ещё раз: поле заполнено, приходит pageshow без persisted — так браузер
   шлёт событие при обычной загрузке */
field.value = 'Подскажите, есть ли пижама ростом 170 см?';
field.dispatchEvent(new Event('input', { bubbles: true }));
window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
await frame();
steps.push(snapshot('после pageshow (обычная загрузка)'));

return {
  шаги: steps,
  автокомплитФормы: document.querySelector('[data-feedback-form]').getAttribute('autocomplete'),
  автокомплитПоля: field.getAttribute('autocomplete'),
};
