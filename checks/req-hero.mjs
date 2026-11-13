/**
 * Запрос: первый экран — кнопка, плашка абзаца, выравнивание по левому краю.
 *
 * Проверяется то, что видно только в браузере:
 *   — в кнопке текст со стрелкой «↓»;
 *   — цвета кнопки: бежевый фон и белый текст, при наведении розовый
 *     (ховер включается ключом --mouse-to, см. ниже);
 *   — плашка абзаца синяя из палитры и выровнена по левому краю
 *     с заголовком и кнопкой: их левые границы совпадают;
 *   — стрелка рисуется своим шрифтом, а не квадратиком-заглушкой.
 *
 * Запуск (два раза — покой и наведение):
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-hero.mjs --widths 1280 --no-preflight --settle 2000
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-hero.mjs --widths 1280 --no-preflight --settle 2000 \
 *     --mouse-to ".hero__button"
 */

const button = document.querySelector('.hero__button');
const text = document.querySelector('.hero__text');
const title = document.querySelector('.hero__title');

const style = (el, pseudo = null) => getComputedStyle(el, pseudo);
const buttonStyle = style(button);
const textStyle = style(text);

const rgb = (value) => {
  const numbers = value.match(/[\d.]+/g) ?? [];
  if (value.startsWith('color(')) {
    /* color-mix отдаёт color(srgb r g b / a) с долями от единицы */
    const [r, g, b] = numbers.slice(0, 3).map((n) => Math.round(Number(n) * 255));
    return { r, g, b };
  }
  const [r, g, b] = numbers.map(Number);
  return { r, g, b };
};

/* Ширина стрелки и «пустого» глифа: если шрифт не знает стрелку,
   она рисуется квадратиком той же ширины, что и заведомая заглушка */
const glyphWidth = (symbol) => {
  const probe = document.createElement('span');
  probe.textContent = symbol;
  probe.style.cssText = `position:absolute;visibility:hidden;font:${textStyle.fontSize}/${textStyle.lineHeight} ${textStyle.fontFamily}`;
  text.append(probe);
  const width = Math.round(probe.getBoundingClientRect().width);
  probe.remove();
  return width;
};

const buttonText = button.textContent.trim();
const hovered = button.matches(':hover');
const bg = rgb(buttonStyle.backgroundColor);
const fg = rgb(buttonStyle.color);

/* Палитра сайта: беж #dbcbb2, розовый #cd74a2 */
const BEIGE = '219, 203, 178';
const PINK = '205, 116, 162';
const close = (value, expected, tolerance = 6) => {
  const [r, g, b] = expected.split(',').map((n) => Number(n.trim()));
  return Math.abs(value.r - r) <= tolerance
    && Math.abs(value.g - g) <= tolerance
    && Math.abs(value.b - b) <= tolerance;
};

/* align-items: flex-start у контента — признак левого выравнивания (с 768px) */
const левоеВыравнивание = style(document.querySelector('.hero__content')).alignItems === 'flex-start';

const titleBox = title.getBoundingClientRect();
const textBox = text.getBoundingClientRect();
const buttonBox = button.getBoundingClientRect();

return {
  наведена: hovered,
  кнопка: {
    текст: buttonText,
    фон: buttonStyle.backgroundColor,
    текстЦвет: buttonStyle.color,
    свечение: buttonStyle.boxShadow,
    скругление: buttonStyle.borderRadius,
  },
  плашка: {
    заливка: textStyle.backgroundColor,
    скругление: textStyle.borderRadius,
    слеваPadding: textStyle.paddingLeft,
    справаPadding: textStyle.paddingRight,
    псевдоПодложка: style(text, '::before').content,
  },
  края: {
    заголовок: Math.round(titleBox.left),
    абзац: Math.round(textBox.left),
    кнопка: Math.round(buttonBox.left),
  },
  проверки: [
    {
      пункт: 'в кнопке текст со стрелкой и без восклицательного знака',
      прошло: buttonText.includes('↓') && !buttonText.includes('!'),
      факт: buttonText,
    },
    {
      пункт: hovered ? 'при наведении фон розовый — --color-pink' : 'фон кнопки бежевый — --color-beige',
      прошло: hovered ? close(bg, PINK) : close(bg, BEIGE),
      факт: buttonStyle.backgroundColor,
    },
    {
      пункт: 'текст кнопки белый',
      прошло: fg.r > 245 && fg.g > 245 && fg.b > 245,
      факт: buttonStyle.color,
    },
    {
      пункт: 'вокруг кнопки белое свечение',
      прошло: /rgba\(255, 255, 255/.test(buttonStyle.boxShadow),
      факт: buttonStyle.boxShadow,
    },
    {
      пункт: 'плашка абзаца синяя из палитры',
      прошло: close(rgb(textStyle.backgroundColor), '147, 179, 214', 6),
      факт: textStyle.backgroundColor,
    },
    {
      пункт: 'левый край плашки совпадает с заголовком',
      прошло: Math.abs(Math.round(textBox.left) - Math.round(titleBox.left)) <= 1,
      факт: `заголовок ${Math.round(titleBox.left)}, плашка ${Math.round(textBox.left)}`,
    },
    {
      /* До 768px макет центрированный: там совпадать должны центры,
         выравнивание по левому краю — с 768px */
      пункт: левоеВыравнивание
        ? 'левый край кнопки совпадает с заголовком'
        : 'до 768px кнопка по центру, как в макете',
      прошло: левоеВыравнивание
        ? Math.abs(Math.round(buttonBox.left) - Math.round(titleBox.left)) <= 1
        : Math.abs(Math.round((buttonBox.left + buttonBox.right) / 2)
          - Math.round((titleBox.left + titleBox.right) / 2)) <= 2,
      факт: `заголовок ${Math.round(titleBox.left)}, кнопка ${Math.round(buttonBox.left)}`,
    },
    {
      пункт: 'слева у плашки нет отступа, справа есть вынос',
      прошло: textStyle.paddingLeft === '0px' && parseFloat(textStyle.paddingRight) > 0,
      факт: `слева ${textStyle.paddingLeft}, справа ${textStyle.paddingRight}`,
    },
    {
      пункт: 'размытой подложки-псевдоэлемента нет',
      прошло: style(text, '::before').content === 'none',
      факт: style(text, '::before').content,
    },
    {
      пункт: 'стрелка рисуется шрифтом, а не заглушкой',
      прошло: glyphWidth('↓') !== glyphWidth('\uFFFF'),
      факт: `стрелка ${glyphWidth('↓')}px, заглушка ${glyphWidth('\uFFFF')}px`,
    },
  ],
};
