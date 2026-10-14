/**
 * Запрос: кнопка «В корзину» в «Других товарах» при наведении.
 *
 * Наведение делает сам харнесс настоящим вводом (--mouse-to), поэтому
 * :hover здесь живой. Раньше проверка падала: CSS.forcePseudoState
 * замораживает пересчёт стилей, и цвет перестаёт обновляться.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8123/ \
 *     --request checks/req-other-hover.mjs --widths 1280 --no-preflight \
 *     --mouse-to "#goods-other .product-card__button"
 */

const button = document.querySelector('#goods-other .product-card__button');
const size = button.getBoundingClientRect();
const style = getComputedStyle(button);
const image = button.closest('.product-card')?.querySelector('.product-card__image');

return {
  наведён: button.matches(':hover'),
  класс: button.className,
  фон: style.backgroundColor,
  цветТекста: style.color,
  курсор: style.cursor,
  рамка: style.borderTopWidth + ' ' + style.borderTopColor,
  вОбластиВидимости: size.top >= 0 && size.bottom <= innerHeight,
  координаты: { top: Math.round(size.top), left: Math.round(size.left) },
  размер: { ширина: Math.round(size.width), высота: Math.round(size.height) },
  товар: image?.alt ?? null,
};
