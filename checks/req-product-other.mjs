/**
 * Запрос: страница подушки в браузере.
 *
 * Проверяет цвета бежевого акцента, отсутствие лишних блоков, работу
 * покупки без размеров и то, что карточка не ломается на узких ширинах.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs \
 *     --url http://127.0.0.1:8124/product-pages/lyanyanoy-damask.html \
 *     --request checks/req-product-other.mjs --widths 375,1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const cs = (selector) => {
  const el = document.querySelector(selector);
  return el ? getComputedStyle(el) : null;
};

const BEIGE = 'rgb(219, 203, 178)';
const PINK = 'rgb(205, 116, 162)';
const WHITE = 'rgb(255, 255, 255)';

localStorage.removeItem('cozy-pajamas:cart');
localStorage.removeItem('cozy-pajamas:order');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const addButton = document.querySelector('[data-cart-add]');
const labels = document.querySelector('.product__subtitle');
const image = document.querySelector('.product__image');

/* ── цвета и подпись ── */
const colours = {
  название: cs('.product__title').color,
  кнопкаКорзины: cs('.product__button--cart.button--pink').backgroundColor,
  текстКнопки: cs('.product__button--cart.button--pink').color,
  контурнаяКнопка: cs('.button--outline-pink').color,
  контурнаяРамка: cs('.button--outline-pink').borderTopColor,
};

/** Сколько строк занимает элемент. */
const lines = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  return new Set([...range.getClientRects()].filter((r) => r.height > 1)
    .map((r) => Math.round(r.top))).size;
};

const rect = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return {
    left: Math.round(b.left),
    right: Math.round(b.right),
    top: Math.round(b.top),
    width: Math.round(b.width),
    bottom: Math.round(b.bottom),
  };
};

const heading = {
  текст: labels?.textContent.trim() ?? null,
  кегль: labels ? cs('.product__subtitle').fontSize : null,
  строк: lines('.product__subtitle'),
  второйСтроки: Boolean(document.querySelector('.product__type')),
};

/* ── раскладка: две колонки, фото над сведениями ── */
const geometry = {
  колонкаФото: rect('.product__main'),
  галерея: rect('.product__gallery'),
  инфо: rect('.product__info'),
  фото: rect('.product__image'),
  спеки: rect('.product__specs'),
  заголовок: { ...rect('.product__title'), строк: lines('.product__title') },
  выравниваниеТекста: cs('.product__info').textAlign,
  выравниваниеКнопок: cs('.product__buttons').alignItems,
};

/* ── чего нет ── */
const removed = {
  размеров: document.querySelectorAll('[data-product-size]').length,
  блокаРазмеров: Boolean(document.querySelector('.product__sizes')),
  сообщенияОРазмере: Boolean(document.querySelector('[data-size-error]')),
  принта: Boolean(document.querySelector('[data-print-upload], .product__print')),
  состава: Boolean(document.querySelector('.product__composition')),
};

/* ── добавление в корзину без размеров: сообщения быть не должно ── */
press(addButton);
await frame();
await wait(200);

const afterAdd = {
  корзина: JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]'),
  счётчик: document.querySelector('[data-cart-counter]')?.textContent.trim() ?? null,
  подписьКнопки: document.querySelector('[data-cart-label]')?.textContent.trim() ?? null,
  сообщениеОРазмере: Boolean(document.querySelector('[data-size-error]')),
};

/* ── покупка в один клик: заказ создаётся без размера ── */
const buyNow = document.querySelector('[data-buy-now]');
const buyNowInfo = {
  найден: Boolean(buyNow),
  адрес: buyNow?.dataset.buyNowRedirect ?? null,
  размерЗадан: buyNow ? 'cartSize' in buyNow.dataset : null,
};

localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));

