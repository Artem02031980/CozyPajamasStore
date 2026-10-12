/**
 * Запрос: корзина на главной странице.
 *
 * Проверяет всю цепочку: кнопка «В корзину» → счётчик в шапке → окно
 * корзины → количество → удаление → очистка → пустое состояние.
 * Плюс поведение окна: ESC, клик по фону, блокировка прокрутки, возврат
 * фокуса и ловушка Tab.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8000/ \
 *     --request checks/req-cart.mjs --widths 1024
 *
 * Логику состава отдельно проверяет checks/cart.mjs — без браузера.
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const pressKey = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

const counter = document.querySelector('[data-cart-counter]');
const cartModal = document.querySelector('[data-modal="cart"]');
const cartBody = document.querySelector('[data-cart-body]');
const cartOpen = document.querySelector('[data-cart-open]');

/** Снимок состояния корзины и окна. */
const snap = (step) => ({
  step,
  counter: counter.textContent.trim(),
  stored: (() => {
    try { return JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]'); } catch { return 'битый JSON'; }
  })(),
  modalHidden: cartModal.classList.contains('is-hidden'),
  ariaHidden: cartModal.getAttribute('aria-hidden'),
  bodyOverflow: getComputedStyle(document.body).overflow,
  items: [...cartBody.querySelectorAll('[data-cart-line]')].map((li) => ({
    id: li.dataset.cartLine,
    qty: li.querySelector('[data-cart-qty]')?.textContent.trim(),
    price: li.querySelector('.cart__price')?.textContent.trim(),
  })),
  total: cartBody.querySelector('[data-cart-total]')?.textContent.trim() ?? null,
  empty: Boolean(cartBody.querySelector('.cart__empty')),
  focused: document.activeElement?.className || document.activeElement?.tagName,
  inModal: cartModal.contains(document.activeElement),
});

const steps = [];

// Чистый старт: корзина могла остаться от прошлого прогона
localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();
steps.push(snap('старт с пустой корзиной'));

// 1. Кнопка «В корзину» на первой карточке
const addButton = document.querySelector('.goods-new__grid [data-cart-add]');
const addedId = addButton.dataset.cartAdd;
press(addButton);
await frame();
steps.push({ ...snap('после «В корзину»'), buttonLabel: addButton.textContent.trim(), buttonDisabled: addButton.disabled });

// 2. Вторая карточка — другой товар
const secondButton = [...document.querySelectorAll('.goods-new__grid [data-cart-add]')][1];
press(secondButton);
await frame();
steps.push(snap('после второго товара'));

// 3. Повторное нажатие той же кнопки: количество растёт, позиция не дублируется
press(secondButton);
await frame();
steps.push(snap('повторное нажатие второго товара'));

// 4. Открываем окно корзины кнопкой в шапке
press(cartOpen);
await frame();
steps.push(snap('окно открыто'));

// 5. Шаг количества «+» у первой позиции
press(cartBody.querySelector('[data-cart-step="1"]'));
await frame();
steps.push(snap('количество +1'));

// 6. Шаг «−» дважды: второй должен удалить позицию
press(cartBody.querySelector('[data-cart-step="-1"]'));
await frame();
steps.push(snap('количество −1'));
press(cartBody.querySelector('[data-cart-step="-1"]'));
await frame();
steps.push(snap('количество −1 второй раз'));

// 7. Услуга «ПРИНТ»: добавляем и смотрим итог
const printButton = document.querySelector('[data-cart-add="print"]');
press(printButton);
await frame();
steps.push({ ...snap('добавлена услуга ПРИНТ'), printLabel: printButton.textContent.trim() });

// 8. Очистка корзины
const clearButton = cartBody.querySelector('[data-cart-clear]');
if (clearButton) { press(clearButton); await frame(); }
steps.push(snap('после очистки'));

// 9. Пустое состояние: кнопка «Вернуться к покупкам» закрывает окно
const continueButton = cartBody.querySelector('[data-modal-close]');
if (continueButton) { press(continueButton); await frame(); }
steps.push(snap('закрыто кнопкой в пустой корзине'));

// 10. Добавляем товар и закрываем по ESC
press(addButton);
await frame();
press(cartOpen);
await frame();
const beforeEsc = snap('окно открыто перед ESC');
pressKey('Escape');
await frame();
steps.push({ ...beforeEsc, step: 'перед ESC' });
steps.push(snap('после ESC'));

// 11. Клик по затемнению закрывает окно
press(cartOpen);
await frame();
const overlay = cartModal.querySelector('[data-modal-close]');
press(overlay);
await frame();
steps.push(snap('после клика по фону'));

// 12. Ловушка фокуса: Tab с последнего элемента уходит на первый
press(cartOpen);
await frame();
const focusables = [...cartModal.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')]
  .filter((el) => el.offsetParent !== null);
const last = focusables[focusables.length - 1];
last.focus();
pressKey('Tab');
await frame();
const trap = {
  step: 'ловушка Tab',
  count: focusables.length,
  wentToFirst: document.activeElement === focusables[0],
  stillInside: cartModal.contains(document.activeElement),
  focusedClass: document.activeElement?.className,
};
pressKey('Escape');
await frame();

// 13. Уборка за собой
localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));

return {
  addedId,
  addButtonsInCatalog: document.querySelectorAll('[data-cart-add]').length,
  steps,
  trap,
};
