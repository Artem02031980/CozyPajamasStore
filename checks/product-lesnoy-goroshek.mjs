#!/usr/bin/env node
/**
 * Проверка страницы товара «Лесной горошек» (комплект Брюки + Сорочка, мужская) — без браузера.
 *
 * Страница собрана по мужскому образцу (myatnyy-vecher.html), поэтому
 * проверяется то, что задаёт именно этот товар и что легко сломать при правках:
 *
 *   1. данные в разметке совпадают с data.js — название, цена, состав,
 *      фото с настоящими пикселями файла, описание и характеристики;
 *   2. подпись над названием — «Пижама для мужчин»;
 *   3. размеры одинаковы в разметке, в данных и в окне выбора на главной:
 *      у этого товара нет своего набора, поэтому берётся секционный
 *      S, M, XL, XXL (в отличие от шаблона с M, XL, XXL, XXXL);
 *   4. корзина и покупка в один клик ведут на этот товар;
 *   5. от шаблона и от соседних страниц не осталось чужих данных.
 *
 * Замеры и клики в браузере — checks/req-product-new.mjs.
 *
 * Запуск: node checks/product-lesnoy-goroshek.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { getProduct, getSizes } from '../assets/js/data.js';

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
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const flat = (value) => value.replace(/\s+/g, ' ').trim();
const price = (value) => value.toLocaleString('ru-RU').replace(/\s/g, ' ');

const PAGE = 'product-pages/lesnoy-goroshek.html';
const ID = 'goods-men-13';

ok(exists(PAGE), `страница ${PAGE} существует`);
if (!exists(PAGE)) {
  process.stdout.write('НЕ ПРОШЛО: страницы нет\n');
  process.exit(1);
}

const html = read(PAGE);
const product = getProduct(ID);

// ─────────────── данные товара ───────────────

eq(product.title, 'Лесной горошек', 'название товара в данных');
ok(html.includes(`<h1 class="product__title">${product.title}</h1>`),
  'название в разметке совпадает с данными');
ok(html.includes(`<p class="product__price">${price(product.price)} ₽</p>`),
  'цена в разметке совпадает с данными', String(product.price));
ok(html.includes(`<p class="product__composition">${product.subtitle}</p>`),
  'состав в разметке совпадает с данными', product.subtitle);
ok(html.includes(`src="../${product.image}"`), 'фото товара в разметке', product.image);
ok(html.includes(`width="${product.width}"`) && html.includes(`height="${product.height}"`),
  'размеры фото в разметке совпадают с данными');
ok(html.includes(`alt="${product.alt}"`), 'alt фото взят из данных');

/* Подпись над названием: у комплекта вид не берётся из types[0] (там часть
   состава — «Брюки»), а всегда «Пижама <возрастная группа со строчной>» */
const labelOf = (item) => `Пижама ${item.ages[0].charAt(0).toLowerCase()}${item.ages[0].slice(1)}`;
eq(product.ages, ['Для мужчин'], 'возрастная группа товара в данных');
ok(html.includes(`<p class="product__subtitle">${labelOf(product)}</p>`),
  `подпись «${labelOf(product)}»`);

// ─────────────── описание и характеристики ───────────────

ok(flat(html).includes(flat(product.description)), 'описание в разметке совпадает с данными');

for (const detail of product.details) {
  ok(html.includes(`<dt class="product__details-name">${detail.name}</dt>`),
    `характеристика «${detail.name}»`);
  ok(html.includes(`<dd class="product__details-value">${detail.value}</dd>`),
    `значение «${detail.name}»`);
}

eq((html.match(/class="product__details-name"/g) ?? []).length, product.details.length,
  'число характеристик на странице');
eq(product.details.map((detail) => detail.name),
  ['Сезон', 'Материал', 'Состав материала', 'Узор', 'Комплектация', 'Коллекция', 'Стиль'],
  'у мужской страницы семь характеристик: сезон, материал, состав, узор, комплектация, коллекция, стиль');

// ─────────────── заголовок вкладки и meta description ───────────────

ok(html.includes(`<title>${product.title} — пижама мужская | Магазин уютных пижам</title>`),
  'title вкладки');
const meta = html.match(/name="description"\s+content="([^"]+)"/);
ok(meta?.[1]?.includes(`«${product.title}»`) === true, 'meta description называет товар');
ok(meta?.[1]?.includes(price(product.price) + ' ₽') === true, 'meta description называет цену');

