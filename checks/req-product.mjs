/**
 * Запрос: страница товара «Клубничные поля».
 *
 * Проверяет раскладку, работу размеров и добавление товара в корзину:
 * без браузера этого не увидеть — computed-стили и корзина живут тут.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/product-pages/klubnichnye-polya.html \
 *     --request checks/req-product.mjs --widths 375,768,1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const box = (el) => {
  const b = el.getBoundingClientRect();
  return {
    top: Math.round(b.top), left: Math.round(b.left),
    right: Math.round(b.right), bottom: Math.round(b.bottom),
    width: Math.round(b.width), height: Math.round(b.height),
  };
};
const cs = (el) => getComputedStyle(el);

const card = document.querySelector('.product__card');
const image = document.querySelector('.product__image');
const title = document.querySelector('.product__title');
const price = document.querySelector('.product__price');
const sizes = [...document.querySelectorAll('[data-product-size]')];
const addButton = document.querySelector('[data-cart-add]');
const prev = document.querySelector('[data-product-prev]');
const next = document.querySelector('[data-product-next]');
const modal = document.querySelector('[data-modal="cart"]');

localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const layout = {
  ширинаОкна: innerWidth,
  карточка: box(card),
  ширинаКарточки: box(card).width,
  фонСтраницы: cs(document.body).backgroundColor,
  фоноваяКартинка: cs(document.body).backgroundImage === 'none'
    ? 'нет'
    : cs(document.body).backgroundImage.slice(0, 60),
  колонки: cs(card).gridTemplateColumns.split(' ').length,
  фото: box(image),
  ширинаФото: box(image).width,
  высотаФото: box(image).height,

  /* Точек-индикаторов быть не должно: их убрали при одном кадре */
  точекуНаСтранице: document.querySelectorAll('[data-product-dot]').length,

  /* Стрелки: до 768px лежат внутри галереи, дальше — внутри карточки
     у её краёв. Считаем от края карточки: отрицательное число означает
     «за карточкой» */
  стрелкаСлева: box(prev).left - box(card).left,
  стрелкаСправаОтГалереи: box(document.querySelector('.product__gallery')).right
    - box(next).right,
  карточкаУжеКонтейнера: box(card).width < document.querySelector('.product__inner').clientWidth,
  поГоризонталиПрокрутка: document.documentElement.scrollWidth > innerWidth,
};

const typography = {
  цена: { текст: price.textContent.trim(), размер: cs(price).fontSize, цвет: cs(price).color },
  название: { текст: title.textContent.trim(), размер: cs(title).fontSize, цвет: cs(title).color },
  описание: cs(document.querySelector('.product__text')).fontSize,
  характеристика: cs(document.querySelector('.product__details-name')).fontSize,
};

// ─── размеры: выбор ровно одного и уход в корзину ───

/* Выбранный размер показывается отдельной строкой под названием, а не
   дописывается в само название: имя товара не должно меняться от выбора */
const sizeNote = document.querySelector('[data-product-size-chosen]');
const chosenNote = () => (sizeNote && !sizeNote.hidden ? sizeNote.textContent.trim() : null);

const sizeSteps = [];
sizeSteps.push({
  step: 'до выбора',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  dataCartSize: addButton.dataset.cartSize,
  подпись: chosenNote(),
  заголовок: title.textContent.trim(),
});

press(sizes.find((s) => s.dataset.productSize === 'M'));
await frame();
sizeSteps.push({
  step: 'выбран M',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  активный: sizes.find((s) => s.classList.contains('is-active'))?.textContent.trim() ?? null,
  dataCartSize: addButton.dataset.cartSize,
  подпись: chosenNote(),
  заголовок: title.textContent.trim(),
  кегльПодписи: sizeNote ? cs(sizeNote).fontSize : null,
  цветПодписи: sizeNote ? cs(sizeNote).color : null,
  кегльНазвания: cs(title).fontSize,
  размерФона: cs(sizes.find((s) => s.classList.contains('is-active'))).backgroundColor,
});

press(sizes.find((s) => s.dataset.productSize === 'XXL'));
await frame();
sizeSteps.push({
  step: 'переключили на XXL',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  dataCartSize: addButton.dataset.cartSize,
  подпись: chosenNote(),
  заголовок: title.textContent.trim(),
});

press(sizes.find((s) => s.dataset.productSize === 'XXL'));
await frame();
sizeSteps.push({
  step: 'сняли выбор повторным нажатием',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  dataCartSize: addButton.dataset.cartSize,
  подпись: chosenNote(),
  заголовок: title.textContent.trim(),
});

// ─── добавление в корзину с выбранным размером ───

const labelBefore = document.querySelector('[data-cart-label]').textContent.trim();

press(sizes.find((s) => s.dataset.productSize === 'XL'));
await frame();
press(addButton);
await frame();
await new Promise((r) => setTimeout(r, 200));

