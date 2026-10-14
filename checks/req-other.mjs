/**
 * Запрос: лента и фильтры секции «Другие товары».
 *
 * Проверяет связку «чипс → лента» и листание стрелками: раньше в этой секции
 * ни то, ни другое не работало, товары были статичной разметкой.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8000/ \
 *     --request checks/req-other.mjs --widths 1280
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const section = document.querySelector('#goods-other');
const track = section.querySelector('.goods-other__track');
const form = section.querySelector('#goods-other-filters');
const count = section.querySelector('[data-goods-count]');
const prev = section.querySelector('[data-slider-prev]');
const next = section.querySelector('[data-slider-next]');

const chip = (text) => [...form.querySelectorAll('.filters__chip')]
  .find((b) => b.textContent.trim() === text);

const snap = (step) => ({
  step,
  cards: track.children.length,
  titles: [...track.querySelectorAll('.product-card__title')].map((t) => t.textContent.trim()),
  labels: [...track.querySelectorAll('.product-card__subtitle')].map((t) => t.textContent.trim()),
  count: count?.textContent.trim() ?? null,
  activeChips: [...form.querySelectorAll('.filters__chip.is-active')].map((b) => b.textContent.trim()),
  scrollLeft: Math.round(track.scrollLeft),
  prevDisabled: prev?.disabled ?? null,
  nextDisabled: next?.disabled ?? null,
  prevHidden: prev?.classList.contains('is-hidden') ?? null,
  imagesOk: [...track.querySelectorAll('.product-card__image')].every((i) => i.naturalWidth > 0),
});

const steps = [snap('старт')];

// 1. Листание вперёд и назад
if (next && !next.disabled) {
  press(next);
  await new Promise((r) => setTimeout(r, 500));
  steps.push(snap('после «вперёд»'));
  press(prev);
  await new Promise((r) => setTimeout(r, 500));
  steps.push(snap('после «назад»'));
}

// 2. Фильтр по каждому типу
const types = [...form.querySelectorAll('.filters__chip')].map((b) => b.textContent.trim());
const byType = [];
for (const type of types) {
  const button = chip(type);
  press(button);
  await frame();
  await new Promise((r) => setTimeout(r, 150));
  byType.push({ type, ...snap(`фильтр: ${type}`) });
  press(button);
  await frame();
}

// 3. Снятие фильтра возвращает всю ленту
await new Promise((r) => setTimeout(r, 150));
steps.push(snap('после снятия всех фильтров'));

return {
  всего: track.children.length,
  стрелок: section.querySelectorAll('[data-slider-prev], [data-slider-next]').length,
  доступныхЧипсов: types.length,
  ширинаЛенты: Math.round(track.clientWidth),
  ширинаСодержимого: Math.round(track.scrollWidth),
  листается: track.scrollWidth > track.clientWidth + 1,
  потипам: byType,
  steps,
};
