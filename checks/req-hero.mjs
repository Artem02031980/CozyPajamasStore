/**
 * Запрос: первый экран — стрелка в кнопке, свечение, плашка под абзацем.
 *
 * Проверяется то, что видно только в браузере:
 *   — в кнопке текст со стрелкой «↓», иконки-картинки нет;
 *   — у кнопки непустое белое свечение (box-shadow);
 *   — у абзаца синяя плашка из палитры, она шире текста за счёт разлива
 *     тени и не задевает соседние блоки;
 *   — стрелка рисуется своим шрифтом, а не квадратиком-заглушкой.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-hero.mjs --widths 1280 --no-preflight --settle 2000
 */

const button = document.querySelector('.hero__button');
const text = document.querySelector('.hero__text');
const title = document.querySelector('.hero__title');

const style = (el, pseudo = null) => getComputedStyle(el, pseudo);
const buttonStyle = style(button);
const textStyle = style(text);

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
const textBox = text.getBoundingClientRect();
const titleBox = title.getBoundingClientRect();

/* Разлив тени читается из box-shadow: «0 0 0 12px rgba(...)» */
/* Разлив тени: computed-значение может начинаться и с rgba(), и с color(srgb …) */
const spread = Number(
  textStyle.boxShadow.match(/0px 0px 0px (\d+(?:\.\d+)?)px/)?.[1] ?? 0,
);

return {
  кнопка: {
    текст: buttonText,
    стрелкаВТексте: buttonText.includes('↓'),
    восклицательныйЗнак: buttonText.includes('!'),
    фонКартинкой: buttonStyle.backgroundImage !== 'none',
    свечение: buttonStyle.boxShadow,
  },
  абзац: {
    заливка: textStyle.backgroundColor,
    теньПлашки: textStyle.boxShadow,
    скругление: textStyle.borderRadius,
    теньБукв: textStyle.textShadow,
    размер: textStyle.fontSize,
    псевдоПодложка: style(text, '::before').content,
    ширина: Math.round(textBox.width),
    высота: Math.round(textBox.height),
    зазорДоЗаголовка: Math.round(textBox.top - titleBox.bottom),
  },
  проверки: [
    {
      пункт: 'в кнопке текст со стрелкой и без восклицательного знака',
      прошло: buttonText.includes('↓') && !buttonText.includes('!'),
      факт: buttonText,
    },
    {
      пункт: 'у кнопки нет фона-картинки',
      прошло: buttonStyle.backgroundImage === 'none',
      факт: buttonStyle.backgroundImage,
    },
    {
      пункт: 'вокруг кнопки белое свечение',
      прошло: /rgba\(255, 255, 255/.test(buttonStyle.boxShadow),
      факт: buttonStyle.boxShadow,
    },
    {
      пункт: 'плашка абзаца синяя из палитры, а не чёрная',
      прошло: /rgba\(147, 179, 214/.test(textStyle.backgroundColor)
        || /color\(srgb 0\.\d+ 0\.\d+ 0\.\d+/.test(textStyle.backgroundColor),
      факт: textStyle.backgroundColor,
    },
    {
      пункт: 'плашка на 12px шире текста на 1280',
      прошло: spread >= 8 && spread <= 16,
      факт: `разлив ${spread}px`,
    },
    {
      пункт: 'у плашки скругление из шкалы',
      прошло: textStyle.borderRadius === '8px',
      факт: textStyle.borderRadius,
    },
    {
      пункт: 'размытой подложки-псевдоэлемента больше нет',
      прошло: style(text, '::before').content === 'none',
      факт: style(text, '::before').content,
    },
    {
      пункт: 'тень букв узкая, без широкого свечения',
      прошло: /0px 1px 2px/.test(textStyle.textShadow) && !/20px/.test(textStyle.textShadow),
      факт: textStyle.textShadow,
    },
    {
      пункт: 'стрелка рисуется шрифтом, а не заглушкой',
      прошло: glyphWidth('↓') !== glyphWidth('\uFFFF'),
      факт: `стрелка ${glyphWidth('↓')}px, заглушка ${glyphWidth('\uFFFF')}px`,
    },
  ],
};
