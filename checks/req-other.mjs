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

/* 4. Цвет кнопок «В корзину» и порядок товаров.
   Кнопки в этой секции одного цвета: розовые, при наведении синие.
   Проверяем computed-цвет покоя (не картинку: PNG отдаёт свой оттенок),
   набор модификаторов и правило :hover из таблиц стилей. */
const buttons = [...track.querySelectorAll('.product-card__button')];
const buttonColours = buttons.map((b) => getComputedStyle(b).backgroundColor);
const buttonModifiers = [...new Set(buttons.flatMap((b) => [...b.classList]
  .filter((c) => c.startsWith('product-card__button--'))))];
const buttonClasses = [...new Set(buttons.map((b) => b.className))];

const hoverRules = [];
/* Штатный обход CSSOM здесь не работает: правила лежат в файлах, которые
   style.css подключает через @import, и Chrome не отдаёт их содержимое
   обходу листа — в rule.styleSheet.cssRules попадает SecurityError даже на
   своём origin. Цвета проверяются не по таблицам, а на живой кнопке:
   checks/req-other-hover.mjs наводит на неё настоящий курсор и читает
   computed-фон. Здесь оставляем счётчик найденного, чтобы было видно,
   что обход не сработал, а не что правил нет. */
const walk = (rules) => {
  for (const rule of rules) {
    if (rule.cssRules && !rule.selectorText) { walk(rule.cssRules); continue; }
    if (rule.selectorText?.includes('product-card__button') && rule.selectorText.includes(':hover')) {
      hoverRules.push(rule.selectorText);
    }
  }
};
for (const sheet of document.styleSheets) {
  try { walk(sheet.cssRules); } catch { /* кроссдоменный лист — пропускаем */ }
}

/* 5. Порядок в ленте: типы (метка над названием) не повторяются подряд */
const typeLabels = [...track.querySelectorAll('.product-card__subtitle')].map((t) => t.textContent.trim());
const adjacent = typeLabels
  .map((label, i) => (i && label === typeLabels[i - 1] ? `${i}: ${label}` : null))
  .filter(Boolean);

return {
  всего: track.children.length,
  стрелок: section.querySelectorAll('[data-slider-prev], [data-slider-next]').length,
  доступныхЧипсов: types.length,
  ширинаЛенты: Math.round(track.clientWidth),
  ширинаСодержимого: Math.round(track.scrollWidth),
  листается: track.scrollWidth > track.clientWidth + 1,
  кнопки: {
    штук: buttons.length,
    цветовФона: [...new Set(buttonColours)],
    модификаторы: buttonModifiers,
    классы: buttonClasses.filter((c) => !c.includes('product-card__button--pink')
      && !c.includes('product-card__button--blue')),
    теги: [...new Set(buttons.map((b) => b.tagName))],
    найденныхПравилHover: hoverRules.length,
  },
  порядок: {
    первыеВосемь: typeLabels.slice(0, 8),
    соседейОдногоТипа: adjacent,
    всегоТипов: [...new Set(typeLabels)].length,
  },
  потипам: byType,
  steps,
};
