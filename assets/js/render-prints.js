/**
 * render-prints.js — карточки каталога принтов на странице prints.html.
 *
 * Принтов 17, и разметка у них одинаковая, поэтому карточки рисует скрипт
 * из данных — как карточки товаров на главной (render.js). Страница при
 * этом остаётся статичной: заголовок, вступление, цена и правила нанесения
 * стоят в HTML, а без скрипта человек увидит хотя бы их.
 *
 * В карточке два изображения одного рисунка: обычное состояние (чёрное
 * на белом) и инверсия (белое на чёрном) — чтобы было видно, как принт
 * ляжет на светлую и на тёмную ткань.
 */

import { PRINTS, PRINT_PRICE, printLabel } from './prints.js';
import { formatPrice } from './utils.js';

/** Разметка одной карточки. */
function renderCard(print) {
  const number = String(print.number).padStart(2, '0');
  const label = printLabel(print);

  return `
        <li class="prints__card">
          <div class="prints__previews">
            <figure class="prints__preview">
              <img
                class="prints__image"
                src="${print.image}"
                alt="${print.alt} — чёрное на светлом"
                width="1024"
                height="1024"
                loading="lazy"
              />
              <figcaption class="prints__preview-note">На светлом</figcaption>
            </figure>

            <figure class="prints__preview prints__preview--dark">
              <img
                class="prints__image"
                src="${print.inverted}"
                alt="${print.alt} — белое на тёмном"
                width="1024"
                height="1024"
                loading="lazy"
              />
              <figcaption class="prints__preview-note">На тёмном</figcaption>
            </figure>
          </div>

          <div class="prints__body">
            <p class="prints__number">Принт ${number}</p>
            <h2 class="prints__name">${print.title}</h2>
            <p class="prints__text">${print.text}</p>

            <div class="prints__buy">
              <p class="prints__price">${formatPrice(PRINT_PRICE)}</p>
              <button
                class="prints__button button button--pink"
                type="button"
                data-cart-add="${print.id}"
                aria-label="Добавить в корзину: ${label}"
              >
                <span class="prints__button-icon" aria-hidden="true"></span>
                <span class="prints__button-label" data-cart-label>В корзину</span>
              </button>
            </div>
          </div>
        </li>`;
}

/**
 * Рисует все карточки в контейнер [data-prints-list].
 * @param {Document|HTMLElement} [root=document]
 */
export function renderPrints(root = document) {
  const list = root.querySelector('[data-prints-list]');
  if (!list) return;

  list.innerHTML = PRINTS.map(renderCard).join('');
}
