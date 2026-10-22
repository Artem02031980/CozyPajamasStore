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
const sizeModal = document.querySelector('[data-modal="size"]');
const cartBody = document.querySelector('[data-cart-body]');
const cartOpen = document.querySelector('[data-cart-open]');

/**
 * Добавляет товар из карточки так же, как это делает человек: нажимает
 * «В корзину», выбирает размер в открывшемся окне и подтверждает.
 *
 * Раньше здесь хватало одного нажатия, но с окном выбора размера товар
 * без размера в корзину не попадает — и проверка должна идти тем же путём,
 * что и покупатель.
 *
 * @param {HTMLElement} button кнопка «В корзину» в карточке
 * @param {number} [sizeIndex] какой размер выбрать; по умолчанию первый
 */
const addFromCard = async (button, sizeIndex = 0) => {
  press(button);
  await frame();

  const picker = sizeModal.querySelector('[data-size-picker]');
  const chip = [...picker.querySelectorAll('[data-picker-size]')][sizeIndex];

  press(chip);
  await frame();
  press(picker.querySelector('[data-size-confirm]'));
  await frame();
};

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
await addFromCard(addButton);
steps.push({ ...snap('после «В корзину»'), buttonLabel: addButton.textContent.trim(), buttonDisabled: addButton.disabled });

// 2. Вторая карточка — другой товар
const secondButton = [...document.querySelectorAll('.goods-new__grid [data-cart-add]')][1];
await addFromCard(secondButton);
steps.push(snap('после второго товара'));

// 3. Повторное добавление того же товара: количество растёт, позиция не дублируется
await addFromCard(secondButton);
steps.push(snap('повторное добавление второго товара'));

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

// 7. Услуга «ПРИНТ»: кнопки на главной больше нет — принт выбирают
//    в каталоге, а ссылка ведёт на prints.html. Саму услугу добавляем
//    через модуль корзины: правила её подсчёта остались и должны работать.
//    Ссылку НЕ нажимаем: это обычный переход на другую страницу, и запрос
//    вместе с вкладкой умирает. Достаточно того, что у неё нет признака
//    добавления — это видно по атрибутам
const printLink = document.querySelector('.goods-print__button');
const printLinkInfo = {
  тег: printLink?.tagName.toLowerCase() ?? null,
  текст: printLink?.textContent.trim() ?? null,
  адрес: printLink?.getAttribute('href') ?? null,
  цена: printLink?.dataset.printPrice ?? null,
  порог: printLink?.dataset.printFreeFrom ?? null,
  признакДобавления: printLink?.hasAttribute('data-cart-add') ?? null,
};

const printModule = await import('/assets/js/cart.js');
printModule.addItem('print', { qty: 1 });
await frame();
steps.push({ ...snap('добавлена услуга ПРИНТ'), printLabel: printLinkInfo.текст });

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
  принт: printLinkInfo,
  каркасСтраницыПринтов: await fetch('prints.html')
    .then((response) => response.status)
    .catch(() => 'нет ответа'),
};
