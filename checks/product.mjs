#!/usr/bin/env node
/**
 * Проверка страницы товара: разметка, данные и файлы.
 *
 * Работает без браузера: разметка читается из файла, данные — из data.js,
 * картинки и иконки — с диска. Так проверка ловит то, что глазами видно
 * плохо: разъехавшуюся цену, битую ссылку на файл, размеры фото, которые
 * не совпадают с атрибутами width и height.
 *
 * Запуск: node checks/product.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { PRODUCTS, getProduct } from '../assets/js/data.js';

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(`${name}${detail ? ' -> ' + detail : ''}`);
};

const eq = (actual, expected, name) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(a === e, name, `получено ${a}, ожидалось ${e}`);
};

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const at = (path) => new URL(`../${path}`, import.meta.url);

/** Байты файла или null, если файла нет. */
const bytes = (path) => {
  try {
    return readFileSync(at(path));
  } catch {
    return null;
  }
};

const PAGE = 'product-pages/klubnichnye-polya.html';
const PRODUCT_ID = 'goods-women-03';

// ─────────────── данные товара ───────────────

const product = getProduct(PRODUCT_ID);
ok(Boolean(product), `товар ${PRODUCT_ID} есть в каталоге`, String(product));

eq(product.section, 'women', 'товар лежит в женской коллекции');
eq(product.title, 'Клубничные поля', 'название без опечатки: «Клубничные поля»');
eq(product.price, 12199, 'цена товара');
ok(Array.isArray(product.sizes) && product.sizes.length === 4, 'у товара четыре размера',
  JSON.stringify(product.sizes));
eq(product.sizes, ['S', 'M', 'XL', 'XXL'], 'размеры: S, M, XL, XXL');
ok(typeof product.description === 'string' && product.description.length > 50,
  'у товара есть описание', String(product.description?.length));
ok(Array.isArray(product.details) && product.details.length === 5, 'у товара пять характеристик',
  String(product.details?.length));

/* Характеристики с макета: набор сверяем по названиям, значения — по тексту
   страницы ниже. Если поле переименуют в данных, страница разъедется молча */
eq(product.details.map((d) => d.name),
  ['Сезон', 'Материал', 'Состав материала', 'Коллекция', 'Стиль'],
  'названия характеристик как в макете');

const detailsComplete = product.details.every((d) => d.name && d.value);
ok(detailsComplete, 'у каждой характеристики есть значение');

/* Размеры и характеристики есть только у товаров со страницей: если их
   начнут дописывать всем подряд, это признак, что данные поехали не туда */
const withSizes = PRODUCTS.filter((p) => p.sizes);
eq(withSizes.map((p) => p.id), [PRODUCT_ID], 'размеры размечены только у товара со страницей');

// ─────────────── разметка страницы ───────────────

ok(existsSync(at(PAGE)), 'страница товара существует', PAGE);
const html = read(PAGE);

ok(html.startsWith('<!doctype html>'), 'у страницы есть doctype');
ok(html.includes('data-page="product"'), 'страница помечена как product');
ok(html.includes('../assets/css/style.css'), 'страница подключает стили через ../');
ok(html.includes('../assets/js/script.js'), 'страница подключает точку входа скриптов');

/* Пути через ../ обязательны: страница лежит на уровень глубже корня.
   Обычный путь из корня привёл бы к 404, а страница выглядела бы голой */
const rootRelative = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]);
eq(rootRelative, [], 'нет путей от корня без ../');

const assetPaths = [...html.matchAll(/(?:src|href)="(\.\.\/assets\/[^"]+)"/g)]
  .map((m) => m[1].replace('../', ''));
const missingAssets = [...new Set(assetPaths)].filter((path) => !existsSync(at(path)));
eq(missingAssets, [], 'все файлы, на которые ссылается страница, лежат на месте');
ok(assetPaths.length >= 4, 'страница ссылается на файлы проекта', String(assetPaths.length));

// ─────────────── содержимое страницы против данных ───────────────

ok(html.includes(`>${product.title}<`), 'название товара на странице совпадает с данными');
ok(/<h1[^>]*>/.test(html), 'название — это h1, а не абзац');
ok(html.includes('Пижама для девушек'), 'подпись над названием, как в макете');

/* Цену печатает formatPrice на главной, а на статичной странице она стоит
   текстом: сверяем её с числом из данных, иначе после смены цены страница
   будет продавать по старой */
