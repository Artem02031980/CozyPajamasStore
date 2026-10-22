/**
 * size-picker.js — выбор размера перед добавлением товара в корзину.
 *
 * Кнопка «В корзину» в карточке каталога не может положить товар в корзину
 * сразу: размер там не выбран. Поэтому клик открывает окно с размерами,
 * и товар попадает в корзину только после подтверждения.
 *
 * Признак такого поведения — атрибут data-select-size у кнопки: его ставит
 * render.js, а cart-ui.js по нему отступает и товар сам не добавляет.
 * Поэтому кнопка страницы товара (там размер выбирается на месте) и кнопка
 * услуги «ПРИНТ» работают как раньше, без окна.
 *
 * Размеры берутся из данных: у одежды S–XXL, у «Других товаров» —
 * «Единый размер» (см. getSizes в data.js).
 */

import { $, $$ } from './utils.js';
import { getProduct, getSizes } from './data.js';
import { addItem } from './cart.js';
import { openModalByName, close } from './modal.js';
import { showAdded } from './cart-ui.js';

/** Имя окна: значение data-modal в разметке. */
const MODAL = 'size';

/** Класс выбранного размера — как у чипсов фильтров и размеров товара. */
const ACTIVE = 'is-active';

const SELECTOR = {
  body: '[data-size-picker]',
  size: '[data-picker-size]',
  error: '[data-picker-error]',
  confirm: '[data-size-confirm]',
};

/**
 * Кнопка, которая открыла окно. Ей показываем отзыв «В корзине» после
 * добавления: человек нажимал именно её, и подтверждение должно быть там же.
 * @type {HTMLElement|null}
 */
let opener = null;

/**
 * Рисует в окне товар и его размеры.
 *
 * Разметку собираем заново на каждое открытие: окно одно на всю страницу,
 * а карточек десятки, и держать в разметке по окну на товар незачем.
 *
 * @param {object} product товар из каталога
 */
function render(product) {
  const body = $(SELECTOR.body);
  if (!body) return;

  const sizes = getSizes(product);

  /* Вид товара и акцент окна — в атрибутах, по ним стили выбирают цвета.
     Акцент задаётся полем accent у товара (в «Новой коллекции» так
     выделены отдельные товары); у мужской коллекции голубой приходит
     от вида товара — это правило живёт в CSS */
  body.dataset.section = product.section ?? '';
  body.dataset.accent = product.accent ?? '';

  body.innerHTML = `
    <p class="size-picker__product">${product.title}</p>

    <div class="size-picker__sizes" role="group" aria-label="Размер">
      ${sizes
    .map((size) => `
        <button class="size-picker__size" type="button" data-picker-size="${size}"
                aria-pressed="false">${size}</button>`)
    .join('')}
    </div>

    <p class="size-picker__error" data-picker-error role="alert" hidden>Выберите размер</p>

    <button class="size-picker__confirm button" type="button"
            data-size-confirm data-product-id="${product.id}">Добавить в корзину</button>
  `;
}

/** Показывает или скрывает сообщение «Выберите размер». */
function toggleError(show) {
  const box = $(SELECTOR.error);
  if (!box) return;

  box.hidden = !show;
}

/** Выбирает один размер: активным остаётся ровно один чипс. */
function selectSize(chip) {
  $$(SELECTOR.size).forEach((item) => {
    const active = item === chip;
    item.classList.toggle(ACTIVE, active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  toggleError(false);
}

/** Добавляет товар в корзину с выбранным размером. */
function confirm() {
  const chip = $(`.size-picker__size.${ACTIVE}`);
  const button = $(SELECTOR.confirm);

  if (!chip) {
    toggleError(true);
    $(SELECTOR.size)?.focus();
    return;
  }

  addItem(button.dataset.productId, { qty: 1, size: chip.dataset.pickerSize });

  if (opener) showAdded(opener);
  opener = null;

  close();
}

/** Подключает окно выбора размера. */
export function initSizePicker() {
  /* Один слушатель на документ: карточки перерисовывают фильтры
     и пагинация, и обработчики на самих кнопках терялись бы */
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // 1. Кнопка «В корзину» в карточке — открыть окно выбора размера
    const cardButton = target.closest('[data-select-size]');
    if (cardButton) {
      event.preventDefault();

      const product = getProduct(cardButton.dataset.cartAdd);
      if (!product) return;

      opener = cardButton;
      render(product);
      openModalByName(MODAL);

      /* Фокус — на первый размер: modal.js ставит его на крестик,
         а человек пришёл выбирать размер */
      $(SELECTOR.size)?.focus();
      return;
    }

    // 2. Выбор размера
    const chip = target.closest(SELECTOR.size);
    if (chip) {
      event.preventDefault();
      selectSize(chip);
      return;
    }

    // 3. Подтверждение: только теперь товар уходит в корзину
    if (target.closest(SELECTOR.confirm)) {
      event.preventDefault();
      confirm();
    }
  });
}