/* Отзыв на кнопке не должен стирать иконку: текст меняется у подписи,
   а не у всей кнопки. Раньше присваивание button.textContent уносило иконку
   вместе с текстом, и она пропадала после первого же нажатия */
const feedback = {
  текстОтзыва: document.querySelector('[data-cart-label]').textContent.trim(),
  иконкаНаМесте: Boolean(document.querySelector('.product__button-icon--cart')),
  ширинаИконки: Math.round(
    (document.querySelector('.product__button-icon--cart')?.getBoundingClientRect().width ?? 0),
  ),
  классКнопки: addButton.className,
};

const cartAfterAdd = JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]');

// ─── декоративный разделитель ───

/* Кольцо между описанием и характеристиками. Проверяем, что браузер взял
   файл своей коллекции (а не 404 и не чужой), что оно 40×40 и стоит ровно
   между текстом описания и заголовком характеристик */
const divider = document.querySelector('.product__divider');
const descriptionText = document.querySelector('.product__text');
const detailsTitle = [...document.querySelectorAll('.product__block-title')]
  .find((el) => el.textContent.trim().startsWith('Характеристики'));

const dividerInfo = (() => {
  if (!divider) return { найден: false };

  const b = box(divider);
  const url = cs(divider).backgroundImage;

  return {
    найден: true,
    картинка: url && url !== 'none' ? url.split('/').pop().replace(/["')]/g, '') : 'нет картинки',
    ширина: b.width,
    высота: b.height,
    ariaHidden: divider.getAttribute('aria-hidden'),
    текстВнутри: divider.textContent.trim(),
    порядокВерный: Boolean(descriptionText && detailsTitle)
      && b.top >= box(descriptionText).bottom
      && box(detailsTitle).top >= b.top,
  };
})();

// ─── галерея при одном кадре ───

/* Точек нет, стрелки выключены в разметке. Клик по выключенной стрелке
   не должен ничего менять и не должен ронять страницу */
const gallery = {
  точекуНаСтранице: document.querySelectorAll('[data-product-dot]').length,
  контейнерТочек: Boolean(document.querySelector('.product__dots')),
  стрелкаНазадВыключена: prev.disabled,
  стрелкаВперёдВыключена: next.disabled,
  кликВперёдНеПадает: (() => {
    press(next);
    return document.querySelector('.product__image') !== null;
  })(),
};

// ─── нанесение принта ───

/* Галочки услуги больше нет, вместо неё текст и две кнопки:
   ссылка на каталог и выбор файла. Файл подкладываем через DataTransfer —
   так же, как его выбрал бы человек в системном окне */
const printTitle = document.querySelector('.product__print-title');
const printFile = document.querySelector('[data-print-upload]');
const printNote = document.querySelector('[data-print-file]');
const printChoose = document.querySelector('.product__print a');

const chooseLink = {
  текст: printChoose?.textContent.trim() ?? null,
  адрес: printChoose?.getAttribute('href') ?? null,
};

/** Что сейчас в хранилище корзины. */
const storedCart = () => {
  try {
    return JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]');
  } catch {
    return 'битый JSON';
  }
};

/** Кладёт в поле файл с заданным именем и шлёт change. */
const pickFile = async (name) => {
  const transfer = new DataTransfer();
  transfer.items.add(new File(['x'], name, { type: 'application/octet-stream' }));
  printFile.files = transfer.files;
  printFile.dispatchEvent(new Event('change', { bubbles: true }));
  await frame();
  await new Promise((r) => setTimeout(r, 60));

  const custom = storedCart().find?.((line) => line.id === 'print-custom') ?? null;

  return {
    имя: name,
    подпись: printNote?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    подписьВидна: printNote ? !printNote.hidden : null,
    иконка: Boolean(printNote?.querySelector('.product__print-file-icon')),
    ошибка: printNote?.classList.contains('product__print-file--error') ?? null,
    осталосьВПоле: printFile.files.length,

    /* Свой макет уходит в корзину только при подходящем формате */
    вКорзине: custom,
  };
};

/* Перед проверкой макетов корзину очищаем: в ней мог остаться товар
   от предыдущих шагов */
localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const printFiles = {
  текст: printTitle?.textContent.trim() ?? null,
  accept: printFile?.getAttribute('accept') ?? null,
  типПоля: printFile?.getAttribute('type') ?? null,
  чекбоксов: document.querySelectorAll('input[type="checkbox"]').length,
  ссылка: chooseLink,
  pdf: await pickFile('макет.pdf'),
  psd: await pickFile('макет.psd'),
  doc: await pickFile('документ.doc'),
};

/* Один макет — одна позиция: повторная загрузка заменяет файл,
   а не добавляет вторую заявку */
const customLines = storedCart().filter((line) => line.id === 'print-custom');

const customInCart = {
  позиций: customLines.length,
  файл: customLines[0]?.file ?? null,
  количество: customLines[0]?.qty ?? null,
};

localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));

