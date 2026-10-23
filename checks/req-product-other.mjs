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
const DARK = 'rgb(76, 76, 76)';

localStorage.removeItem('cozy-pajamas:cart');
localStorage.removeItem('cozy-pajamas:order');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const addButton = document.querySelector('[data-cart-add]');
const labels = document.querySelector('.product__subtitle');
const type = document.querySelector('.product__type');
const image = document.querySelector('.product__image');

/* ── цвета и надзаголовок ── */
const colours = {
  название: cs('.product__title').color,
  кнопкаКорзины: cs('.product__button--cart.button--pink').backgroundColor,
  текстКнопки: cs('.product__button--cart.button--pink').color,
  контурнаяКнопка: cs('.button--outline-pink').color,
  контурнаяРамка: cs('.button--outline-pink').borderTopColor,
};

const headings = {
  секция: labels?.textContent.trim() ?? null,
  тип: type?.textContent.trim() ?? null,
  кегльСекции: labels ? cs('.product__subtitle').fontSize : null,
  кегльТипа: type ? cs('.product__type').fontSize : null,
  весТипа: type ? cs('.product__type').fontWeight : null,
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
    кнопкаБежевая: colours.кнопкаКорзины === BEIGE,
    текстТёмный: colours.текстКнопки === DARK,
    контурТёмный: colours.контурнаяКнопка === DARK,
    рамкаБежевая: colours.контурнаяРамка === BEIGE,
  },
  надзаголовки: headings,
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