return {
  окно: innerWidth,
  вид: document.body.dataset.section,
  цвета: colours,
  цветаВерные: {
    названиеБежевое: colours.название === BEIGE,
    кнопкаРозовая: colours.кнопкаКорзины === PINK,
    текстБелый: colours.текстКнопки === WHITE,
    контурРозовый: colours.контурнаяКнопка === PINK,
    рамкаРозовая: colours.контурнаяРамка === PINK,
  },
  подпись: heading,
  /* Размеры: с 768px фото до 300px, кнопки до 300px */
  размеры: {
    фото: geometry.фото ? geometry.фото.width : null,
    фотоМаксимум: cs('.product__image').maxWidth,
    кнопки: [...document.querySelectorAll('.product__buttons .product__button')]
      .map((button) => Math.round(button.getBoundingClientRect().width)),
    кнопкиМаксимум: cs('.product__buttons .product__button').maxWidth,
    фото300: geometry.фото ? geometry.фото.width <= 300 : null,
    кнопки300: [...document.querySelectorAll('.product__buttons .product__button')]
      .every((button) => button.getBoundingClientRect().width <= 300),
  },
  подвал: (() => {
    const footer = document.querySelector('.footer');
    const copyright = document.querySelector('.footer__copyright');
    if (!footer || !copyright) return null;
    return {
      фон: getComputedStyle(footer).backgroundColor,
      цвет: getComputedStyle(copyright).color,
    };
  })(),
  раскладка: {
    ...geometry,
    /* Фото и сведения — друг под другом, а не рядом */
    другПодДругом: Boolean(geometry.галерея && geometry.инфо)
      && geometry.инфо.top >= geometry.галерея.bottom - 1,
    /* Фото прижато к левому краю колонки (по правке владельца) */
    фотоСлева: Boolean(geometry.галерея && geometry.фото)
      ? Math.abs(geometry.фото.left - geometry.галерея.left) <= 2
      : null,
    /* Сведения прижаты к левому краю колонки */
    инфоСлева: Boolean(geometry.галерея && geometry.инфо)
      ? Math.abs(geometry.инфо.left - geometry.галерея.left) <= 2
      : null,
    /* Колонки карточки примерно равны */
    колонкиРовны: Boolean(geometry.колонкаФото && geometry.спеки)
      ? Math.abs(geometry.колонкаФото.width - geometry.спеки.width) <= 8
      : null,
    /* Пустота между фото и описанием: с 1280px это только зазор карточки */
    зазорДоОписания: geometry.фото && geometry.спеки
      ? geometry.спеки.left - geometry.фото.right
      : null,
    /* Пустота слева и справа от группы: с 1280px они равны — группа
       стоит по центру своей половины карточки */
    слеваОтФото: geometry.фото && geometry.колонкаФото
      ? geometry.фото.left - geometry.колонкаФото.left
      : null,
    справаОтФото: geometry.фото && geometry.колонкаФото
      ? geometry.колонкаФото.right - geometry.фото.right
      : null,
    поцентру: geometry.фото && geometry.колонкаФото
      ? Math.abs((geometry.фото.left - geometry.колонкаФото.left)
        - (geometry.колонкаФото.right - geometry.фото.right)) <= 2
      : null,
    сдвигКолонки: cs('.product__main').justifyContent,
  },
  убрано: removed,
  послеДобавления: afterAdd,
  одинКлик: buyNowInfo,
  картинка: image
    ? {
      файл: image.getAttribute('src').split('/').pop(),
      загрузилась: image.complete && image.naturalWidth > 0,
      размер: `${image.naturalWidth}×${image.naturalHeight}`,
    }
    : null,
  разделитель: cs('.product__divider')
    ? cs('.product__divider').backgroundImage.split('/').pop().replace(/["')]/g, '')
    : null,
  фон: (() => {
    const url = getComputedStyle(document.body, '::before').backgroundImage;
    return url && url !== 'none' ? url.split('/').pop().replace(/["')]/g, '') : 'нет';
  })(),
  ценаОднойСтрокой: (() => {
    const price = document.querySelector('.product__price');
    if (!price) return null;
    const range = document.createRange();
    range.selectNodeContents(price);
    return new Set([...range.getClientRects()].filter((r) => r.height > 1)
      .map((r) => Math.round(r.top))).size;
  })(),
  ширинаКнопки: Math.round(addButton.getBoundingClientRect().width),
  прокруткаВбок: document.documentElement.scrollWidth > innerWidth,
};
