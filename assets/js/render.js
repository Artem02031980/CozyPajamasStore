/**
 * render.js — отрисовка карточек товаров.
 *
 * Карточки создаются из данных (data.js), а не лежат в разметке готовыми.
 * Причина: дальше появятся фильтры, сортировка и пагинация — им нужно
 * перерисовывать список, а с готовой вёрсткой это делалось бы копированием
 * разметки в JS.
 *
 * Разметка карточки повторяет ту, что была в index.html, класс в класс:
 * вид не должен измениться от того, что карточки стали данными.
 */

import { getProducts } from './data.js';
import { formatPrice, $ } from './utils.js';

/**
 * Собирает разметку одной карточки.
 *
 * Через innerHTML, а не через createElement: разметка карточки — фиксированный
 * шаблон на пять узлов, и создавать его по узлам означало бы двадцать строк
 * DOM-вызовов. Все подставляемые значения — из нашего же каталога,
 * пользовательских данных здесь нет, поэтому и риска вставки разметки нет.
 *
 * @param {import('./data.js').Product} product
 * @returns {string} HTML карточки без обёртки <li>
 */
export function renderCard(product) {
  const { title, subtitle, price, image, alt, width, height, titleColor } = product;

  /* Модификатор цвета заголовка — по БЭМ: отдельный класс, а не инлайн-стиль */
  const titleClass = titleColor
    ? `product-card__title product-card__title--${titleColor}`
    : 'product-card__title';

  return `
    <article class="product-card">
      <!-- href — заглушка: здесь будет адрес страницы товара -->
      <a class="product-card__link" href="product-pages/" data-product-id="${product.id}">
        <div class="product-card__media">
          <img
            class="product-card__image"
            src="${image}"
            alt="${alt}"
            width="${width}"
            height="${height}"
          />
        </div>
        <h3 class="${titleClass}">${title}</h3>
      </a>
      <p class="product-card__subtitle">${subtitle}</p>
      <p class="product-card__price">${formatPrice(price)}</p>
      <!-- Кнопка «В корзину». Не внутри ссылки: клик по ней не должен
           уводить на страницу товара. Размер выбирается на странице товара,
           поэтому здесь позиция добавляется без размера -->
      <button
        class="product-card__button button button--pink button--block"
        type="button"
        data-cart-add="${product.id}"
      >В корзину</button>
    </article>`;
}

/**
 * Собирает разметку списка карточек одной секции.
 *
 * Класс обёртки повторяет тот, что был в вёрстке: goods-new__item,
 * goods-women__item и так далее. От него зависит раскладка сетки,
 * поэтому имя собирается из названия секции, а не пишется руками.
 *
 * @param {string} section
 * @param {import('./data.js').Product[]} [products] что рисовать; по умолчанию все товары секции
 * @returns {string}
 */
export function renderCards(section, products = getProducts(section)) {
  return products
    .map((product) => `
              <li class="goods-${section}__item">
                ${renderCard(product)}
              </li>`)
    .join('\n');
}

/**
 * Находит контейнер карточек внутри секции.
 *
 * Сетка и лента перечислены явно: у секций разные классы обёрток
 * (goods-women__grid, goods-other__track), и общего правила именования
 * для них нет.
 *
 * @param {string} section
 * @returns {Element|null}
 */
function findGrid(section) {
  const selectors = [
    `.goods-${section}__grid`,
    `.goods-${section}__track`,
  ];
  for (const selector of selectors) {
    const grid = $(selector);
    if (grid) return grid;
  }
  return null;
}

/**
 * Секции, которые рисуются целиком, без постраничного показа.
 * Женская и мужская коллекции сюда не входят: у них пагинация,
 * и их сетки наполняет filters.js — иначе эти две секции были бы
 * нарисованы дважды и первая отрисовка затирала бы вторую.
 */
const PLAIN_SECTIONS = ['new', 'other'];

/**
 * Рисует карточки в секциях без пагинации.
 *
 * Вызывается один раз при запуске. Пустая секция — это не ошибка,
 * но и молчать о ней нельзя: скорее всего, разошлись классы.
 *
 * @returns {number} сколько секций заполнено
 */
export function renderCatalog() {
  let filled = 0;

  for (const section of PLAIN_SECTIONS) {
    const grid = findGrid(section);
    if (!grid) {
      console.warn(`[render] не найдена сетка для секции «${section}»`);
      continue;
    }

    const products = getProducts(section);
    if (products.length === 0) {
      console.warn(`[render] в секции «${section}» нет товаров`);
      continue;
    }

    grid.innerHTML = renderCards(section, products);
    filled += 1;
  }

  return filled;
}