const priceText = html.match(/class="product__price"[^>]*>([^<]+)</)?.[1]?.trim();
eq(priceText?.replace(/\u00A0/g, ' '), '12 199 ₽', 'цена на странице совпадает с данными');

for (const size of product.sizes) {
  ok(html.includes(`data-product-size="${size}"`), `размер ${size} есть в разметке`);
}

for (const detail of product.details) {
  ok(html.includes(`>${detail.name}<`), `характеристика «${detail.name}» есть в разметке`);
  ok(html.includes(`>${detail.value}<`), `значение «${detail.value}» есть в разметке`);
}

/* Разметка страницы и объект в данных дублируют друг друга: страница статична,
   чтобы читаться без скрипта. Расхождение ловим здесь.
   Пробелы нормализуем: в разметке текст перенесён по строкам, а в данных
   записан одной строкой — для браузера это одно и то же */
const flat = (value) => String(value).replace(/\s+/g, ' ').trim();
ok(flat(html).includes(flat(product.description)),
  'описание на странице совпадает с данными',
  flat(product.description).slice(0, 60));

// ─────────────── картинка товара ───────────────

const imageAttribute = html.match(/class="product__image"[\s\S]*?width="(\d+)"[\s\S]*?height="(\d+)"/);
ok(Boolean(imageAttribute), 'у фото товара заданы width и height');

const imageFile = bytes(product.image);
ok(Boolean(imageFile), 'файл фото товара существует', product.image);

if (imageFile && imageAttribute) {
  const png = imageFile.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  ok(png, 'фото товара — PNG', product.image);
  eq(Number(imageAttribute[1]), imageFile.readUInt32BE(16), 'width на странице равен ширине файла');
  eq(Number(imageAttribute[2]), imageFile.readUInt32BE(20), 'height на странице равен высоте файла');
  eq([product.width, product.height], [imageFile.readUInt32BE(16), imageFile.readUInt32BE(20)],
    'размеры в data.js совпадают с файлом');
}

ok(html.includes(`src="../${product.image}"`), 'страница ссылается на фото из данных');
const alt = html.match(/class="product__image"[\s\S]*?alt="([^"]+)"/)?.[1];
eq(alt, product.alt, 'alt фото совпадает с описанием в данных');

// ─────────────── состав в описании ───────────────

/* Состав — первая строка под заголовком «Описание». Строка та же, что
   subtitle в data.js: там она стоит меткой в карточке каталога, здесь —
   в описании. Сверяем с данными, иначе после смены состава страница
   будет показывать старый */
const compositionMatch = html.match(/class="product__composition"[^>]*>([^<]+)</);
ok(Boolean(compositionMatch), 'в разметке есть строка состава');
eq(compositionMatch?.[1]?.trim(), product.subtitle, 'состав на странице совпадает с данными');

/* Порядок внутри блока: заголовок → состав → текст описания */
const descriptionBlock = (() => {
  const start = html.indexOf('product__block-title">Описание');
  return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
})();

ok(descriptionBlock.indexOf('product__composition') < descriptionBlock.indexOf('product__text'),
  'состав стоит выше текста описания');

// ─────────────── элементы из макета ───────────────

const REQUIRED = [
  ['data-cart-add="goods-women-03"', 'кнопка «Добавить в корзину» добавляет этот товар'],
  ['data-cart-size', 'у кнопки есть место под выбранный размер'],
  ['data-modal-open="cart"', '«Купить в один клик» открывает окно корзины'],
  ['data-print-upload', 'поле выбора файла макета'],
  ['product__sizes', 'блок размеров'],
  ['data-product-prev', 'стрелка «предыдущее фото»'],
  ['data-product-next', 'стрелка «следующее фото»'],
  ['product__details', 'список характеристик'],
  ['product__print-title', 'подпись «Добавить принт:»'],
  ['product__composition', 'состав товара в описании'],
];

for (const [needle, name] of REQUIRED) {
  ok(html.includes(needle), name);
}

/* Точек-индикаторов нет: при одном кадре они ничего не показывали,
   а при появлении вторых ракурсов индикатор вернётся вместе с листанием.
   Разметку и модуль проверяем здесь, стили — ниже, где читается CSS */
