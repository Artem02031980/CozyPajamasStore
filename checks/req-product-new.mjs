/**
 * Запрос: страница новинки в браузере.
 *
 * Проверяет, что страница оживает: скрипты поднялись, фото загрузилось,
 * размеры выбираются, «Добавить в корзину» кладёт товар с выбранным
 * размером, а без размера — показывает подсказку. Меряет цвета акцента:
 * у женских страниц название розовое, у мужских голубое.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/product-pages/nezhnoe-schaste.html \
 *     --request checks/req-product-new.mjs --widths 375,1280 --no-preflight
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

const cs = (selector) => {
  const el = document.querySelector(selector);
  return el ? getComputedStyle(el) : null;
};

localStorage.removeItem('cozy-pajamas:cart');
localStorage.removeItem('cozy-pajamas:order');
document.dispatchEvent(new CustomEvent('cart:change'));
await frame();

const image = document.querySelector('.product__image');
const addButton = document.querySelector('[data-cart-add]');
const sizes = [...document.querySelectorAll('[data-product-size]')];

/* ── без размера товар не добавляется ── */
press(addButton);
await frame();
await wait(150);

const withoutSize = {
  корзина: JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]'),
  подсказка: (() => {
    const error = document.querySelector('[data-size-error]');
    return error ? { показана: !error.hidden, текст: error.textContent.trim() } : null;
  })(),
};

/* ── с размером — добавляется ── */
press(sizes[1]);
await frame();
press(addButton);
await frame();
await wait(200);

const withSize = {
  корзина: JSON.parse(localStorage.getItem('cozy-pajamas:cart') ?? '[]'),
  счётчик: document.querySelector('[data-cart-counter]')?.textContent.trim() ?? null,
  подписьКнопки: document.querySelector('[data-cart-label]')?.textContent.trim() ?? null,
  выбран: document.querySelector('.product__size.is-active')?.textContent.trim() ?? null,
  пометка: document.querySelector('[data-product-size-chosen]')?.textContent.trim() ?? null,
};

localStorage.removeItem('cozy-pajamas:cart');
document.dispatchEvent(new CustomEvent('cart:change'));

return {
  окно: innerWidth,
  адрес: location.pathname.split('/').pop(),
  вид: document.body.dataset.section,
  название: {
    текст: document.querySelector('.product__title')?.textContent.trim() ?? null,
    цвет: cs('.product__title')?.color,
  },
  подпись: document.querySelector('.product__subtitle')?.textContent.trim() ?? null,
  цена: document.querySelector('.product__price')?.textContent.trim() ?? null,
  размеры: sizes.map((button) => button.textContent.trim()),
  картинка: image
    ? {
      файл: image.getAttribute('src').split('/').pop(),
      загрузилась: image.complete && image.naturalWidth > 0,
      размер: `${image.naturalWidth}×${image.naturalHeight}`,
    }
    : null,
  состав: document.querySelector('.product__composition')?.textContent.trim() ?? null,
  характеристик: document.querySelectorAll('.product__details-name').length,
  безРазмера: withoutSize,
  сРазмером: withSize,
  принт: Boolean(document.querySelector('[data-print-upload], .product__print')),
  разделитель: cs('.product__divider')
    ? cs('.product__divider').backgroundImage.split('/').pop().replace(/["')]/g, '')
    : null,
  фон: (() => {
    const url = getComputedStyle(document.body, '::before').backgroundImage;
    return url && url !== 'none' ? url.split('/').pop().replace(/["')]/g, '') : 'нет';
  })(),
  подвал: (() => {
    const footer = document.querySelector('.footer');
    return footer ? getComputedStyle(footer).backgroundColor : null;
  })(),
  прокруткаВбок: document.documentElement.scrollWidth > innerWidth,
};
