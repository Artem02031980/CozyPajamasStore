/**
 * Запрос: мужская страница товара в браузере.
 *
 * Страница свёрстана по образцу женской, но акцент у неё обратный:
 * розовое стало голубым, голубое — розовым. Здесь меряются живые
 * computed-цвета, а также то, что размеры работают и товар уходит
 * в корзину с правильным размером.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs \
 *     --url http://127.0.0.1:8124/product-pages/myatnyy-vecher.html \
 *     --request checks/req-product-men.mjs --widths 375,1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const cs = (selector) => {
  const el = document.querySelector(selector);
  return el ? getComputedStyle(el) : null;
};

const BLUE = 'rgb(147, 179, 214)';
const PINK = 'rgb(205, 116, 162)';

localStorage.removeItem('cozy-pajamas:cart');
localStorage.removeItem('cozy-pajamas:order');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const image = document.querySelector('.product__image');

/* ── цвета в покое ── */
const colours = {
  название: cs('.product__title').color,
  рамкаРазмера: cs('.product__size').borderTopColor,
  кнопкаКорзины: cs('.product__button--cart.button--pink').backgroundColor,
  контурнаяКнопка: cs('.button--outline-pink').color,
  контурнаяРамка: cs('.button--outline-pink').borderTopColor,
  иконкаКаталога: cs('.product__button-icon--catalog').backgroundImage.split('/').pop().replace(/["')]/g, ''),
  разделитель: cs('.product__divider').backgroundImage.split('/').pop().replace(/["')]/g, ''),
  фон: (() => {
    const url = getComputedStyle(document.body, '::before').backgroundImage;
    return url && url !== 'none' ? url.split('/').pop().replace(/["')]/g, '') : 'нет';
  })(),
};

/* ── размеры: выбор и отражение в кнопке ── */
const sizes = [...document.querySelectorAll('[data-product-size]')].map((b) => b.textContent.trim());
const xl = document.querySelectorAll('[data-product-size]')[1];

press(xl);
await frame();
await wait(80);

const afterSize = {
  нажатый: xl.textContent.trim(),
  активен: xl.classList.contains('is-active'),
  ariaPressed: xl.getAttribute('aria-pressed'),
  подписьРазмера: document.querySelector('[data-product-size-chosen]')?.textContent.trim() ?? null,
  цветПодписи: cs('[data-product-size-chosen]').color,
  размерУКнопки: document.querySelector('[data-cart-add]')?.dataset.cartSize ?? null,
};

/* ── «Добавить в корзину» кладёт товар с размером ── */
press(document.querySelector('[data-cart-add]'));
await frame();
await wait(150);

const afterAdd = {
  корзина: JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]'),
  подписьКнопки: document.querySelector('[data-cart-label]')?.textContent.trim() ?? null,
  счётчик: document.querySelector('[data-cart-counter]')?.textContent.trim() ?? null,
};

/* ── окно выбора размера открывается с карточки на главной ── */
const sizesInData = await import('/assets/js/data.js')
  .then((module) => module.getSizes(module.getProduct('goods-men-01')))
  .catch(() => null);

/* ── ошибка «Выберите размер» для покупки в один клик ── */
document.querySelectorAll('[data-product-size]').forEach((chip) => {
  chip.classList.remove('is-active');
  chip.setAttribute('aria-pressed', 'false');
});
document.querySelectorAll('[data-cart-size]').forEach((button) => {
  button.dataset.cartSize = '';
});
await frame();

press(document.querySelector('[data-buy-now]'));
await frame();
await wait(120);

const buyNowGuard = {
  ошибкаПоказана: !document.querySelector('[data-buy-now-error]')?.hidden,
  путь: location.pathname,
};

localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));

return {
  окно: innerWidth,
  вид: document.body.dataset.section,
  цвета: colours,
  эталон: { BLUE, PINK },
  цветаВерные: {
    названиеГолубое: colours.название === BLUE,
    рамкаГолубая: colours.рамкаРазмера === BLUE,
    кнопкаГолубая: colours.кнопкаКорзины === BLUE,
    контурГолубой: colours.контурнаяКнопка === BLUE && colours.контурнаяРамка === BLUE,
    подписьРазмераРозовая: afterSize.цветПодписи === PINK,
  },
  размеры: sizes,
  послеВыбора: afterSize,
  послеДобавления: afterAdd,
  размерыВДанных: sizesInData,
  защитаОдинКлик: buyNowGuard,
  картинка: image
    ? { файл: image.getAttribute('src').split('/').pop(), загрузилась: image.complete && image.naturalWidth > 0 }
    : null,
  прокруткаВбок: document.documentElement.scrollWidth > innerWidth,
};
