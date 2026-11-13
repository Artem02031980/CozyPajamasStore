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

/* Палитра сайта: синий #93b3d6, розовый #cd74a2 */
const BLUE = '147, 179, 214';
const PINK = '205, 116, 162';
const close = (value, expected, tolerance = 6) => {
  const [r, g, b] = expected.split(',').map((n) => Number(n.trim()));
  return Math.abs(value.r - r) <= tolerance
    && Math.abs(value.g - g) <= tolerance
    && Math.abs(value.b - b) <= tolerance;
};

/* align-items: flex-start у контента — признак левого выравнивания (с 768px) */
const левоеВыравнивание = style(document.querySelector('.hero__content')).alignItems === 'flex-start';

/* Где начинается сам текст внутри плашки: Range по содержимому абзаца */
const текстRange = document.createRange();
текстRange.selectNodeContents(text);
const текстСлева = Math.round(текстRange.getBoundingClientRect().left);

const titleBox = title.getBoundingClientRect();
const textBox = text.getBoundingClientRect();
const buttonBox = button.getBoundingClientRect();

/* Зазоры вокруг плашки: считаются по её коробке, потому что видно её край */
const зазорЗаголовок = Math.round(textBox.top - titleBox.bottom);
const зазорКнопка = Math.round(buttonBox.top - textBox.bottom);
const ширинаПлашки = Math.round(textBox.width);

/* Где начинается текст кнопки: её левый край плюс padding-inline */
const текстКнопки = Math.round(buttonBox.left + parseFloat(buttonStyle.paddingLeft));

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
      пункт: hovered ? 'при наведении фон розовый — --color-pink' : 'фон кнопки синий — --color-blue',
      прошло: hovered ? close(bg, PINK) : close(bg, BLUE),
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
      /* До 768px у плашки нет max-width: она занимает всю ширину контейнера */
      пункт: левоеВыравнивание
        ? 'ширина плашки 500px + 20px'
        : 'до 768px плашка на всю ширину контейнера',
      прошло: левоеВыравнивание ? ширинаПлашки === 520 : ширинаПлашки <= window.innerWidth,
      факт: `${ширинаПлашки}px`,
    },
    {
      пункт: 'от заголовка до плашки 24px — вдвое больше прежних 12',
      прошло: зазорЗаголовок === 24,
      факт: `${зазорЗаголовок}px`,
    },
    {
      пункт: 'от плашки до кнопки 36px — втрое больше прежних 12',
      прошло: зазорКнопка === 36,
      факт: `${зазорКнопка}px`,
    },
    {
      пункт: 'остальные отступы плашки 12px',
      прошло: textStyle.paddingRight === '12px' && textStyle.paddingTop === '12px'
        && textStyle.paddingBottom === '12px',
      факт: `справа ${textStyle.paddingRight}, сверху ${textStyle.paddingTop}, снизу ${textStyle.paddingBottom}`,
    },
    {
      /* До 768px макет центрированный: там текст абзаца по центру,
         а кнопка — отдельный блок по центру */
      пункт: левоеВыравнивание
        ? 'текст абзаца начинается там же, где текст кнопки'
        : 'до 768px тексты центрированы, как в макете',
      прошло: левоеВыравнивание
        ? Math.abs(текстСлева - текстКнопки) <= 1
        : Math.abs(текстСлева - Math.round(textBox.left + parseFloat(textStyle.paddingLeft))) <= 1,
      факт: `абзац ${текстСлева}, кнопка ${текстКнопки}`,
    },
    {
      /* До 768px текст по центру — там сравнивать левые края текстов нечего */
      пункт: левоеВыравнивание
        ? 'текст абзаца отступает от края плашки на 24px'
        : 'до 768px текст по центру, отступ задан padding',
      прошло: левоеВыравнивание
        ? Math.abs(текстСлева - (Math.round(textBox.left) + 24)) <= 1
        : textStyle.paddingLeft === '24px',
      факт: `плашка ${Math.round(textBox.left)}, текст ${текстСлева}`,
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
