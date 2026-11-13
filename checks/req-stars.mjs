/**
 * Запрос: полёт звёзд в секции обратной связи.
 *
 * Что проверяется:
 *   1. До прокрутки звёзды стоят в углах секции, класса is-stars-in нет.
 *   2. Крутим до подвала — класс появляется, звёзды уезжают на конечные
 *      места и остаются там: две верхние встают по краям заголовка,
 *      нижняя — над соцсетями, слева от кружков.
 *   3. В localStorage ничего не записано: при обновлении анимация повторится.
 *
 * Запуск:
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/ \
 *     --request checks/req-stars.mjs --widths 1280 --no-preflight --settle 2000
 */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const starStyle = (el, pseudo) => {
  const s = getComputedStyle(el, pseudo);
  return {
    top: Math.round(parseFloat(s.top)),
    left: Math.round(parseFloat(s.left)),
    right: Math.round(parseFloat(s.right)),
    display: s.display,
  };
};

const section = document.querySelector('[data-stars]');
const inner = document.querySelector('.feedback__inner');
const title = document.querySelector('.feedback__title');
const socials = document.querySelector('.feedback__socials');

if (!section) {
  return { ошибка: 'на странице нет секции с data-stars' };
}

const до = {
  классы: section.className,
  верхняя: starStyle(section, '::before'),
  правая: starStyle(section, '::after'),
  нижняя: starStyle(inner, '::after'),
  ключиХранилища: Object.keys(localStorage),
};

/* Прокрутка до подвала — так же, как это делает человек */
window.scrollTo(0, document.documentElement.scrollHeight);
await wait(3800);

const после = {
  классы: section.className,
  верхняя: starStyle(section, '::before'),
  правая: starStyle(section, '::after'),
  нижняя: starStyle(inner, '::after'),
  ключиХранилища: Object.keys(localStorage),
  прокрутка: Math.round(window.scrollY),
};

const заголовок = {
  левый: Math.round(title.getBoundingClientRect().left),
  правый: Math.round(title.getBoundingClientRect().right),
};
const соцсетиЛевый = Math.round(socials.getBoundingClientRect().left);

/* Отступ верхних звёзд от края заголовка и нижней — от соцсетей */
const отступСлева = после.верхняя.left - заголовок.левый;
const отступСправа = после.правая.right - (document.documentElement.clientWidth - заголовок.правый);
const отступНиза = соцсетиЛевый - после.нижняя.left;

const проверки = [
  {
    пункт: 'класса is-stars-in до прокрутки нет',
    прошло: !до.классы.includes('is-stars-in'),
    факт: до.классы,
  },
  {
    пункт: 'до прокрутки звёзды в углах',
    прошло: до.верхняя.top === 80 && до.верхняя.left === 64
      && после.прокрутка > 0,
    факт: `${до.верхняя.top}/${до.верхняя.left}`,
  },
  {
    пункт: 'после прокрутки класс появился',
    прошло: после.классы.includes('is-stars-in'),
    факт: после.классы,
  },
  {
    пункт: 'верхняя левая звезда встала по левому краю заголовка (±30px)',
    прошло: Math.abs(отступСлева) <= 30,
    факт: `звезда ${после.верхняя.left}, заголовок ${заголовок.левый}, отступ ${отступСлева}`,
  },
  {
    пункт: 'верхняя правая — по правому краю заголовка (±30px)',
    прошло: Math.abs(отступСправа) <= 30,
    факт: `отступ ${отступСправа}`,
  },
  {
    пункт: 'нижняя звезда встала левее соцсетей и выше них',
    прошло: отступНиза > 0 && отступНиза < 120,
    факт: `звезда ${после.нижняя.left}, соцсети ${соцсетиЛевый}, зазор ${отступНиза}`,
  },
  {
    пункт: 'нижняя звезда поднялась из угла',
    прошло: после.нижняя.top < до.нижняя.top - 100,
    факт: `${до.нижняя.top} → ${после.нижняя.top}`,
  },
  {
    пункт: 'в localStorage ничего не добавлено',
    прошло: после.ключиХранилища.length === до.ключиХранилища.length,
    факт: `${до.ключиХранилища.length} → ${после.ключиХранилища.length}`,
  },
  {
    пункт: 'верхние звёзды на одной высоте',
    прошло: Math.abs(после.верхняя.top - после.правая.top) <= 40,
    факт: `${после.верхняя.top} и ${после.правая.top}`,
  },
];

return { до, после, заголовок, соцсетиЛевый, проверки };
