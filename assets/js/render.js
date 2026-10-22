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

import { getProducts, getSizes } from './data.js';
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

  /* Размер выбирают только там, где есть из чего выбирать: у пижам это
     S–XXL, у «Других товаров» размер один («Единый размер»), и окно выбора
     для них было бы пустым шагом. Поэтому признак data-select-size ставится
     по числу размеров, а не по названию секции: появится у товара второй
     размер — окно включится само */
  const selectSize = getSizes(product).length > 1 ? ' data-select-size' : '';

  /* Модификатор цвета названия — по БЭМ: отдельный класс, а не инлайн-стиль.
     Розовый — базовый цвет из блока, поэтому класс ставим только голубому. */
  const titleClass = titleColor === 'blue'
    ? 'product-card__title product-card__title--blue'
    : 'product-card__title';

  /* Цвет кнопки. У «Новой коллекции», женской и мужской секций он приходит
     тегом titleColor и совпадает с цветом карточки.
     Класс button--pink в этих случаях не добавляется: у него своё правило
     :hover (фон --color-dark), и вдвоём с модификатором карточки они спорят —
     при равной специфичности выигрывал более ранний файл, и розовая кнопка
     при наведении чернела.
     В «Других товарах» тега нет: там кнопка розовая, а при наведении синяя —
     тоже модификатор карточки, чтобы не спорить с button.css. */
  const buttonModifier = titleColor
    ? `product-card__button--${titleColor}`
    : 'product-card__button--other';

  /* Адрес страницы товара. Он есть в данных только у товаров, для которых
     страница уже свёрстана (пока это «Клубничные поля»). У остальных
     остаётся прежняя заглушка: папка product-pages/, — чтобы ссылка
     не вела на несуществующий файл с чужим id */
  const href = product.page ?? 'product-pages/';

  return `
    <article class="product-card">
      <a class="product-card__link" href="${href}" data-product-id="${product.id}">
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
           уводить на страницу товара.
           data-select-size — признак того, что размер ещё не выбран:
           по нему size-picker.js открывает окно выбора, а cart-ui.js
           отступает и не кладёт товар в корзину сразу. Ставится только
           товарам, у которых размеров больше одного.
           Класса button--block нет намеренно: кнопка по ширине надписи -->
      <button
        class="product-card__button button ${buttonModifier}"
        type="button"
        data-cart-add="${product.id}"${selectSize}
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
