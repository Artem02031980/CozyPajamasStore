/**
 * Запрос: окно выбора размера перед добавлением в корзину.
 *
 * Проверяет главное: кнопка «В корзину» в карточке сначала открывает окно,
 * без выбора размера товар не добавляется, и только после подтверждения
 * позиция попадает в корзину вместе с размером.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-size-picker.mjs --widths 1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const modal = document.querySelector('[data-modal="size"]');
const body = modal?.querySelector('[data-size-picker]');
const cartModal = document.querySelector('[data-modal="cart"]');

const cartItems = () => JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]');

/* Чистое начало: корзина пуста */
localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const cardButton = document.querySelector('.goods-new__item [data-select-size]');
const cardTitle = cardButton
  ?.closest('.product-card')
  ?.querySelector('.product-card__title')
  ?.textContent.trim() ?? null;

const snapshot = (step) => ({
  step,
  окноОткрыто: modal ? !modal.classList.contains('is-hidden') : null,
  товарВОкне: body?.querySelector('.size-picker__product')?.textContent.trim() ?? null,
  размеров: body?.querySelectorAll('[data-picker-size]').length ?? 0,
  активных: body?.querySelectorAll('.size-picker__size.is-active').length ?? 0,
  ошибкаВидна: body?.querySelector('[data-picker-error]')
    ? !body.querySelector('[data-picker-error]').hidden
    : null,
  корзина: cartItems(),
  подписьКнопки: cardButton?.textContent.trim() ?? null,
});

const steps = [snapshot('до нажатия')];

/* 1. Клик по «В корзину» в карточке: окно, товар в корзину НЕ попал */
press(cardButton);
await frame();
await wait(120);
steps.push(snapshot('после клика по «В корзину»'));

/* 2. Подтверждение без размера: ошибка, корзина по-прежнему пуста */
press(body?.querySelector('[data-size-confirm]'));
await frame();
await wait(120);
steps.push(snapshot('подтверждение без размера'));

/* 3. Выбрали размер — ошибка уходит */
const chips = [...(body?.querySelectorAll('[data-picker-size]') ?? [])];
press(chips[1] ?? chips[0]);
await frame();
await wait(80);
steps.push(snapshot('выбран размер'));

/* 4. Подтверждение с размером: товар в корзине, окно закрыто */
press(body?.querySelector('[data-size-confirm]'));
await frame();
await wait(150);
steps.push(snapshot('подтверждение с размером'));

const sizeAfter = cartItems()[0]?.size ?? null;

/* 5. «Другие товары»: у них размер один — «Единый размер» */
localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const otherButton = document.querySelector('.goods-other__item [data-select-size]');
press(otherButton);
await frame();
await wait(120);

const otherPicker = {
  окноОткрыто: !modal.classList.contains('is-hidden'),
  размеров: body.querySelectorAll('[data-picker-size]').length,
  подписи: [...body.querySelectorAll('[data-picker-size]')].map((c) => c.textContent.trim()),
  корзинаПуста: cartItems().length === 0,
};

/* Закрываем окно и убираем за собой */
press(modal.querySelector('[data-modal-close]'));
await frame();
localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));

/* Сколько кнопок вообще открывают окно: на главной это все карточки */
return {
  шаги: steps,
  товарКарточки: cardTitle,
  размерПослеДобавления: sizeAfter,
  другиеТовары: otherPicker,
  кнопокСВыборомРазмера: document.querySelectorAll('[data-select-size]').length,
  карточекНаСтранице: document.querySelectorAll('.product-card').length,
  кнопкаПринтаБезВыбора: document.querySelectorAll('[data-cart-add="print"]:not([data-select-size])').length,
  окноКорзиныТронуто: cartModal ? !cartModal.classList.contains('is-hidden') : null,
};
