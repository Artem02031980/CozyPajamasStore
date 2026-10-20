/**
 * product.js — поведение страницы товара (/product-pages/*.html).
 *
 * Разметка страницы статична: товар, его характеристики и фото стоят в HTML,
 * поэтому страница читается и без скрипта. Модуль добавляет то, что без него
 * не работает:
 *
 *   1. выбор размера — ровно один, и он же уезжает в корзину: кнопка
 *      «Добавить в корзину» читает свой data-cart-size, а модуль его
 *      проставляет. Без скрипта товар добавится без размера, а не с чужим;
 *   2. выбор файла макета для нанесения принта: проверка формата и показ
 *      имени выбранного файла. Само окно выбора открывает браузер — кнопка
 *      «Добавить свой макет» это label для скрытого поля с файлом, поэтому
 *      работает и без скрипта.
 *
 * Галереи в модуле нет: кадр один, стрелки в разметке выключены, точек
 * не осталось. Листание вернётся вместе со вторыми ракурсами товаров.
 *
 * Логика корзины не дублируется: состав, суммы и счётчик ведёт cart.js,
 * события страницы — cart-ui.js.
 */

import { $, $$ } from './utils.js';

/** Класс выбранного размера — тот же, что у выбранного чипса фильтра. */
const ACTIVE = 'is-active';

/**
 * Форматы файла макета. Список дублирует accept у поля: в системном окне
 * выбора можно переключиться на «Все файлы» и выбрать что угодно, поэтому
 * одной разметки мало — формат проверяется ещё и здесь.
 */
export const PRINT_FILE_FORMATS = ['.pdf', '.jpg', '.jpeg', '.png', '.psd', '.tiff', '.tif'];

/** Селекторы страницы: собраны здесь, чтобы не рассыпать строки по коду. */
const SELECTOR = {
  card: '.product__card',
  size: '[data-product-size]',
  chosenSize: '[data-product-size-chosen]',
  printFile: '[data-print-upload]',
  printFileNote: '[data-print-file]',
};

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

  /* Размер уезжает в корзину и в покупку в один клик через атрибут кнопки:
     cart-ui.js читает data-cart-size и по нему отличает одну позицию
     от другой, а checkout.js берёт его для заказа */
  $$('[data-cart-add], [data-buy-now]').forEach((button) => {
    button.dataset.cartSize = chosen?.dataset.productSize ?? '';
  });

  /* Выбранный размер показываем отдельной строкой под названием, а не
     дописываем в само название: название — имя товара, и размер в нём
     читался бы как часть имени. Снимаем выбор — строку убираем совсем */
  const note = $(SELECTOR.chosenSize);
  if (note) {
    note.textContent = chosen ? `Размер ${chosen.dataset.productSize}` : '';
    note.hidden = !chosen;
  }
}

/**
 * Разбирает выбранный файл: имя, расширение, подходит ли формат.
 *
 * Отдельной функцией, потому что её проверяют без браузера
 * (checks/product.mjs): у правила формата должны быть тесты.
 *
 * @param {File|null} file
 * @returns {{name: string, extension: string, ok: boolean}}
 */
export function checkPrintFile(file) {
  const name = String(file?.name ?? '');
  const dot = name.lastIndexOf('.');
  const extension = dot < 0 ? '' : name.slice(dot).toLowerCase();

  return { name, extension, ok: PRINT_FILE_FORMATS.includes(extension) };
}

/**
 * Показывает итог выбора файла под кнопками.
 *
 * @param {HTMLElement|null} note
 * @param {string} text
 * @param {boolean} isError
 */
function showPrintFileNote(note, text, isError) {
  if (!note) return;

  note.textContent = text;
  note.classList.toggle('product__print-file--error', isError);
  note.hidden = !text;
}

/**
 * Подключает выбор файла макета.
 * @param {HTMLInputElement|null} input
 */
function initPrintUpload(input) {
  if (!input) return;

  const note = $(SELECTOR.printFileNote);

  input.addEventListener('change', () => {
    const file = input.files?.[0] ?? null;
    if (!file) {
      showPrintFileNote(note, '', false);
      return;
    }

    const { name, ok } = checkPrintFile(file);

    if (ok) {
      showPrintFileNote(note, `Выбран файл: ${name}`, false);
      return;
    }

    /* Файл неподходящего формата не держим в поле: иначе человек думает,
       что макет принят. Сбрасываем выбор и говорим, что нужно */
    showPrintFileNote(note, 'Файл не подходит. Нужен PDF, JPG, PNG, PSD или TIFF.', true);
    input.value = '';
  });
}

/** Подключает страницу товара. */
export function initProduct() {
  if (!$(SELECTOR.card)) return;

  /* Галереи в модуле нет: кадр один, стрелки в разметке выключены, точек
     нет. Листание вернётся вместе со вторыми ракурсами — тогда понадобится
     и модель кадров, которой сейчас просто нечего листать */

  // 1. Размеры
  $$(SELECTOR.size).forEach((chip) => {
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => selectSize(chip));
  });

  // 2. Выбор файла макета для принта
  initPrintUpload($(SELECTOR.printFile));
}