// ─────────────── размеры ───────────────

const sizes = getSizes(product);
const chips = [...html.matchAll(/data-product-size="([^"]+)"/g)].map((match) => match[1]);
eq(sizes, ['S', 'M', 'XL', 'XXL'], 'размеры товара в данных — набор секции men');
eq(chips, sizes, 'чипы размеров на странице совпадают с данными');
ok(html.includes('data-size-error'), 'у товара есть размеры — есть и подсказка о них');
ok(!html.includes('XXXL'), 'размера XXXL, которого нет в данных, нет на странице');

// ─────────────── корзина и покупка ───────────────

ok(html.includes(`data-cart-add="${ID}"`), 'кнопка корзины добавляет этот товар');
ok(html.includes(`data-buy-now="${ID}"`), 'покупка в один клик оформляет этот товар');
ok(html.includes('data-buy-now-redirect="../thanks-cart.html"'),
  'покупка в один клик ведёт на страницу благодарности');
ok(html.includes('href="../prints.html"'), '«Выбрать из каталога» ведёт в каталог принтов');
ok(html.includes('data-print-upload'), 'поле для своего макета на месте');

// ─────────────── каркас страницы ───────────────

ok(html.includes('<body data-page="product" data-section="men">'),
  'страница помечена видом товара «men» — от него фон и акцент');
ok(html.includes('data-modal="cart"'), 'окно корзины на месте');
ok(html.includes('src="../assets/js/script.js"'), 'скрипт подключён');
ok(html.includes('class="footer__copyright"'), 'подвал на месте');
ok(html.includes('href="../index.html#goods-men"'), 'ссылка на мужскую коллекцию ведёт на главную');

// ─────────────── ссылка с карточки каталога ───────────────

eq(product.page, PAGE, 'у товара есть адрес страницы');
eq(getProduct('goods-men-13').page, PAGE, 'карточка «Лесной горошек» ведёт на эту страницу');
ok(/product\.page \?\? 'product-pages\/'/.test(read('assets/js/render.js')),
  'render.js подставляет адрес из данных');

// ─────────────── чужих данных не осталось ───────────────

