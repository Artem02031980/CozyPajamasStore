/**
 * product.js — поведение страницы товара (/product-pages/*.html).
 *
 * Разметка страницы статична: товар, его характеристики и фото стоят в HTML,
 * поэтому страница читается и без скрипта. Модуль добавляет то, что без него
 * не работает:
 *
 *   1. галерея — стрелки и точки-индикаторы. Кадр сейчас один, но код
 *      рассчитан на любое число снимков: и стрелки, и точки строятся по тому,
 *      что есть в разметке. Когда у товаров появятся вторые ракурсы, менять
 *      модуль не придётся — только добавить файлы;
 *   2. выбор размера — ровно один, и он же уезжает в корзину: кнопка
 *      «Добавить в корзину» читает свой data-cart-size, а модуль его
 *      проставляет. Без скрипта товар добавится без размера, а не с чужим;
 *   3. галочка «Добавить услугу нанесения принта» — кладёт в корзину ту же
 *      услугу, что кнопка «ПРИНТ» на главной (id `print` из cart.js);
 *   4. кнопки выбора макета пока только пишут в консоль: сам выбор макета —
 *      шаг 6, и придумывать ему поведение заранее не нужно.
 *
 * Логика корзины не дублируется: состав, суммы и счётчик ведёт cart.js,
 * события страницы — cart-ui.js.
 */

import { $, $$ } from './utils.js';
import { SERVICE_ID, hasService, getItems, addItem, removeItem, CART_CHANGED } from './cart.js';

/** Класс выбранного размера — тот же, что у выбранного чипса фильтра. */
const ACTIVE = 'is-active';

/** Селекторы страницы: собраны здесь, чтобы не рассыпать строки по коду. */
const SELECTOR = {
  card: '.product__card',
  title: '.product__title',
  size: '[data-product-size]',
  dot: '[data-product-dot]',
  prev: '[data-product-prev]',
  next: '[data-product-next]',
  addButton: '[data-cart-add]',
  service: '[data-product-service]',
  printChoice: '[data-print-choose], [data-print-upload]',
};

/**
 * Показывает кадр по номеру.
 *
 * Кадр один, поэтому показывать нечего: функция переставляет активную точку
 * и гасит стрелки у краёв. Когда снимков станет больше, здесь появится
 * подмена картинки — на устройство галереи это не повлияет.
 *
 * @param {number} index номер кадра
 */
function showFrame(index) {
  const dots = $$(SELECTOR.dot);
  if (!dots.length) return;

  /* Зацикливать листание не будем: у края стрелка гаснет, как в ленте
     «Других товаров» */
  const safe = Math.min(Math.max(index, 0), dots.length - 1);

  dots.forEach((dot, i) => {
    const active = i === safe;
    dot.classList.toggle(ACTIVE, active);
    dot.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  const prev = $(SELECTOR.prev);
  const next = $(SELECTOR.next);

  if (prev) prev.disabled = safe === 0;
  if (next) next.disabled = safe >= dots.length - 1;
}

/** Номер текущего кадра — по активной точке. */
function currentFrame() {
  const index = $$(SELECTOR.dot).findIndex((dot) => dot.classList.contains(ACTIVE));

  return index < 0 ? 0 : index;
}

/**
 * Показывает выбранный размер.
 *
 * Размер ровно один: выбранный чипс снимает выделение с остальных. Повторное
 * нажатие снимает выбор совсем — тогда товар добавится без размера, как
 * из карточки каталога. Правило «нажал ещё раз — снял» уже принято
 * в фильтрах, и здесь оно то же, чтобы поведение не расходилось.
 *
 * @param {HTMLElement|null} chip
 */
function selectSize(chip) {
  const sizes = $$(SELECTOR.size);
  const wasActive = chip?.classList.contains(ACTIVE) ?? false;
  const chosen = wasActive ? null : chip;

  sizes.forEach((size) => {
    size.classList.remove(ACTIVE);
    size.setAttribute('aria-pressed', 'false');
  });

  if (chosen) {
    chosen.classList.add(ACTIVE);
    chosen.setAttribute('aria-pressed', 'true');
  }

  /* Размер уезжает в корзину через атрибут кнопки: cart-ui.js читает
     data-cart-size и по нему отличает одну позицию от другой */
  const addButton = $(SELECTOR.addButton);
  if (addButton) addButton.dataset.cartSize = chosen?.dataset.productSize ?? '';

  /* Размер видно и в названии: без него непонятно, что именно выбрано.
     Базовое название запоминаем в data-атрибуте, иначе при снятии размера
     к нему приклеился бы предыдущий */
  const title = $(SELECTOR.title);
  if (title) {
    const base = title.dataset.baseTitle ?? title.textContent.trim();
    title.dataset.baseTitle = base;
    title.textContent = chosen ? `${base}, размер ${chosen.dataset.productSize}` : base;
  }
}

/**
 * Приводит галочку услуги в соответствие с корзиной.
 *
 * Состояние берём у корзины, а не у галочки: услугу можно убрать в окне
 * корзины, и после этого галочка на странице не должна врать.
 */
function syncServiceCheckbox() {
  const box = $(SELECTOR.service);
  if (!box) return;

  box.checked = hasService(getItems());
}

/** Подключает страницу товара. */
export function initProduct() {
  if (!$(SELECTOR.card)) return;

  // 1. Галерея: стрелки и точки листают по одному кадру
  $(SELECTOR.prev)?.addEventListener('click', () => showFrame(currentFrame() - 1));
  $(SELECTOR.next)?.addEventListener('click', () => showFrame(currentFrame() + 1));

  $$(SELECTOR.dot).forEach((dot) => {
    dot.addEventListener('click', () => showFrame(Number(dot.dataset.productDot)));
  });

  // При одном кадре обе стрелки гаснут — состояния ставит showFrame
  showFrame(currentFrame());

  // 2. Размеры
  $$(SELECTOR.size).forEach((chip) => {
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => selectSize(chip));
  });

  // 3. Услуга нанесения принта
  const service = $(SELECTOR.service);
  if (service) {
    service.addEventListener('change', () => {
      if (service.checked) {
        addItem(SERVICE_ID, { qty: 1 });
      } else {
        removeItem(SERVICE_ID);
      }

      /* cart-ui.js перерисовывает окно корзины и счётчик по этому же
         событию — отдельного канала для страницы товара не нужно */
      document.dispatchEvent(new CustomEvent(CART_CHANGED));
      syncServiceCheckbox();
    });

    document.addEventListener(CART_CHANGED, syncServiceCheckbox);
    syncServiceCheckbox();
  }

  /* 4. Кнопки выбора макета. Выбор макета — шаг 6; сейчас кнопка сообщает
     о себе в консоль, чтобы не выглядеть сломанной. */
  $$(SELECTOR.printChoice).forEach((button) => {
    button.addEventListener('click', () => {
      console.info(`[product] «${button.textContent.trim()}»: выбор макета появится на шаге 6`);
    });
  });
}
