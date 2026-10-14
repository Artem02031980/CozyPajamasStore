/**
 * Запрос: форма обратной связи на главной — показ ошибки.
 *
 * Отправляем пустое поле и короткий вопрос и смотрим, что появилось
 * в разметке: текст ошибки, признак is-invalid у поля, фокус. Перехода
 * при ошибке быть не должно — вкладка обязана остаться на главной.
 *
 * Успешную отправку проверяет отдельный запрос (checks/req-feedback-send.mjs):
 * там вкладка уходит на страницу благодарности, и совмещать это с замерами
 * нельзя — контекст страницы вместе с переходом пропадает.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-feedback.mjs --widths 1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const form = document.querySelector('[data-feedback-form]');
const field = form.querySelector('[data-feedback-field]');
const error = form.querySelector('[data-feedback-error]');
const submit = form.querySelector('.feedback__submit');

const read = (step) => {
  const box = error.getBoundingClientRect();
  const input = field.getBoundingClientRect();
  return {
    step,
    классПоля: field.className,
    ariaInvalid: field.getAttribute('aria-invalid'),
    текстОшибки: error.textContent.trim(),
    ошибкаВидна: !error.classList.contains('is-hidden'),
    полеВФокусе: document.activeElement === field,
    ошибкаНижеПоля: Math.round(box.top - input.bottom),
    поляНаОднойЛинии: Math.round(box.left) === Math.round(input.left),
    высотаПоля: Math.round(input.height),
    ширинаПоля: Math.round(input.width),
    записьВХранилище: localStorage.getItem('cozy-pajamas:message'),
    адрес: location.href.split('/').pop(),
  };
};

const steps = [read('до отправки')];

// 1. Пустое поле
field.value = '';
press(submit);
await frame();
await new Promise((r) => setTimeout(r, 150));
steps.push(read('пустое поле'));

// 2. Слишком короткий вопрос
field.value = 'Привет';
field.dispatchEvent(new Event('input', { bubbles: true }));
await frame();
steps.push(read('после правки: ошибка снята'));

press(submit);
await frame();
await new Promise((r) => setTimeout(r, 150));
steps.push(read('короткий вопрос'));

/* 3. Граница: ровно 9 символов. Ниже минимума — ошибка, перехода нет.
   Ровно 10 проверяет отдельный запрос на успешную отправку: он уходит
   со страницы. */
field.value = 'а'.repeat(9);
field.dispatchEvent(new Event('input', { bubbles: true }));
await frame();
press(submit);
await frame();
await new Promise((r) => setTimeout(r, 150));
steps.push(read('девять символов'));

// 4. Ошибка не должна ломать соседей: каталог, корзина и фильтры на месте
return {
  шаги: steps,
  формаНайдена: Boolean(form),
  кнопкаНайдена: Boolean(submit),
  maxlength: field.getAttribute('maxlength'),
  novalidate: form.hasAttribute('novalidate'),
  разделЕсть: Boolean(document.querySelector('#feedback')),
  секцийКаталога: document.querySelectorAll('.goods-new, .goods-women, .goods-men, .goods-other').length,
  карточек: document.querySelectorAll('.product-card').length,
};
