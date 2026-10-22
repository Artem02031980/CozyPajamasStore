/**
 * Запрос: мобильное меню на живой странице.
 *
 * Открывает меню бургером и проверяет геометрию: наложение должно занимать
 * экран от низа шапки до низа окна, все пункты — быть внутри него. Именно
 * это ломалось, когда шапке добавили will-change: transform: наложение
 * сжималось до высоты шапки, и на экране оставалась полоска с последним
 * пунктом.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-header.mjs --widths 375,768 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const header = document.querySelector('.header');
const burger = document.querySelector('[data-burger]');
const nav = document.querySelector('[data-nav]');

const box = (el) => {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return {
    top: Math.round(b.top),
    bottom: Math.round(b.bottom),
    left: Math.round(b.left),
    width: Math.round(b.width),
    height: Math.round(b.height),
  };
};

const headerBox = box(header);

/* До открытия меню скрыто */
const до = {
  менюВидно: nav ? getComputedStyle(nav).display !== 'none' : null,
  ariaExpanded: burger?.getAttribute('aria-expanded') ?? null,
};

press(burger);
await frame();
await wait(700);

const panel = box(nav);
const items = [...nav.querySelectorAll('.header__list > li')].map((li) => ({
  текст: li.textContent.trim(),
  ...box(li),
}));

const открыто = {
  менюОткрыто: nav.classList.contains('is-open'),
  ariaExpanded: burger.getAttribute('aria-expanded'),
  position: getComputedStyle(nav).position,
  фонПрозрачный: getComputedStyle(nav).backgroundColor === 'rgba(0, 0, 0, 0)',
  панель: panel,
  высотаОкна: innerHeight,
  пунктов: items.length,
  пункты: items,

  /* Наложение начинается под шапкой и достаёт до низа окна */
  подШапкой: Math.abs(panel.top - headerBox.bottom) <= 2,
  доНизаОкна: Math.abs(panel.bottom - innerHeight) <= 2,
  наШиринуОкна: Math.abs(panel.width - innerWidth) <= 2,

  /* Все пункты внутри наложения и не наезжают друг на друга */
  всеВидимы: items.every((item) => item.height > 0
    && item.top >= panel.top - 1
    && item.bottom <= panel.bottom + 1),
  безПерекрытий: items.every((item, i) => i === 0 || item.top >= items[i - 1].bottom - 1),
};

/* Закрываем тем же бургером */
press(burger);
await frame();
await wait(300);

const закрыто = {
  менюОткрыто: nav.classList.contains('is-open'),
  ariaExpanded: burger.getAttribute('aria-expanded'),
};

/* Второй способ закрытия — клик по пункту: меню закрывается, переход идёт */
return { окно: `${innerWidth}×${innerHeight}`, до, открыто, закрыто };
