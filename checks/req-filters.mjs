/**
 * Запрос: работа фильтров, сортировки и счётчика в женской коллекции.
 *
 * Проверяет связку «клик по кнопке → изменение сетки», а не только логику
 * отбора: логику отдельно проверяет checks/filters.mjs без браузера.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8000/ \
 *     --request checks/req-filters.mjs --widths 1024,1280
 *
 * Ожидание: после фильтра страница сбрасывается на первую, счётчик
 * показывает число найденного, «Сбросить фильтры» возвращает все 9.
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const section = document.querySelector('#goods-women');
const grid = section.querySelector('.goods-women__grid');
const form = section.querySelector('#goods-women-filters');
const count = section.querySelector('[data-goods-count]');
const nav = document.querySelector('nav.pagination[data-section="women"]');
const sort = section.querySelector('[data-goods-sort]');

/** Нажимает кнопку так же, как это делает человек. */
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const chip = (text) => [...form.querySelectorAll('.filters__chip')]
  .find((b) => b.textContent.trim() === text);
const color = (label) => [...form.querySelectorAll('.filters__color')]
  .find((b) => b.getAttribute('aria-label') === label);

const snapshot = (step) => ({
  step,
  cards: grid.children.length,
  titles: [...grid.querySelectorAll('.product-card__title')].map((t) => t.textContent.trim()),
  count: count?.textContent.trim() ?? null,
  activePage: nav.querySelector('.is-active')?.textContent.trim() ?? null,
  pages: nav.querySelectorAll('[data-page]').length,
  paginationHidden: nav.classList.contains('is-hidden'),
  activeChips: [...form.querySelectorAll('.filters__chip.is-active')].map((b) => b.textContent.trim()),
  activeColors: [...form.querySelectorAll('.filters__color.is-active')].map((b) => b.getAttribute('aria-label')),
});

const steps = [snapshot('старт')];

// 1. Тип: «Халатик» — два товара
press(chip('Халатик'));
await frame();
steps.push(snapshot('тип Халатик'));

// 2. Добавляем второй тип: внутри группы работает «или»
press(chip('Свитшот'));
await frame();
steps.push(snapshot('Халатик + Свитшот'));

// 3. Снимаем всё кнопкой сброса
press(form.querySelector('.filters__reset'));
await frame();
steps.push(snapshot('после сброса'));

// 4. Цвет: «Розовый» — пять товаров
press(color('Розовый'));
await frame();
steps.push(snapshot('цвет Розовый'));

// 5. Цена в паре с цветом: между группами «и»
press(chip('до 4999₽'));
await frame();
steps.push(snapshot('Розовый + до 4999'));

// 6. Сброс и сортировка по цене
press(form.querySelector('.filters__reset'));
await frame();
sort.value = 'price-asc';
sort.dispatchEvent(new Event('change', { bubbles: true }));
await frame();
const prices = [...grid.querySelectorAll('.product-card__price')].map((el) => el.textContent.trim());
steps.push({ ...snapshot('сортировка по цене'), prices });

// 7. Пагинация после всех проверок: переход на вторую и обратно
const page2 = nav.querySelector('[data-page="2"]');
if (page2) {
  press(page2);
  await frame();
  steps.push(snapshot('страница 2'));
  press(nav.querySelector('[data-page="1"]'));
  await frame();
  steps.push(snapshot('назад на 1'));
} else {
  steps.push({ step: 'кнопки страниц нет', pages: nav.querySelectorAll('[data-page]').length });
}

// 8. Пустой результат: несовместимая пара условий
press(form.querySelector('.filters__reset'));
await frame();
press(chip('Свитшот'));
await frame();
press(color('Зелёный'));
await frame();
steps.push({
  ...snapshot('Свитшот + Зелёный (пусто)'),
  emptyText: grid.querySelector('.goods__empty')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
});

/* 9. Обводка фокуса у сортировки: у каждой коллекции свой цвет.
   Чтобы :focus-visible сработал, нужен настоящий ввод с клавиатуры —
   харнесс нажимает Tab перед запуском запроса (--press-tab 1).
   Программный .focus() этот псевдокласс не включает, и проверка молча
   показала бы цвет без фокуса. */
const outlineOf = (selector) => {
  const el = document.querySelector(selector);
  el.focus();
  const cs = getComputedStyle(el);
  const out = {
    visible: el.matches(':focus-visible'),
    color: cs.outlineColor,
    width: cs.outlineWidth,
    style: cs.outlineStyle,
  };
  el.blur();
  return out;
};

// Ожидаемые цвета: --color-pink #cd74a2 и --color-blue #93b3d6
const EXPECTED = { women: 'rgb(205, 116, 162)', men: 'rgb(147, 179, 214)' };
const outlineWomen = outlineOf('#goods-women [data-goods-sort]');
const outlineMen = outlineOf('#goods-men [data-goods-sort]');

/* 10. Кружки палитры: у выбранного цвета кольцо, у фокуса обводка,
   и это разные вещи. Раньше выбор пытались показать через border-color,
   но шорткат `border: 1px solid` в блоке перебивал правило по специфичности
   (0-2-0 против 0-1-0), и выбранный цвет на цветных кружках не отличался
   от невыбранного. Здесь это ловится: idle без кольца, is-active с кольцом. */
const swatchOf = (section, label) =>
  document.querySelector(`#goods-${section}-filters .filters__color[aria-label="${label}"]`);

const swatchState = (section, label) => {
  const el = swatchOf(section, label);
  const idleRing = getComputedStyle(el).boxShadow;
  el.classList.add('is-active');
  const activeRing = getComputedStyle(el).boxShadow;
  el.focus();
  const cs = getComputedStyle(el);
  const out = {
    idleRing,
    activeRing,
    focusVisible: el.matches(':focus-visible'),
    focusOutline: cs.outlineColor,
    focusOutlineWidth: cs.outlineWidth,
    selectedAndFocused: activeRing !== 'none' && cs.outlineColor === EXPECTED[section],
  };
  el.blur();
  el.classList.remove('is-active');
  return out;
};

const swatches = {
  women: swatchState('women', 'Розовый'),
  men: swatchState('men', 'Синий'),
};

return {
  perPage: steps[0].cards,
  resetButton: Boolean(form.querySelector('.filters__reset')),
  sortValue: sort?.value,
  outline: {
    women: outlineWomen,
    men: outlineMen,
    womenExpected: EXPECTED.women,
    menExpected: EXPECTED.men,
    womenOk: outlineWomen.visible && outlineWomen.color === EXPECTED.women,
    menOk: outlineMen.visible && outlineMen.color === EXPECTED.men,
  },
  swatches,
  steps,
};