ok(!html.includes('product__dots'), 'точек-индикаторов нет в разметке');
ok(!html.includes('data-product-dot'), 'разметки точек не осталось');
ok(!read('assets/js/product.js').includes('data-product-dot'),
  'в модуле нет логики точек');

/* Стрелки остались, но кадр один — обе выключены в разметке */
ok(/class="product__arrow product__arrow--prev"[\s\S]{0,200}?disabled/.test(html),
  'стрелка «назад» выключена: кадр один');
ok(/class="product__arrow product__arrow--next"[\s\S]{0,200}?disabled/.test(html),
  'стрелка «вперёд» выключена: кадр один');

// ─────────────── нанесение принта ───────────────

/* Галочки услуги на странице нет: услуга «ПРИНТ» добавляется кнопкой
   в секции принтов на главной. Если чекбокс вернут, проверка скажет */
ok(!html.includes('data-product-service'), 'галочки услуги нанесения принта нет');
ok(!/type="checkbox"/.test(html), 'на странице нет чекбоксов');
ok(html.includes('>Добавить принт:<'), 'вместо галочки стоит текст «Добавить принт:»');

/* «Выбрать из каталога» — ссылка на каталог: страницы каталога макетов пока
   нет, ведём в секцию принтов главной. Кнопкой быть не должна */
const chooseLink = html.match(/<a[^>]*href="([^"]+)"[^>]*>[\s\S]{0,300}?Выбрать из каталога/);
ok(Boolean(chooseLink), '«Выбрать из каталога» — ссылка, а не кнопка',
  chooseLink ? chooseLink[1] : 'ссылка не найдена');
ok(chooseLink?.[1] === '../index.html#goods-print',
  'ссылка ведёт на каталог принтов главной', String(chooseLink?.[1]));

/* «Добавить свой макет» открывает системное окно выбора файла: это label
   для скрытого input[type=file]. Без JS тоже работает */
ok(/<label[^>]*for="product-print-file"[^>]*>[\s\S]{0,120}?Добавить свой макет/.test(html),
  '«Добавить свой макет» — label для поля с файлом');
ok(/<input[^>]*type="file"[^>]*id="product-print-file"/.test(html)
  || /id="product-print-file"[^>]*type="file"/.test(html),
  'на странице есть поле выбора файла');

const accept = html.match(/accept="([^"]+)"/)?.[1] ?? '';
for (const format of ['pdf', 'jpg', 'jpeg', 'png', 'psd', 'tiff']) {
  ok(accept.includes(`.${format}`), `в accept разрешён .${format}`, accept.slice(0, 60));
}
ok(!/\.doc|\.zip|\.gif|\.svg/.test(accept), 'в accept нет посторонних форматов');

/* Правило формата живёт и в модуле — проверяем настоящую функцию, а не текст:
   в системном окне можно переключиться на «Все файлы» и обойти accept */
const { checkPrintFile, PRINT_FILE_FORMATS } = await import('../assets/js/product.js');
eq(PRINT_FILE_FORMATS, ['.pdf', '.jpg', '.jpeg', '.png', '.psd', '.tiff', '.tif'],
  'модуль знает те же форматы');

for (const [name, expected] of [
  ['макет.pdf', true], ['фото.JPG', true], ['рисунок.png', true], ['макет.psd', true],
  ['скан.tiff', true], ['скан.tif', true], ['фото.jpeg', true],
  ['документ.doc', false], ['архив.zip', false], ['картинка.gif', false], ['файл', false],
]) {
  eq(checkPrintFile({ name }).ok, expected, `файл «${name}» ${expected ? 'принимается' : 'отклоняется'}`);
}
eq(checkPrintFile(null).ok, false, 'пустой выбор не считается файлом');

/* В разметке должен быть ровно один h1: это заголовок страницы */
const h1Count = (html.match(/<h1/g) ?? []).length;
eq(h1Count, 1, 'на странице ровно один h1');

/* Подпись «Размер» скрыта визуально, но нужна скринридеру */
ok(html.includes('product__sizes-title'), 'у блока размеров есть подпись для скринридера');

// ─────────────── файлы, добавленные из макета ───────────────

const bg = bytes('assets/images/product-page/bg.png');
ok(Boolean(bg), 'фон страницы товара лежит в assets/images/product-page');
if (bg) {
  const png = bg.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  ok(png, 'фон — PNG');
  eq([bg.readUInt32BE(16), bg.readUInt32BE(20)], [1536, 864], 'размер фона из макета');
}

