/**
 * Запрос: мобильный сценарий фильтров — кнопка «Установить фильтры».
 *
 * До 1024px форма фильтров лежит с .is-hidden, и её показывает кнопка.
 * Проверяем, что кнопка действительно раскрывает форму, меняет подпись
 * и состояние aria-expanded, а фильтр после раскрытия работает.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8000/ \
 *     --request checks/req-filters-mobile.mjs --widths 360,768,1024
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const section = document.querySelector('#goods-women');
const form = section.querySelector('#goods-women-filters');
const toggle = section.querySelector('[data-filters-toggle]');
const grid = section.querySelector('.goods-women__grid');
const count = section.querySelector('[data-goods-count]');

const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const state = () => ({
  toggleVisible: toggle ? getComputedStyle(toggle).display !== 'none' : false,
  toggleText: toggle?.textContent.trim() ?? null,
  ariaExpanded: toggle?.getAttribute('aria-expanded') ?? null,
  formHidden: form.classList.contains('is-hidden'),
  formDisplay: getComputedStyle(form).display,
  cards: grid.children.length,
  count: count?.textContent.trim() ?? null,
});

const steps = [{ step: 'до клика', ...state() }];

if (toggle) {
  press(toggle);
  await frame();
  steps.push({ step: 'после раскрытия', ...state() });

  // Фильтр в раскрытой форме: «Халатик» — два товара
  const chip = [...form.querySelectorAll('.filters__chip')].find((b) => b.textContent.trim() === 'Халатик');
  press(chip);
  await frame();
  steps.push({ step: 'выбран Халатик', ...state() });

  press(form.querySelector('.filters__reset'));
  await frame();
  steps.push({ step: 'после сброса', ...state() });

  press(toggle);
  await frame();
  steps.push({ step: 'после закрытия', ...state() });
} else {
  steps.push({ step: 'кнопки нет', note: 'на широких экранах она скрыта' });
}

return {
  viewport: { w: innerWidth, h: innerHeight },
  colorSwatches: form.querySelectorAll('.filters__color').length,
  chips: form.querySelectorAll('.filters__chip').length,
  sortVisible: getComputedStyle(section.querySelector('[data-goods-sort]')).display,
  steps,
};
