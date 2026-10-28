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
 *   2. выбор файла макета для нанесения принта: проверка формата, показ
 *      имени выбранного файла и заявка в корзину. Своего макета нет
 *      в каталоге, и цену за него называет менеджер, поэтому в корзину
 *      уходит позиция «Свой макет» с нулевой суммой и пометкой. Само окно
 *      выбора открывает браузер — кнопка «Добавить свой макет» это label
 *      для скрытого поля с файлом, поэтому работает и без скрипта.
 *
 * Галереи в модуле нет: кадр один, стрелки в разметке выключены, точек
 * не осталось. Листание вернётся вместе со вторыми ракурсами товаров.
 *
 * Логика корзины не дублируется: состав, суммы и счётчик ведёт cart.js,
 * события страницы — cart-ui.js.
 */

import { $, $$ } from './utils.js';
import { addItem, CUSTOM_PRINT_ID } from './cart.js';
import { clearSizeError } from './size-guard.js';

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
 * Классы пометки о файле у страницы товара.
 *
 * Пометка нужна и странице каталога принтов, а классы у неё свои —
 * поэтому загрузку макета можно подключить с другим набором классов
 * (см. initPrintFileUpload). По умолчанию — товарные.
 */
const PRINT_NOTE_BLOCK = 'product__print-file';

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

  /* Выбрали размер — сообщение «Выберите размер» больше не нужно.
     Правило то же, что у ошибок форм: ошибка уходит, как только её
     причину исправили, не дожидаясь повторного нажатия. Снимаем выбор —
     сообщение тоже убираем: размеров нет, и держать ошибку незачем */
  if (chosen) clearSizeError();
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
 * Подпись собирается с иконкой файла: она и означает «файл добавлен».
 * Иконка — фоном пустого элемента (как у кнопки «Выбрать из каталога»),
 * поэтому текст остаётся текстом, а скринридер не читает имя картинки.
 *
 * @param {HTMLElement|null} note
 * @param {{name: string, ok: boolean}|null} file
 * @param {string} [error] текст ошибки; при нём иконки нет
 * @param {string} [block='product__print-file'] префикс классов пометки
 */
function showPrintFileNote(note, file, error = '', block = PRINT_NOTE_BLOCK) {
  if (!note) return;

  if (error) {
    note.textContent = error;
    note.classList.add(`${block}--error`);
    note.classList.remove(`${block}--added`);
    note.hidden = false;
    return;
  }

  if (!file) {
    note.textContent = '';
    note.classList.remove(`${block}--error`, `${block}--added`);
    note.hidden = true;
    return;
  }

  note.classList.remove(`${block}--error`);
  note.classList.add(`${block}--added`);
  note.textContent = '';

  const icon = document.createElement('span');
  icon.className = `${block}-icon`;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = `${block}-text`;
  text.textContent = `Макет добавлен в корзину: ${file.name}. `
    + 'Стоимость уточнит менеджер — он свяжется с вами отдельно.';

  note.append(icon, text);
  note.hidden = false;
}

/**
 * Подключает выбор файла макета.
 *
 * Подходящий файл становится позицией корзины «Свой макет»: цены у неё нет,
 * её называет менеджер после просмотра. Неподходящий не берём вовсе —
 * иначе человек думает, что макет принят.
 *
 * Подключение одно на две страницы: страница товара (там свой набор классов
 * пометки) и каталог принтов (там свой). Поэтому поля и префикс классов
 * передаются параметрами, а по умолчанию берутся товарные.
 *
 * @param {object} [options]
 * @param {HTMLInputElement|null} [options.input] поле выбора файла
 * @param {HTMLElement|null} [options.note] куда писать итог
 * @param {string} [options.block] префикс классов пометки
 */
export function initPrintFileUpload({
  input = $(SELECTOR.printFile),
  note = $(SELECTOR.printFileNote),
  block = PRINT_NOTE_BLOCK,
} = {}) {
  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files?.[0] ?? null;
    if (!file) {
      showPrintFileNote(note, null, '', block);
      return;
    }

    const { name, ok } = checkPrintFile(file);

    if (!ok) {
      showPrintFileNote(note, null, 'Файл не подходит. Нужен PDF, JPG, PNG, PSD или TIFF.', block);
      input.value = '';
      return;
    }

    showPrintFileNote(note, { name, ok }, '', block);

    /* Позиция одна на все макеты: повторная загрузка заменяет файл,
       а не плодит вторую заявку (см. addItem в cart.js) */
    addItem(CUSTOM_PRINT_ID, { qty: 1, file: name });
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
  initPrintFileUpload();
}