for (const icon of ['icon-catalog.svg', 'icon-catalog_white.svg']) {
  const file = bytes(`assets/images/icons/${icon}`);
  ok(Boolean(file), `иконка ${icon} лежит в assets/images/icons`);
  ok(file?.toString('utf8').includes('<svg'), `${icon} — это SVG`);
}

/* Иконка корзины: в макете лежит второй файл той же формы (icon-cart.svg),
   но с другим вьюбоксом. В проекте уже есть cart-white.svg, и второго файла
   с той же иконкой быть не должно — иначе они разъедутся по масштабу */
ok(!existsSync(at('assets/images/icons/icon-cart.svg')),
  'дубля иконки корзины в проекте нет');

// ─────────────── стили и скрипты ───────────────

const css = read('assets/css/pages/product.css');
ok(css.length > 0, 'product.css не пустой', `${css.length} байт`);
ok(read('assets/css/style.css').includes("url('pages/product.css')"),
  'product.css подключён в style.css');

ok(css.includes('bg.png'), 'фон страницы подключён в стилях');
ok(css.includes('icon-catalog.svg'), 'иконка каталога подключена в стилях');
ok(css.includes('cart-white.svg'), 'иконка корзины в кнопке — существующая в проекте');
ok(!css.includes('icon-cart.svg'), 'в стилях нет ссылки на дубль иконки корзины');

/* Точек-индикаторов нет ни в разметке, ни в стилях, ни в модуле:
   при одном кадре они ничего не показывали. Файл page-dot.svg вместе с ними
   остался бы мусором в assets — его тоже не должно быть */
ok(!css.includes('product__dot'), 'стилей точек не осталось');
ok(!css.includes('page-dot.svg'), 'в стилях нет ссылки на точку-индикатор');
ok(!existsSync(at('assets/images/icons/page-dot.svg')),
  'файла точки-индикатора в проекте не осталось');

ok(/@media \(min-width: 768px\)/.test(css), 'у страницы есть планшетная раскладка');
ok(/grid-template-columns/.test(css), 'галерея и информация раскладываются сеткой');
ok(/\.is-active/.test(css), 'у выбранного размера есть оформление');

/* Подпись «Добавить принт:» — тёмная и по левому краю, как обычный текст:
   розовыми на странице остаются только название товара и рамки кнопок.
   align-self: stretch обязателен, потому что родитель — флекс-колонка
   с центровкой: без растяжки подпись сжалась бы до ширины текста,
   и text-align выравнивал бы внутри этой узкой коробки, а не по краю
   колонки */
const printTitleRule = (() => {
  const text = css.replace(/\r\n/g, '\n');
  const at = text.indexOf('.product__print-title {');
  return at < 0 ? '' : text.slice(at, text.indexOf('}', at));
})();

ok(/color: var\(--color-dark\)/.test(printTitleRule), 'подпись «Добавить принт:» тёмная',
  printTitleRule.replace(/\s+/g, ' ').slice(0, 120));
ok(/text-align: left/.test(printTitleRule), 'подпись выровнена по левому краю');
ok(/align-self: stretch/.test(printTitleRule),
  'подпись растянута на ширину колонки — иначе выравнивание не видно');
ok(/margin-top: var\(--space-24\)/.test(printTitleRule),
  'отступ от кнопки «Купить в один клик» — 24px');

/* Выбранный размер — отдельная строка под названием, мельче названия
   и голубым. В само название не дописывается: имя товара от выбора
   не меняется */
ok(html.includes('data-product-size-chosen'), 'в разметке есть строка выбранного размера');
ok(/class="product__chosen-size"[^>]*hidden/.test(html),
  'строка выбранного размера скрыта, пока размер не выбран');

const chosenRule = (() => {
  const text = css.replace(/\r\n/g, '\n');
  const at = text.indexOf('.product__chosen-size {');
  return at < 0 ? '' : text.slice(at, text.indexOf('}', at));
})();

ok(/color: var\(--color-blue\)/.test(chosenRule), 'выбранный размер голубой',
  chosenRule.replace(/\s+/g, ' ').slice(0, 120));
ok(/font-size: var\(--fs-18\)/.test(chosenRule),
  'выбранный размер мельче названия: 18px против 30px');

