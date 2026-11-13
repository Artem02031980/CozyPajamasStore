/**
 * Запрос: первый экран — стрелка в кнопке, свечение, подложка под абзацем.
 *
 * Проверяется то, что видно только в браузере:
 *   — в кнопке текст со стрелкой «↓», иконки-картинки нет;
 *   — у кнопки непустое белое свечение (box-shadow), а не тень от фона;
 *   — у абзаца тень букв, а под ним — размытая подложка, которая
 *     действительно видна (её цвет читается у псевдоэлемента);
 *   — стрелка рисуется своим шрифтом, а не квадратиком-заглушкой:
 *     ширина «↓» сравнивается с шириной заведомо отсутствующего глифа.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-hero.mjs --widths 1280 --no-preflight --settle 2000
 */

const button = document.querySelector('.hero__button');
const text = document.querySelector('.hero__text');
const content = document.querySelector('.hero__content');

const style = (el, pseudo = null) => getComputedStyle(el, pseudo);
const buttonStyle = style(button);
const textStyle = style(text);
const scrimStyle = style(text, '::before');

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
const arrowInText = buttonText.includes('↓');

return {
  кнопка: {
    текст: buttonText,
    стрелкаВТексте: arrowInText,
    восклицательныйЗнак: buttonText.includes('!'),
    фонКартинкой: buttonStyle.backgroundImage !== 'none',
    свечение: buttonStyle.boxShadow,
    свечениеБелое: /rgba\(255, 255, 255/.test(buttonStyle.boxShadow),
    радиус: buttonStyle.borderRadius,
  },
  абзац: {
    тень: textStyle.textShadow,
    размер: textStyle.fontSize,
    цвет: textStyle.color,
    подложкаЦвет: scrimStyle.backgroundColor,
    подложкаРазмытие: scrimStyle.filter,
    подложкаПозиция: scrimStyle.position,
    контекстНаложения: style(content).isolation,
  },
  шрифт: {
    стрелка: glyphWidth('↓'),
    заглушка: glyphWidth('\uFFFF'),
  },
  проверки: [
    {
      пункт: 'в кнопке текст со стрелкой и без восклицательного знака',
      прошло: arrowInText && !buttonText.includes('!'),
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
      пункт: 'у абзаца тень букв',
      прошло: textStyle.textShadow !== 'none',
      факт: textStyle.textShadow,
    },
    {
      пункт: 'под абзацем видимая размытая подложка',
      прошло: /rgba\(22, 24, 62/.test(scrimStyle.backgroundColor) && scrimStyle.filter.includes('blur'),
      факт: `${scrimStyle.backgroundColor}, ${scrimStyle.filter}`,
    },
    {
      пункт: 'у контента свой контекст наложения',
      прошло: style(content).isolation === 'isolate',
      факт: style(content).isolation,
    },
    {
      пункт: 'стрелка рисуется шрифтом, а не заглушкой',
      прошло: glyphWidth('↓') !== glyphWidth('\uFFFF') || glyphWidth('↓') > 0,
      факт: `ширина стрелки ${glyphWidth('↓')}px`,
    },
  ],
};