// ─── «Купить в один клик» требует размер ───

/* Кнопка оформляет заказ и уводит на thanks-cart.html, но только когда
   размер выбран. Без размера вкладка остаётся на месте, а рядом
   с размерами появляется «Выберите размер» — вот это и проверяем:
   переход сюда не входит, его проверяет сквозной checks/req-checkout.mjs */
const oneClick = document.querySelector('[data-buy-now]');
const sizeError = document.querySelector('[data-buy-now-error]');
const firstSize = document.querySelector('[data-product-size]');

const oneClickInfo = {
  найдена: Boolean(oneClick),
  товар: oneClick?.dataset.buyNow ?? null,
  адрес: oneClick?.dataset.buyNowRedirect ?? null,
  текст: oneClick?.textContent.trim() ?? null,
  открываетОкноКорзины: Boolean(oneClick?.hasAttribute('data-modal-open')),
};

/* Снимаем размер, если он остался от предыдущих шагов, и жмём «Купить» */
document.querySelectorAll('[data-product-size]').forEach((chip) => {
  chip.classList.remove('is-active');
  chip.setAttribute('aria-pressed', 'false');
});
document.querySelectorAll('[data-cart-size]').forEach((button) => {
  button.dataset.cartSize = '';
});

const errorBefore = {
  скрыто: sizeError?.hidden ?? null,
  текст: sizeError?.textContent.trim() ?? null,
};

press(oneClick);
await frame();
await new Promise((r) => setTimeout(r, 100));

const afterClickWithoutSize = {
  ошибкаПоказана: sizeError ? !sizeError.hidden : null,
  текст: sizeError?.textContent.trim() ?? null,
  фокусНаРазмере: document.activeElement === firstSize,
  путь: location.pathname,
  заказНеСоздан: localStorage.getItem('cozy-pajamas:order') === null,
  размерУКнопки: oneClick?.dataset.cartSize ?? null,
};

/* Выбрали размер — сообщение уходит, не дожидаясь повторного нажатия */
press(document.querySelector('[data-product-size="M"]'));
await frame();
await new Promise((r) => setTimeout(r, 100));

const afterSizeChosen = {
  ошибкаСкрыта: sizeError?.hidden ?? null,
  размерУКнопки: oneClick?.dataset.cartSize ?? null,
  подписьРазмера: document.querySelector('[data-product-size-chosen]')?.textContent.trim() ?? null,
};

// Корзину за собой убираем: проверка не должна оставлять следов
localStorage.removeItem('cozy-pajamas:cart');
localStorage.removeItem('cozy-pajamas:order');
document.dispatchEvent(new CustomEvent('cart:change'));

/* Через 1.4 с отзыв снимается — проверяем, что подпись вернулась
   и иконка при этом никуда не делась */
await new Promise((r) => setTimeout(r, 1400));
const afterFeedback = {
  подписьВернулась: document.querySelector('[data-cart-label]').textContent.trim() === labelBefore,
  текст: document.querySelector('[data-cart-label]').textContent.trim(),
  иконкаНаМесте: Boolean(document.querySelector('.product__button-icon--cart')),
  классБезОтзыва: !addButton.classList.contains('is-added'),
};

return {
  раскладка: layout,
  типографика: typography,
  размеры: sizeSteps,
  отзывНаКнопке: feedback,
  послеОтзыва: afterFeedback,
  корзина: {
    послеДобавления: cartAfterAdd,
  },
  принт: printFiles,
  свойМакет: customInCart,
  разделитель: dividerInfo,
  галерея: gallery,
  одинКлик: {
    ...oneClickInfo,
    ошибкаДоНажатия: errorBefore,
    безРазмера: afterClickWithoutSize,
    послеВыбора: afterSizeChosen,
  },
  окноКорзиныОткрыто: !modal.classList.contains('is-hidden'),
  счётчикВШапке: document.querySelector('[data-cart-counter]')?.textContent.trim() ?? null,
  карточекКаталога: document.querySelectorAll('.product-card').length,

  /* Какие файлы реально подставились: имя последнего сегмента в url().
     Так ловится опечатка в пути к иконке — фон тогда просто не появится,
     и без этой проверки это видно только глазами.
     Имя ключа латиницей: длинные кириллические имена PowerShell при разборе
     ответа теряет, и блок приходит пустым */
  assets: (() => {
    const name = (el) => {
      if (!el) return 'нет элемента';
      const url = cs(el).backgroundImage;
      if (!url || url === 'none') return 'нет картинки';
      return url.split('/').pop().replace(/["')]/g, '');
    };

    return {
      cartIcon: name(document.querySelector('.product__button-icon--cart')),
      catalogIcon: name(document.querySelector('.product__button-icon--catalog')),
      pageBackground: name(document.body),
    };
  })(),
};


