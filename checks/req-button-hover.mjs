/**
 * Запрос: цвет кнопки «В корзину» при наведении.
 *
 * :hover нельзя включить скриптом, поэтому цвет проверяется настоящим
 * движением курсора: харнесс принимает селектор ключом --mouse-to, двигает
 * мышь протоколом и только потом выполняет этот запрос.
 *
 * Запуск (два раза — по одному на каждый цвет):
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8000/ \
 *     --request checks/req-button-hover.mjs --widths 1280 --mouse-to ".goods-new__item:nth-child(1) .product-card__button"
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8000/ \
 *     --request checks/req-button-hover.mjs --widths 1280 --mouse-to ".goods-new__item:nth-child(2) .product-card__button"
 *
 * Ожидание: у розовой карточки при наведении фон --color-pink-light
 * #f4d9e8, у голубой — --color-blue-light #dae2e4, текст в обоих случаях
 * тёмный --color-dark #4c4c4c. В покое фон --color-pink #cd74a2 или
 * --color-blue #93b3d6, текст белый.
 *
 * Почему проверка отдельная, а не в общем сценарии фильтров: курсор за один
 * запуск можно навести только на один элемент, а цветов два.
 */

const hex = (rgb) => {
  const m = rgb.match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : rgb;
};

/* Даём браузеру применить :hover и доиграть переход фона: у кнопки
   transition 0.2s, и без паузы замер поймает промежуточный цвет. */
await new Promise((r) => setTimeout(r, 350));

const read = (selector) => {
  const el = document.querySelector(selector);
  const cs = getComputedStyle(el);
  return {
    класс: el.className,
    фон: hex(cs.backgroundColor),
    текст: hex(cs.color),
    наведён: el.matches(':hover'),
  };
};

const COLOURS = {
  pink: { покой: '#cd74a2', ховер: '#f4d9e8' },
  blue: { покой: '#93b3d6', ховер: '#dae2e4' },
};
const DARK_TEXT = '#4c4c4c';
const WHITE_TEXT = '#ffffff';

return {
  кнопки: [1, 2, 3, 4, 5, 6].map((n) => ({
    n,
    ...read(`.goods-new__item:nth-child(${n}) .product-card__button`),
  })),
  кнопкаЖенскойСекции: read('.goods-women__item .product-card__button'),
  ожидание: { COLOURS, DARK_TEXT, WHITE_TEXT },
  проверка: [1, 2, 3, 4, 5, 6].map((n) => {
    const el = document.querySelector(`.goods-new__item:nth-child(${n}) .product-card__button`);
    const cs = getComputedStyle(el);
    const colour = el.className.includes('--blue') ? 'blue' : 'pink';
    const want = el.matches(':hover') ? COLOURS[colour].ховер : COLOURS[colour].покой;
    const wantText = el.matches(':hover') ? DARK_TEXT : WHITE_TEXT;
    return {
      n,
      цвет: colour,
      наведён: el.matches(':hover'),
      фонОк: hex(cs.backgroundColor) === want,
      текстОк: hex(cs.color) === wantText,
    };
  }),
};