const leftovers = ['Клубничные поля', 'Солнце', 'Русская душа', 'Пшеничное поле',
  'Розовые поля', 'Тёмная ночь V', 'Мамино счастье VI', 'Спокойный сон III',
  'Нетленная классика II', 'Синий бриз', 'Пальмовый полдень', 'Пудровое утро',
  'Льняное утро', 'Розовый сад', 'Белая классика', 'Пионовый рассвет',
  'Алый кокон', 'Розовый зефир', 'Шалфейный кокон', 'Зайкины сны',
  'Розовая зебра', 'Лазурный плюш', 'Снежная вязь', 'Полярный мишка',
  'Волны Балтики', 'Монохромный сад', 'Нежный рубчик', 'Небесный шёлк',
  'Кружевная нега', 'Белый парус', 'Ботанический сон', 'Ночная клетка',
  'Ягодная клетка', 'Хвойная клетка', 'Ажурное утро', 'Снежный лён',
  'Тонкий кант', 'Уютный трикотаж', 'Лесная нега', 'Пудровый сад',
  'Розовый флёр', 'Ажурная вуаль', 'Тропический шёлк', 'Белое кружево',
  'Вишнёвая сорочка', 'Розовый атлас', 'Мягкий графит', 'Кремовый вальс',
  'Мятный вечер', 'Лазурная клетка', 'Осенний плед', 'Снежный халат',
  'Тихое серебро', 'Ночная мгла', 'Акварельное утро', 'Изумрудный сад',
  'Морской сон', 'Клетка горца', 'Изумрудная полоска', 'Розовый закат',
  'goods-new-01', 'goods-new-02', 'goods-new-03', 'goods-new-04', 'goods-new-05',
  'goods-new-06', 'goods-women-01', 'goods-women-02', 'goods-women-03', 'goods-women-04',
  'goods-women-05', 'goods-women-06', 'goods-women-07', 'goods-women-08',
  'goods-women-09', 'goods-women-10', 'goods-women-11', 'goods-women-12',
  'goods-women-13', 'goods-women-14', 'goods-women-15', 'goods-women-16',
  'goods-women-17', 'goods-women-18', 'goods-women-19', 'goods-women-20',
  'goods-women-21', 'goods-women-22', 'goods-women-23', 'goods-women-24',
  'goods-women-25', 'goods-women-26', 'goods-women-27', 'goods-women-28',
  'goods-women-29', 'goods-women-30', 'goods-women-31', 'goods-women-32',
  'goods-women-33', 'goods-women-34', 'goods-women-35', 'goods-women-36',
  'goods-women-37', 'goods-women-38', 'goods-women-39', 'goods-women-40',
  'goods-women-41', 'goods-women-42', 'goods-women-43', 'goods-women-44',
  'goods-women-45', 'goods-women-46', 'goods-women-47', 'goods-women-48',
  'goods-men-01', 'goods-men-02', 'goods-men-03', 'goods-men-04', 'goods-men-05',
  'goods-men-06', 'goods-men-07', 'goods-men-08', 'goods-men-09', 'goods-men-10',
  'goods-men-11', 'goods-men-12', 'goods-other-16',
  'w01.webp', 'w02.webp', 'w03.webp', 'w04.webp', 'w05.webp', 'w06.webp', 'w07.webp',
  'w08.webp', 'w09.webp', 'w10.webp', 'w11.webp', 'w12.webp', 'w13.webp', 'w14.webp',
  'w15.webp', 'w16.webp', 'w17.webp', 'w18.webp', 'w19.webp', 'w20.webp', 'w21.webp',
  'w22.webp', 'w23.webp', 'w24.webp', 'w25.webp', 'w26.webp', 'w27.webp', 'w28.webp',
  'w29.webp', 'w30.webp', 'w31.webp', 'w32.webp', 'w33.webp', 'w34.webp', 'w35.webp',
  'w36.webp', 'w37.webp', 'w38.webp', 'w39.webp', 'w40.webp', 'w41.webp', 'w42.webp',
  'w43.webp', 'w44.webp', 'w45.webp', 'w46.webp', 'w47.webp', 'w48.webp',
  'm01.webp', 'm02.webp', 'm03.webp', 'm04.webp', 'm05.webp', 'm06.webp', 'm07.webp',
  'm08.webp', 'm09.webp', 'm10.webp', 'm11.webp', 'm12.webp',
  '12 199', '7 699', '3 999', '6 599', '12 999', '4 199', '2 799', '6 999',
  '4 599', '5 599', '6 299', '7 999', '5 499', '4 999', '8 699',
  '8 799', '9 299', '9 499', '8 599', '9 699', '2 150', '8 499',
  '5 299', '9 999', '11 499', '4 499', '6 299', '5 899', '7 799',
  '4 699', '4 899', '5 199', '10 999', '10 499', '6 499', '10 699',
  '10 299', '6 799', '5 699', '8 999', '7 299', '7 499', '8 199',
  '6 899', '9 499',
  'велсофт', 'махров',
  'палаццо',
  'лавандов', 'вышивк', 'фланель', 'топик',
  'листов', 'ботanic', 'белый парус', 'кардиган',
  'клетк', 'оборк', 'рюш', 'бретел', 'спагетти', 'фонарик',
  'папоротн', 'оливков', 'пион', 'флер', 'кимоно', 'полупрозрачн',
  'шифон', 'Халатик', 'Шорты', 'кружев', 'футер', 'Шёлк', 'вискоза',
  'width="385"', 'height="1159"', 'width="294"', 'height="1034"',
  'width="349"', 'height="1135"', 'width="365"', 'height="1152"',
  'width="471"', 'height="1113"', 'width="346"', 'height="1148"',
  'width="456"', 'height="1428"', 'width="343"', 'height="1112"',
  'width="702"', 'width="557"', 'width="303"',
  'width="378"', 'width="351"', 'width="403"', 'width="361"', 'width="446"',
  'width="375"', 'width="518"']
  .filter((needle) => html.includes(needle));
eq(leftovers, [], 'в разметке нет данных шаблона и соседних страниц');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страница: ${PAGE} (${html.length} байт)\n`);
process.stdout.write(`Товар: ${product.title} — ${price(product.price)} ₽, `
  + `размеры ${chips.join(', ')}, характеристик ${product.details.length}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');