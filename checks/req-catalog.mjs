/**
 * Запрос: каталог целиком после наполнения.
 *
 * Проверяет то, что видно только в браузере: сколько карточек на странице,
 * грузятся ли картинки, совпадает ли состав страниц с данными, работает ли
 * пагинация на большом числе страниц.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8000/ \
 *     --request checks/req-catalog.mjs --widths 1280
 */

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const press = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

// Ждём загрузки картинок: их много, и без ожидания часть выглядит битой
if (document.readyState !== 'complete') {
  await new Promise((r) => window.addEventListener('load', r, { once: true }));
}
const imgs = [...document.querySelectorAll('.product-card__image')];
const start = Date.now();
while (imgs.some((i) => !i.complete) && Date.now() - start < 5000) {
  await new Promise((r) => setTimeout(r, 100));
}

const titles = (selector) => [...document.querySelectorAll(`${selector} .product-card__title`)]
  .map((t) => t.textContent.trim());

const pages = (section) => [...document.querySelectorAll(`nav.pagination[data-section="${section}"] [data-page]`)]
  .map((b) => b.textContent.trim());

const section = {
  women: {
    onPage: titles('#goods-women .goods-women__grid'),
    pages: pages('women'),
    active: document.querySelector('nav.pagination[data-section="women"] .is-active')?.textContent.trim(),
  },
  men: {
    onPage: titles('#goods-men .goods-men__grid'),
    pages: pages('men'),
    active: document.querySelector('nav.pagination[data-section="men"] .is-active')?.textContent.trim(),
  },
  other: {
    inTrack: titles('#goods-other .goods-other__track'),
    scrollable: (() => {
      const track = document.querySelector('.goods-other__track');
      return track.scrollWidth > track.clientWidth + 1;
    })(),
  },
};

// Проверяем переход на последнюю страницу женской коллекции
const lastPage = pages('women').at(-1);
let afterLastPage = null;
if (lastPage && lastPage !== '1') {
  press(document.querySelector(`nav.pagination[data-section="women"] [data-page="${lastPage}"]`));
  await frame();
  await new Promise((r) => setTimeout(r, 200));
  afterLastPage = {
    page: lastPage,
    cards: document.querySelectorAll('#goods-women .goods-women__grid .product-card').length,
    titles: titles('#goods-women .goods-women__grid'),
    firstCardImageOk: (() => {
      const img = document.querySelector('#goods-women .goods-women__grid .product-card__image');
      return img ? img.naturalWidth > 0 : null;
    })(),
  };
}

// И на вторую: состав не должен повторять первую
press(document.querySelector('nav.pagination[data-section="women"] [data-page="2"]'));
await frame();
await new Promise((r) => setTimeout(r, 200));
const secondPage = {
  cards: document.querySelectorAll('#goods-women .goods-women__grid .product-card').length,
  titles: titles('#goods-women .goods-women__grid'),
};

return {
  cardsOnPage: document.querySelectorAll('.product-card').length,
  brokenImages: imgs.filter((i) => !i.naturalWidth).map((i) => i.src.split('/products/').pop()),
  counters: [...document.querySelectorAll('[data-goods-count]')].map((e) => e.textContent.trim()),
  section,
  secondPage,
  afterLastPage,
};
