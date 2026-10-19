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
const dots = [...document.querySelectorAll('[data-product-dot]')];
const dotsBox = document.querySelector('.product__dots');
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

  /* Точки-индикаторы: видимость считаем у их контейнера, а не у самой
     кнопки. У кнопки display считается по её собственному значению и про
     скрытие контейнера ничего не говорит — на этом я уже ошибся */
  точкиВидимы: cs(dotsBox).display !== 'none',
  размерТочки: box(dots[0] ?? card).width,

  /* Стрелки: в макете 320 они лежат внутри карточки, на 1280 — за ней.
     Считаем от края карточки: отрицательное число означает «за карточкой».
     Раньше здесь была ошибка: расстояние справа считалось от края карточки,
     хотя стрелка стоит относительно галереи — половина карточки в счёт
     не входила, и замер показывал 328px вместо 48 */
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

const sizeSteps = [];
sizeSteps.push({
  step: 'до выбора',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  dataCartSize: addButton.dataset.cartSize,
  заголовок: title.textContent.trim(),
});

press(sizes.find((s) => s.dataset.productSize === 'M'));
await frame();
sizeSteps.push({
  step: 'выбран M',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  активный: sizes.find((s) => s.classList.contains('is-active'))?.textContent.trim() ?? null,
  dataCartSize: addButton.dataset.cartSize,
  заголовок: title.textContent.trim(),
  размерФона: cs(sizes.find((s) => s.classList.contains('is-active'))).backgroundColor,
});

press(sizes.find((s) => s.dataset.productSize === 'XXL'));
await frame();
sizeSteps.push({
  step: 'переключили на XXL',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  dataCartSize: addButton.dataset.cartSize,
  заголовок: title.textContent.trim(),
});

press(sizes.find((s) => s.dataset.productSize === 'XXL'));
await frame();
sizeSteps.push({
  step: 'сняли выбор повторным нажатием',
  активных: sizes.filter((s) => s.classList.contains('is-active')).length,
  dataCartSize: addButton.dataset.cartSize,
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

// ─── галерея при одном кадре ───

const gallery = {
  кадров: dots.length,
  активныхТочек: dots.filter((d) => d.classList.contains('is-active')).length,
  стрелкаНазадВыключена: prev.disabled,
  стрелкаВперёдВыключена: next.disabled,
  кликВперёдНеПадает: (() => {
    press(next);
    return dots.filter((d) => d.classList.contains('is-active')).length;
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

/** Кладёт в поле файл с заданным именем и шлёт change. */
const pickFile = async (name) => {
  const transfer = new DataTransfer();
  transfer.items.add(new File(['x'], name, { type: 'application/octet-stream' }));
  printFile.files = transfer.files;
  printFile.dispatchEvent(new Event('change', { bubbles: true }));
  await frame();
  await new Promise((r) => setTimeout(r, 60));

  return {
    имя: name,
    подпись: printNote?.textContent.trim() ?? null,
    подписьВидна: printNote ? !printNote.hidden : null,
    ошибка: printNote?.classList.contains('product__print-file--error') ?? null,
    осталосьВПоле: printFile.files.length,
  };
};

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

// ─── «Купить в один клик» открывает окно корзины ───

const oneClick = document.querySelector('[data-modal-open="cart"]');
press(oneClick);
await frame();
await new Promise((r) => setTimeout(r, 200));
const modalOpen = !modal.classList.contains('is-hidden');

// Корзину за собой убираем: проверка не должна оставлять следов
localStorage.removeItem('cozy-pajamas:cart');
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
  галерея: gallery,
  окноКорзиныОткрылось: modalOpen,
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
      pageDot: name(dots[0]),
      pageBackground: name(document.body),
    };
  })(),
};