/* Ховер «Добавить в корзину» — синий, как у «Купить в один клик».
   До этой правки у кнопки с button--pink фон уходил в тёмный */
ok(/\.product__button--cart:hover \{[\s\S]{0,160}?background-color: var\(--color-blue\)/.test(
  css.replace(/\r\n/g, '\n'),
), '«Добавить в корзину» при наведении синеет');

/* Иконка каталога при наведении становится белой: розовый контур на синей
   заливке пропадал бы */
ok(bytes('assets/images/icons/icon-catalog_white.svg'),
  'белая иконка каталога лежит в assets/images/icons');
ok(/\.product__button--print:hover \.product__button-icon--catalog[\s\S]{0,220}?icon-catalog_white\.svg/.test(
  css.replace(/\r\n/g, '\n'),
), 'при наведении иконка каталога меняется на белую');

/* Иконки в ряду кнопок одного масштаба: каталог был 11px при корзине 16px */
const catalogIconRule = (() => {
  const text = css.replace(/\r\n/g, '\n');
  const at = text.indexOf('.product__button-icon--catalog {');
  return at < 0 ? '' : text.slice(at, text.indexOf('}', at));
})();

ok(!/width: 11px/.test(catalogIconRule), 'иконка каталога больше не 11px');

const iconRule = (() => {
  const text = css.replace(/\r\n/g, '\n');
  const at = text.indexOf('.product__button-icon {');
  return at < 0 ? '' : text.slice(at, text.indexOf('}', at));
})();

ok(/flex: none/.test(iconRule), 'иконки не сжимаются вместе с текстом кнопки');
ok(/width: var\(--icon-size-sm\)/.test(iconRule),
  'размер иконок — 16px, как у корзины');

/* Кнопки стоят в столбик: в строку две кнопки занимают 462px, а колонка
   информации — 312px, и на 768px появлялась горизонтальная прокрутка.
   Если кто-то вернёт строку, проверка об этом скажет.
   Правило вырезаем по закрывающей скобке: комментарий внутри длиннее
   любого разумного окна поиска и рос с каждой правкой */
const buttonRule = (() => {
  const text = css.replace(/\r\n/g, '\n');
  const at = text.indexOf('.product__button {');
  return at < 0 ? '' : text.slice(at, text.indexOf('}', at));
})();

ok(/width: 100%/.test(buttonRule), 'кнопки на странице товара растянуты на ширину колонки');
ok(!/\.product__buttons \{[^}]*flex-direction: row/.test(css),
  'кнопки не встают в строку — в колонку информации они не влезают');
ok(!/\.product__print \{[^}]*flex-direction: row/.test(css),
  'кнопки принта тоже в столбик');
/* Расстояние в шаблоне ограничиваем символами, а не «до закрывающей скобки»:
   внутри правила стоит комментарий с фигурными скобками, и шаблон
   [^}]* обрывался на нём.

   До 767px карточка 720px, с 768px тянется за экраном до 1200px: иначе
   по бокам оставалось пустое поле, растущее вместе с экраном (на 1279px —
   280px с каждой стороны). Стрелкам оно больше не нужно, они внутри карточки */
ok(/\.product__card \{[\s\S]{0,600}?max-width: 720px/.test(css.replace(/\r\n/g, '\n')),
  'до 768px карточка 720px — как в макете 320');
ok(/@media \(min-width: 768px\)[\s\S]{0,1200}?max-width: 1200px/.test(
  css.replace(/\r\n/g, '\n'),
), 'с 768px карточка растягивается за экраном до 1200px');

/* Фото прижато к верхнему краю карточки. Колонка информации выше снимка
   (938px против 520px), и при выравнивании по центру над фото оставалось
   209px пустоты. Галерея при этом не растягивается на всю высоту ряда:
   иначе стрелка, привязанная к top: 50%, уезжала к низу снимка.
   Правило вырезаем по закрывающей скобке — в этих правилах нет комментариев
   с фигурными скобками, в отличие от .product__card выше */
const startRule = (selector) => {
  const at = css.indexOf(selector + ' {');
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

const galleryRule = startRule('.product__gallery');
ok(/align-items: flex-start/.test(galleryRule),
  'фото прижато к верхнему краю, а не по центру колонки',
  galleryRule.replace(/\s+/g, ' ').slice(0, 120));
ok(/align-self: start/.test(galleryRule),
  'галерея не растягивается — стрелки стоят по центру снимка');

const stageRule = startRule('.product__stage');
ok(/align-items: flex-start/.test(stageRule),
  'сцена кадра выравнивает фото по верхнему краю');
ok(!/height: 100%/.test(stageRule),
  'у сцены нет height: 100% — он растягивал её на всю колонку');

/* ─────────────── стрелки листания ─────────────── */

/* До 767px стрелки лежат внутри галереи, как в макете 320. С 768px они
   переезжают внутрь карточки, но к её краям: привязка снимается с галереи
   (static) и появляется у .product__card (relative). Отступы берутся
   из трёх величин, объявленных у карточки, — по ним же считаются её поля */
ok(/--arrow-inset: var\(--space-20\)/.test(css), 'отступ стрелки от края карточки — 20px');
ok(/--arrow-size: var\(--space-32\)/.test(css), 'ширина стрелки — 32px');
ok(/--arrow-gap: var\(--space-16\)/.test(css), 'зазор между стрелкой и контентом — 16px');

/* С 1280px зазор растёт до 64px: содержимое отходит от стрелок, и фото
   сдвигается вправо, а колонка «Описание» сокращается справа.
   Тогда же стрелка отходит от края карточки до 32px: 20px выглядят вплотную
   к белому полю, когда карточка во всю ширину */
/* В медиазапросе 1280px обе величины стоят ниже длинного комментария,
   поэтому окно поиска — 1500 символов, а не 700 */
const block1280 = css.slice(css.indexOf('@media (min-width: 1280px)'));
ok(block1280.includes('--arrow-gap: var(--space-64)'),
  'с 1280px зазор между стрелкой и контентом — 64px');
ok(block1280.includes('--arrow-inset: var(--space-32)'),
  'с 1280px отступ стрелки от края карточки — 32px');

ok(/\.product__card \{[^}]*position: relative/.test(css),
  'с 768px координаты стрелок отсчитываются от карточки');
ok(/\.product__gallery \{[^}]*position: static/.test(css),
  'галерея перестаёт держать привязку');
ok(/left: var\(--arrow-inset\)/.test(css), 'левая стрелка у левого края карточки');
ok(/right: var\(--arrow-inset\)/.test(css), 'правая стрелка у правого края карточки');

/* Поля карточки складываются из отступа, ширины стрелки и зазора: если
   их задать числом, стрелка наедет на фото или на кнопки */
ok(/padding: var\(--space-32\)\s*calc\(var\(--arrow-inset\) \+ var\(--arrow-size\) \+ var\(--arrow-gap\)\)/.test(
  css.replace(/\r\n/g, '\n'),
), 'боковые поля карточки считаются под стрелки');

/* На 1280px вертикальные поля свои (40px), поэтому короткая запись padding
   сбросила бы боковые поля, рассчитанные под стрелки */
ok(!/@media \(min-width: 1280px\)[\s\S]{0,400}?\.product__card \{[\s\S]{0,200}?padding: var\(--space-40\)/.test(
  css.replace(/\r\n/g, '\n'),
), 'на 1280px боковые поля карточки не сбрасываются');

/* До 768px всё остаётся как было: стрелка внутри галереи у её краёв */
const basePrev = startRule('.product__arrow--prev');
ok(/left: 0;/.test(basePrev), 'до 768px левая стрелка у края галереи, как в макете 320',
  basePrev.replace(/\s+/g, ' ').slice(0, 80));

/* ─────────────── две колонки с 1280px ─────────────── */

/* С 1280px карточка занимает 1200px и делится на две колонки: слева фото
   и покупка до кнопки «Добавить свой макет», справа описание
   и характеристики. Разделение — по разметке, поэтому проверяем и её,
   и стили: если обёртки поедут, колонки сложатся не там */

ok(html.includes('class="product__main"'), 'первая колонка обёрнута в .product__main');
ok(html.includes('class="product__specs"'), 'вторая колонка обёрнута в .product__specs');

const mainStart = html.indexOf('class="product__main"');
const specsStart = html.indexOf('class="product__specs"');
const articleEnd = html.indexOf('</article>');

ok(mainStart > 0 && specsStart > mainStart, 'вторая колонка идёт после первой',
  `${mainStart} → ${specsStart}`);

/* Комментарии разметки из сравнения выбрасываем: в них встречаются те же
   слова («Описание и характеристики» подписано над блоком), и проверка
   ловила комментарий вместо содержимого */
const noComments = (value) => value.replace(/<!--[\s\S]*?-->/g, '');
const mainHtml = noComments(html.slice(mainStart, specsStart));
const specsHtml = noComments(html.slice(specsStart, articleEnd));

/* Граница колонок: последнее, что стоит в первой, — кнопка «Добавить свой
   макет»; первое во второй — заголовок «Описание» */
ok(mainHtml.includes('data-print-upload'), 'кнопка «Добавить свой макет» в первой колонке');
ok(!specsHtml.includes('data-print-upload'), 'и её нет во второй колонке',
  'кнопка попала в блок описания');
ok(mainHtml.includes('Описание') === false,
  'описания в первой колонке нет — оно начинается со второй');
ok(specsHtml.indexOf('Описание') < specsHtml.indexOf('Характеристики'),
  'во второй колонке сперва описание, потом характеристики');

/* Первым после кнопки «Добавить свой макет» в разметке идёт блок описания:
   между ними не должно быть ничего из первой колонки */
const afterPrint = html.slice(html.indexOf('data-print-upload'), specsStart);
ok(!afterPrint.includes('product__price') && !afterPrint.includes('product__size"'),
  'после кнопки принта первая колонка заканчивается — цена и размеры выше');

/* Карточка на всю ширину контейнера только с 1280px. До этого 720px:
   иначе стрелкам листания негде встать */
const media1280 = css.slice(css.indexOf('@media (min-width: 1280px)'));
ok(media1280.includes('max-width: 1200px'), 'с 1280px карточка до 1200px');
ok(/@media \(min-width: 1280px\)[\s\S]{0,400}?\.product__card \{[\s\S]{0,300}?grid-template-columns/.test(
  css.replace(/\r\n/g, '\n'),
), 'с 1280px карточка раскладывается на две колонки');

const mainRule = startRule('.product__main');
ok(mainRule.length > 0, 'у первой колонки есть своя раскладка');
ok(/auto minmax\(0, 1fr\)/.test(media1280),
  'в первой колонке фото занимает свою ширину, информация — остальное');

ok(/\.product__specs > \.product__block:first-child \{[\s\S]{0,120}?margin-top: 0/.test(
  css.replace(/\r\n/g, '\n'),
), 'описание встаёт вровень с верхом фото');

/* ─────────────── связка со скриптами ─────────────── */

const script = read('assets/js/script.js');
ok(script.includes('initProduct'), 'точка входа запускает страницу товара');
ok(script.includes("page === 'product'"), 'точка входа знает признак product');

const module = read('assets/js/product.js');
ok(module.includes('initProduct'), 'product.js экспортирует initProduct');
ok(module.includes('data-cart-size'), 'product.js проставляет размер кнопке корзины');

/* Галочки услуги больше нет, значит и логики услуги в модуле быть не должно:
   она ушла вместе с чекбоксом */
ok(!module.includes('data-product-service'), 'в модуле нет логики галочки услуги');
ok(!module.includes('hasService'), 'модуль не трогает услугу «ПРИНТ» в корзине');
ok(module.includes('checkPrintFile'), 'в модуле есть проверка формата файла');

/* Отзыв «В корзине» меняет текст кнопки. Если менять его у всей кнопки,
   иконка внутри стирается безвозвратно — так и было до этой правки */
ok(html.includes('data-cart-label'), 'подпись кнопки корзины помечена data-cart-label');
const cartUi = read('assets/js/cart-ui.js');
ok(cartUi.includes('data-cart-label'),
  'cart-ui.js меняет текст подписи, а не всей кнопки');
ok(cartUi.includes('const target = label ?? button'),
  'для кнопок без подписи отзыв работает как раньше');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страница: ${PAGE} (${html.length} байт)\n`);
process.stdout.write(`Товар: ${product.title} — ${product.price} ₽, размеры ${product.sizes.join(', ')}\n`);
process.stdout.write(`Файлы из макета: bg.png ${bg ? Math.round(bg.length / 1024) + ' КБ' : 'нет'}, `
  + `иконок ${['icon-catalog.svg', 'icon-catalog_white.svg']
    .filter((i) => bytes(`assets/images/icons/${i}`)).length}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((f) => process.stdout.write(`  FAIL ${f}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');

