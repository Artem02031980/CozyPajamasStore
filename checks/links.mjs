#!/usr/bin/env node
/**
 * Проверка связей между страницами и позиции «Свой макет» — без браузера.
 *
 * Что стережётся:
 *   1. карточка «Клубничные поля» на главной ведёт на свою страницу товара,
 *      «Солнце», «Русская душа», «Пшеничное поле», «Розовые поля», «Тёмная
 *      ночь V», «Мамино счастье VI», «Спокойный сон III», «Нетленная
 *      классика II», «Синий бриз», «Пальмовый полдень», «Пудровое утро»,
*      «Льняное утро», «Розовый сад», «Белая классика», «Пионовый рассвет»,
      *      «Алый кокон», «Розовый зефир», «Шалфейный кокон», «Зайкины сны»,
      *      «Розовая зебра», «Лазурный плюш», «Снежная вязь», «Полярный мишка»,
      *      «Волны Балтики», «Монохромный сад», «Нежный рубчик», «Небесный шёлк»,
      *      «Кружевная нега», «Белый парус», «Ботанический сон», «Ночная клетка»,
      *      «Ягодная клетка», «Хвойная клетка», «Ажурное утро», «Снежный лён»,
      *      «Тонкий кант», «Уютный трикотаж», «Лесная нега», «Пудровый сад»,
      *      «Розовый флёр» и «Ажурная вуаль» — на свои, а товары без страницы
      *      — на прежнюю заглушку;
 *   2. ссылка «Выбрать из каталога» на странице товара ведёт в каталог
 *      принтов (prints.html);
 *   3. загруженный макет становится позицией корзины «Свой макет»:
 *      нулевая сумма, пометка про менеджера и иконка файла;
 *   4. картинка товара в корзине строится от корня проекта, а не от текущей
 *      страницы — иначе на странице товара она не находилась бы.
 *
 * Клики и загрузку файла проверяет checks/req-product.mjs в браузере.
 *
 * Запуск: node checks/links.mjs
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
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

const RENDER = read('assets/js/render.js');
const CART = read('assets/js/cart.js');
const RENDER_CART = read('assets/js/render-cart.js');
const PRODUCT_JS = read('assets/js/product.js');
const PRODUCT_HTML = read('product-pages/klubnichnye-polya.html');

// ─────────────── карточка ведёт на страницу товара ───────────────

/* Адрес страницы живёт в данных: у товара есть поле page */
const withPage = PRODUCTS.filter((product) => product.page);
eq(withPage.map((product) => product.id), [
  'goods-new-01', 'goods-new-02', 'goods-new-03', 'goods-new-04', 'goods-new-05', 'goods-new-06',
  'goods-women-01', 'goods-women-02', 'goods-women-03', 'goods-women-04', 'goods-women-05',
  'goods-women-06', 'goods-women-07', 'goods-women-08', 'goods-women-09', 'goods-women-10',
  'goods-women-11', 'goods-women-12', 'goods-women-13', 'goods-women-14', 'goods-women-15',
  'goods-women-16', 'goods-women-17', 'goods-women-18', 'goods-women-19',
  'goods-women-20', 'goods-women-21', 'goods-women-22', 'goods-women-23',
  'goods-women-24', 'goods-women-25', 'goods-women-26', 'goods-women-27',
  'goods-women-28', 'goods-women-29', 'goods-women-30', 'goods-women-31',
  'goods-women-32', 'goods-women-33', 'goods-women-34', 'goods-women-35',
  'goods-women-36', 'goods-women-37', 'goods-women-38', 'goods-women-39',
  'goods-women-40', 'goods-women-41', 'goods-women-42', 'goods-women-43',
  'goods-women-44', 'goods-women-45', 'goods-women-46', 'goods-women-47',
  'goods-women-48', 'goods-men-01', 'goods-men-02', 'goods-men-03', 'goods-men-04',
  'goods-men-05', 'goods-men-06', 'goods-men-07', 'goods-men-08', 'goods-men-09',
  'goods-men-10', 'goods-men-11', 'goods-men-12', 'goods-men-13', 'goods-men-14',
  'goods-men-15', 'goods-men-16', 'goods-men-17', 'goods-men-18', 'goods-men-19', 'goods-men-20', 'goods-men-21', 'goods-men-22', 'goods-men-23', 'goods-men-24', 'goods-men-25', 'goods-men-26', 'goods-men-27', 'goods-men-28', 'goods-men-29', 'goods-men-30', 'goods-men-31', 'goods-men-32', 'goods-men-33', 'goods-men-34', 'goods-men-35', 'goods-men-36', 'goods-men-37', 'goods-men-38', 'goods-other-16',
], 'страницы размечены у восьмидесяти пяти товаров: шесть новинок, сорок восемь женских, '
  + 'тридцать мужских и подушка');

/* Адреса новинок — отдельным списком: их проверяет ещё checks/product-new.mjs,
   а здесь важно, что ссылка с карточки каталога не ведёт в пустоту */
const NEW_PAGES = {
  'goods-new-01': 'product-pages/nezhnoe-schaste.html',
  'goods-new-02': 'product-pages/nochnaya-svoboda.html',
  'goods-new-03': 'product-pages/spokoynaya-noch-iv.html',
  'goods-new-04': 'product-pages/ogon-prometeya.html',
  'goods-new-05': 'product-pages/rozovye-perekrestki.html',
  'goods-new-06': 'product-pages/vygodnaya-filosofiya.html',
};

for (const [id, page] of Object.entries(NEW_PAGES)) {
  eq(getProduct(id).page, page, `адрес страницы «${getProduct(id).title}»`);
}

eq(getProduct('goods-women-01').page, 'product-pages/solntse.html',
  'адрес страницы «Солнца»');
eq(getProduct('goods-women-02').page, 'product-pages/russkaya-dusha.html',
  'адрес страницы «Русской души»');
eq(getProduct('goods-women-04').page, 'product-pages/pshenichnoe-pole.html',
  'адрес страницы «Пшеничного поля»');
eq(getProduct('goods-women-05').page, 'product-pages/rozovye-polya.html',
  'адрес страницы «Розовых полей»');
eq(getProduct('goods-women-06').page, 'product-pages/temnaya-noch-v.html',
  'адрес страницы «Тёмной ночи V»');
eq(getProduct('goods-women-07').page, 'product-pages/mamino-schaste-vi.html',
  'адрес страницы «Маминого счастья VI»');
eq(getProduct('goods-women-08').page, 'product-pages/spokoynyy-son-iii.html',
  'адрес страницы «Спокойного сна III»');
eq(getProduct('goods-women-09').page, 'product-pages/netlennaya-klassika-ii.html',
  'адрес страницы «Нетленной классики II»');
eq(getProduct('goods-women-10').page, 'product-pages/siniy-briz.html',
  'адрес страницы «Синего бриза»');
eq(getProduct('goods-women-11').page, 'product-pages/palmovyy-polden.html',
  'адрес страницы «Пальмового полдня»');
eq(getProduct('goods-women-12').page, 'product-pages/pudrovoe-utro.html',
  'адрес страницы «Пудрового утра»');
eq(getProduct('goods-women-13').page, 'product-pages/lnyanoe-utro.html',
  'адрес страницы «Льняного утра»');
eq(getProduct('goods-women-14').page, 'product-pages/rozovyy-sad.html',
  'адрес страницы «Розового сада»');
eq(getProduct('goods-women-15').page, 'product-pages/belaya-klassika.html',
  'адрес страницы «Белой классики» (женской)');
eq(getProduct('goods-women-16').page, 'product-pages/pionovyy-rassvet.html',
  'адрес страницы «Пионового рассвета»');
eq(getProduct('goods-women-17').page, 'product-pages/alyy-kokon.html',
  'адрес страницы «Алого кокона»');
eq(getProduct('goods-women-18').page, 'product-pages/rozovyy-zefir.html',
  'адрес страницы «Розового зефира»');
eq(getProduct('goods-women-19').page, 'product-pages/shalfeynyy-kokon.html',
  'адрес страницы «Шалфейного кокона»');
eq(getProduct('goods-women-20').page, 'product-pages/zaykiny-sny.html',
  'адрес страницы «Зайкиных снов»');
eq(getProduct('goods-women-21').page, 'product-pages/rozovaya-zebra.html',
  'адрес страницы «Розовой зебры»');
eq(getProduct('goods-women-22').page, 'product-pages/lazurnyy-plyush.html',
  'адрес страницы «Лазурного плюша»');
eq(getProduct('goods-women-23').page, 'product-pages/snezhnaya-vyaz.html',
  'адрес страницы «Снежной вязи»');
eq(getProduct('goods-women-24').page, 'product-pages/polyarnyy-mishka.html',
  'адрес страницы «Полярного мишки»');
eq(getProduct('goods-women-25').page, 'product-pages/volny-baltiki.html',
  'адрес страницы «Волн Балтики»');
eq(getProduct('goods-women-26').page, 'product-pages/monokhromnyy-sad.html',
  'адрес страницы «Монохромного сада»');
eq(getProduct('goods-women-27').page, 'product-pages/nezhnyy-rubchik.html',
  'адрес страницы «Нежного рубчика»');
eq(getProduct('goods-women-28').page, 'product-pages/nebesnyy-shelk.html',
  'адрес страницы «Небесного шёлка»');
eq(getProduct('goods-women-29').page, 'product-pages/kruzhevnaya-nega.html',
  'адрес страницы «Кружевной неги»');
eq(getProduct('goods-women-30').page, 'product-pages/beliy-parus.html',
  'адрес страницы «Белого паруса»');
eq(getProduct('goods-women-31').page, 'product-pages/botanicheskiy-son.html',
  'адрес страницы «Ботанического сна»');
eq(getProduct('goods-women-32').page, 'product-pages/nochnaya-kletka.html',
  'адрес страницы «Ночной клетки»');
eq(getProduct('goods-women-33').page, 'product-pages/yagodnaya-kletka.html',
  'адрес страницы «Ягодной клетки»');
eq(getProduct('goods-women-34').page, 'product-pages/khvoynaya-kletka.html',
  'адрес страницы «Хвойной клетки»');
eq(getProduct('goods-women-35').page, 'product-pages/azhurnoe-utro.html',
  'адрес страницы «Ажурного утра»');
eq(getProduct('goods-women-36').page, 'product-pages/snezhnyy-lyon.html',
  'адрес страницы «Снежного льна»');
eq(getProduct('goods-women-37').page, 'product-pages/tonkiy-kant.html',
  'адрес страницы «Тонкого канта»');
eq(getProduct('goods-women-38').page, 'product-pages/uyutnyy-trikotazh.html',
  'адрес страницы «Уютного трикотажа»');
eq(getProduct('goods-women-39').page, 'product-pages/lesnaya-nega.html',
  'адрес страницы «Лесной неги»');
eq(getProduct('goods-women-40').page, 'product-pages/pudrovyy-sad.html',
  'адрес страницы «Пудрового сада»');
eq(getProduct('goods-women-41').page, 'product-pages/rozovyy-fler.html',
  'адрес страницы «Розового флёра»');
eq(getProduct('goods-women-42').page, 'product-pages/azhurnaya-vual.html',
  'адрес страницы «Ажурной вуали»');
eq(getProduct('goods-women-43').page, 'product-pages/tropicheskiy-shelk.html',
  'адрес страницы «Тропического шёлка»');
eq(getProduct('goods-women-44').page, 'product-pages/beloe-kruzhevo.html',
  'адрес страницы «Белого кружева»');
eq(getProduct('goods-women-45').page, 'product-pages/vishnyovaya-sorochka.html',
  'адрес страницы «Вишнёвой сорочки»');
eq(getProduct('goods-women-46').page, 'product-pages/rozovyy-atlas.html',
  'адрес страницы «Розового атласа»');
eq(getProduct('goods-women-47').page, 'product-pages/myagkiy-grafit.html',
  'адрес страницы «Мягкого графита»');
eq(getProduct('goods-women-48').page, 'product-pages/kremovyy-vals.html',
  'адрес страницы «Кремового вальса»');
eq(getProduct('goods-women-03').page, 'product-pages/klubnichnye-polya.html',
  'адрес страницы «Клубничных полей»');
eq(getProduct('goods-men-01').page, 'product-pages/myatnyy-vecher.html',
  'адрес страницы «Мятного вечера»');
eq(getProduct('goods-men-02').page, 'product-pages/lazurnaya-kletka.html',
  'адрес страницы «Лазурной клетки»');
eq(getProduct('goods-men-03').page, 'product-pages/osenniy-pled.html',
  'адрес страницы «Осеннего пледа»');
eq(getProduct('goods-men-04').page, 'product-pages/snezhnyy-khalat.html',
  'адрес страницы «Снежного халата»');
eq(getProduct('goods-men-05').page, 'product-pages/tikhoye-serebro.html',
  'адрес страницы «Тихого серебра»');
eq(getProduct('goods-men-06').page, 'product-pages/nochnaya-mgla.html',
  'адрес страницы «Ночной мглы»');
eq(getProduct('goods-men-07').page, 'product-pages/akvarelnoe-utro.html',
  'адрес страницы «Акварельного утра»');
eq(getProduct('goods-men-08').page, 'product-pages/izumrudnyy-sad.html',
  'адрес страницы «Изумрудного сада»');
eq(getProduct('goods-men-09').page, 'product-pages/morskoy-son.html',
  'адрес страницы «Морского сна»');
eq(getProduct('goods-men-10').page, 'product-pages/kletka-gortsa.html',
  'адрес страницы «Клетки горца»');
eq(getProduct('goods-men-11').page, 'product-pages/izumrudnaya-poloska.html',
  'адрес страницы «Изумрудной полоски»');
eq(getProduct('goods-men-12').page, 'product-pages/rozovyy-zakat.html',
  'адрес страницы «Розового заката»');
eq(getProduct('goods-men-13').page, 'product-pages/lesnoy-goroshek.html',
  'адрес страницы «Лесного горошка»');
eq(getProduct('goods-men-14').page, 'product-pages/morskoy-shtrikh.html',
  'адрес страницы «Морского штриха»');
eq(getProduct('goods-men-15').page, 'product-pages/grafitovyy-son.html',
  'адрес страницы «Графитового сна»');
eq(getProduct('goods-men-16').page, 'product-pages/vishnevyy-goroshek.html',
  'адрес страницы «Вишнёвого горошка»');
eq(getProduct('goods-men-17').page, 'product-pages/kofeynyy-pled.html',
  'адрес страницы «Кофейного пледа»');
eq(getProduct('goods-men-18').page, 'product-pages/prazdnichnyy-bant.html',
  'адрес страницы «Праздничного банта»');
eq(getProduct('goods-men-19').page, 'product-pages/alyy-kvadrat.html',
  'адрес страницы «Алого квадрата»');
eq(getProduct('goods-men-20').page, 'product-pages/nochnoy-kontur.html',
  'адрес страницы «Ночного контура»');
eq(getProduct('goods-men-21').page, 'product-pages/smolyanaya-noch.html',
  'адрес страницы «Смоляной ночи»');
eq(getProduct('goods-men-22').page, 'product-pages/morskaya-nit.html',
  'адрес страницы «Морской нити»');
eq(getProduct('goods-men-23').page, 'product-pages/tikhaya-flanel.html',
  'адрес страницы «Тихой фланели»');
eq(getProduct('goods-men-24').page, 'product-pages/nebesnyy-lyon.html',
  'адрес страницы «Небесного льна»');
eq(getProduct('goods-men-25').page, 'product-pages/belaya-klassika-muzhskaya.html',
  'адрес страницы «Белой классики»');
eq(getProduct('goods-men-26').page, 'product-pages/slivovyy-barkhat.html',
  'адрес страницы «Сливового бархата»');
eq(getProduct('goods-men-27').page, 'product-pages/lavandovyy-vecher.html',
  'адрес страницы «Лавандового вечера»');
eq(getProduct('goods-men-28').page, 'product-pages/vinnaya-polnoch.html',
  'адрес страницы «Винной полночи»');
eq(getProduct('goods-men-29').page, 'product-pages/lylovyy-rassvet.html',
  'адрес страницы «Лилового рассвета»');
eq(getProduct('goods-men-30').page, 'product-pages/zimnyaya-kletka.html',
  'адрес страницы «Зимней клетки»');
eq(getProduct('goods-men-31').page, 'product-pages/tikhaya-poloska.html',
  'адрес страницы «Тихой полоски»');
eq(getProduct('goods-men-32').page, 'product-pages/nebesnyy-goroshek.html',
  'адрес страницы «Небесного горошка»');
eq(getProduct('goods-men-33').page, 'product-pages/polnochnyy-uyut.html',
  'адрес страницы «Полночного уюта»');
eq(getProduct('goods-men-34').page, 'product-pages/golubaya-liniya.html',
  'адрес страницы «Голубой линии»');
eq(getProduct('goods-men-35').page, 'product-pages/dymchataya-kletka.html',
  'адрес страницы «Дымчатой клетки»');
eq(getProduct('goods-men-36').page, 'product-pages/severnaya-poloska.html',
  'адрес страницы «Северной полоски»');
eq(getProduct('goods-men-37').page, 'product-pages/utrenniy-svet.html',
  'адрес страницы «Утреннего света»');
eq(getProduct('goods-men-38').page, 'product-pages/buyvolovaya-kletka.html',
  'адрес страницы «Буйволовой клетки»');
eq(getProduct('goods-other-16').page, 'product-pages/lyanyanoy-damask.html',
  'адрес страницы «Льняного дамаска»');

for (const page of withPage) {
  ok(exists(page.page), `файл страницы «${page.title}» на месте`, page.page);
}

/* У каждого адреса из данных есть файл: ссылка не должна вести в пустоту */
const missingPages = withPage
  .filter((product) => !exists(product.page))
  .map((product) => product.page);
eq(missingPages, [], 'у всех товаров с адресом файл страницы существует');

ok(/product\.page \?\? 'product-pages\/'/.test(RENDER),
  'render.js берёт адрес из данных, а без него оставляет заглушку');
ok(/href="\$\{href\}"/.test(RENDER), 'href карточки подставляется переменной');
ok(!/href="product-pages\/"[\s\S]{0,40}data-product-id/.test(RENDER),
  'жёсткой ссылки на папку в шаблоне не осталось');

// ─────────────── каталог принтов ───────────────

ok(/href="\.\.\/prints\.html"/.test(PRODUCT_HTML),
  '«Выбрать из каталога» ведёт на prints.html');
ok(exists('prints.html'), 'страница каталога принтов существует');

/* Новые страницы собираются из того же шаблона, и ссылка на каталог принтов
   должна остаться в них такой же — иначе блок принта поведёт в пустоту */
for (const page of ['product-pages/solntse.html', 'product-pages/russkaya-dusha.html',
  'product-pages/pshenichnoe-pole.html', 'product-pages/rozovye-polya.html',
  'product-pages/temnaya-noch-v.html', 'product-pages/mamino-schaste-vi.html',
  'product-pages/spokoynyy-son-iii.html', 'product-pages/netlennaya-klassika-ii.html',
  'product-pages/siniy-briz.html', 'product-pages/palmovyy-polden.html',
  'product-pages/pudrovoe-utro.html', 'product-pages/lnyanoe-utro.html',
  'product-pages/rozovyy-sad.html', 'product-pages/belaya-klassika.html',
  'product-pages/pionovyy-rassvet.html', 'product-pages/alyy-kokon.html',
  'product-pages/rozovyy-zefir.html', 'product-pages/shalfeynyy-kokon.html',
  'product-pages/zaykiny-sny.html', 'product-pages/rozovaya-zebra.html',
  'product-pages/lazurnyy-plyush.html', 'product-pages/snezhnaya-vyaz.html',
  'product-pages/polyarnyy-mishka.html', 'product-pages/volny-baltiki.html',
  'product-pages/monokhromnyy-sad.html', 'product-pages/nezhnyy-rubchik.html',
  'product-pages/nebesnyy-shelk.html', 'product-pages/kruzhevnaya-nega.html',
  'product-pages/beliy-parus.html', 'product-pages/botanicheskiy-son.html',
  'product-pages/nochnaya-kletka.html', 'product-pages/yagodnaya-kletka.html',
  'product-pages/khvoynaya-kletka.html', 'product-pages/azhurnoe-utro.html',
  'product-pages/snezhnyy-lyon.html', 'product-pages/tonkiy-kant.html',
  'product-pages/uyutnyy-trikotazh.html', 'product-pages/lesnaya-nega.html',
  'product-pages/pudrovyy-sad.html', 'product-pages/rozovyy-fler.html',
  'product-pages/azhurnaya-vual.html', 'product-pages/tropicheskiy-shelk.html',
  'product-pages/beloe-kruzhevo.html', 'product-pages/vishnyovaya-sorochka.html',
  'product-pages/rozovyy-atlas.html', 'product-pages/myagkiy-grafit.html',
  'product-pages/kremovyy-vals.html', 'product-pages/lazurnaya-kletka.html',
  'product-pages/osenniy-pled.html', 'product-pages/snezhnyy-khalat.html',
  'product-pages/tikhoye-serebro.html', 'product-pages/nochnaya-mgla.html',
  'product-pages/akvarelnoe-utro.html', 'product-pages/izumrudnyy-sad.html',
  'product-pages/morskoy-son.html', 'product-pages/kletka-gortsa.html',
  'product-pages/izumrudnaya-poloska.html', 'product-pages/rozovyy-zakat.html',
  'product-pages/lesnoy-goroshek.html', 'product-pages/morskoy-shtrikh.html',
  'product-pages/grafitovyy-son.html', 'product-pages/vishnevyy-goroshek.html',
  'product-pages/kofeynyy-pled.html', 'product-pages/prazdnichnyy-bant.html',
  'product-pages/alyy-kvadrat.html', 'product-pages/nochnoy-kontur.html',
  'product-pages/smolyanaya-noch.html', 'product-pages/morskaya-nit.html',
  'product-pages/tikhaya-flanel.html', 'product-pages/nebesnyy-lyon.html',
  'product-pages/belaya-klassika-muzhskaya.html',
  'product-pages/slivovyy-barkhat.html',
  'product-pages/lavandovyy-vecher.html',
  'product-pages/vinnaya-polnoch.html',
  'product-pages/lylovyy-rassvet.html',
  'product-pages/zimnyaya-kletka.html',
  'product-pages/tikhaya-poloska.html',
  'product-pages/nebesnyy-goroshek.html',
  'product-pages/polnochnyy-uyut.html',
  'product-pages/golubaya-liniya.html',
  'product-pages/dymchataya-kletka.html',
  'product-pages/severnaya-poloska.html',
  'product-pages/utrenniy-svet.html',
  'product-pages/buyvolovaya-kletka.html']) {
  ok(exists(page), `страница ${page} существует`);
  ok(/href="\.\.\/prints\.html"/.test(read(page)),
    `на странице ${page} «Выбрать из каталога» ведёт на prints.html`);
}

// ─────────────── позиция «Свой макет» ───────────────

ok(/export const CUSTOM_PRINT_ID = 'print-custom'/.test(CART),
  'в cart.js есть идентификатор позиции «свой макет»');
ok(CART.includes('CUSTOM_PRINT_ID'), 'cart.js знает эту позицию в toLine/addItem');
ok(/file: typeof line\.file === 'string'/.test(CART),
  'состав позиции хранит имя файла');
ok(/options\.file|file = ''/.test(CART), 'addItem принимает имя файла');

/* Цена неизвестна: позиция не должна попадать в сумму товаров */
ok(/sum: 0/.test(CART), 'у позиции «Свой макет» нулевая сумма');
ok(/Стоимость уточнит менеджер|уточнит стоимость/.test(CART)
  || /уточнит менеджер/.test(RENDER_CART),
  'пометка про менеджера есть в модулях');

ok(RENDER_CART.includes('CUSTOM_PRINT_ID'), 'render-cart.js знает позицию «Свой макет»');
ok(/cart__image--file/.test(RENDER_CART), 'в корзине рисуется плашка с иконкой файла');
ok(/по согласованию/.test(RENDER_CART), 'цена показана как «по согласованию»');
ok(exists('assets/images/icons/icon-file.svg'), 'иконка файла лежит в assets');

const cartCss = read('assets/css/blocks/cart.css');
ok(/\.cart__image--file[\s\S]{0,200}?icon-file\.svg/.test(cartCss),
  'иконка файла подключена в стилях корзины');

// ─────────────── загрузка макета на странице товара ───────────────

ok(/import \{ addItem, CUSTOM_PRINT_ID \} from '\.\/cart\.js'/.test(PRODUCT_JS),
  'product.js кладёт макет в корзину через модуль корзины');
ok(/addItem\(CUSTOM_PRINT_ID, \{ qty: 1, file: name \}\)/.test(PRODUCT_JS),
  'имя файла уезжает в позицию корзины');
ok(/\$\{block\}-icon/.test(PRODUCT_JS),
  'подпись после загрузки собирается с иконкой файла: класс берётся из префикса');
ok(/Макет добавлен в корзину/.test(PRODUCT_JS),
  'подпись говорит, что макет добавлен');
ok(/уточнит менеджер/.test(PRODUCT_JS),
  'подпись предупреждает, что стоимость уточнит менеджер');
ok(/product__print-file--added/.test(read('assets/css/pages/product.css')),
  'у подписи «файл добавлен» есть оформление');

/* Неподходящий формат не должен попадать в корзину: проверка стоит
   до вызова addItem. Загрузка подключена функцией initPrintFileUpload —
   ею пользуются и страница товара, и каталог принтов */
const uploadBody = PRODUCT_JS.slice(PRODUCT_JS.indexOf('export function initPrintFileUpload'));
const addAt = uploadBody.indexOf('addItem(');
const guardAt = uploadBody.indexOf('if (!ok)');
ok(guardAt > 0 && guardAt < addAt, 'неподходящий файл отсекается до добавления',
  `проверка ${guardAt}, добавление ${addAt}`);
ok(/export function initPrintFileUpload/.test(PRODUCT_JS),
  'загрузка макета вынесена в отдельную функцию: её же зовёт каталог принтов');

// ─────────────── картинка в корзине ───────────────

ok(/export function assetUrl/.test(read('assets/js/utils.js')),
  'в utils.js есть построение абсолютного адреса');
ok(/assetUrl\(product\.image\)/.test(RENDER_CART),
  'картинка в корзине строится через assetUrl');
ok(!/src="\$\{product\.image\}"/.test(RENDER_CART),
  'прямого относительного пути к картинке в корзине не осталось');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Карточка «Клубничные поля» → product-pages/klubnichnye-polya.html\n`);
process.stdout.write(`Карточка «Солнце» → product-pages/solntse.html\n`);
process.stdout.write(`Карточка «Русская душа» → product-pages/russkaya-dusha.html\n`);
process.stdout.write(`Карточка «Пшеничное поле» → product-pages/pshenichnoe-pole.html\n`);
process.stdout.write(`Карточка «Розовые поля» → product-pages/rozovye-polya.html\n`);
process.stdout.write(`Карточка «Тёмная ночь V» → product-pages/temnaya-noch-v.html\n`);
process.stdout.write(`Карточка «Мамино счастье VI» → product-pages/mamino-schaste-vi.html\n`);
process.stdout.write(`Карточка «Спокойный сон III» → product-pages/spokoynyy-son-iii.html\n`);
process.stdout.write(`Карточка «Нетленная классика II» → product-pages/netlennaya-klassika-ii.html\n`);
process.stdout.write(`Карточка «Синий бриз» → product-pages/siniy-briz.html\n`);
process.stdout.write(`Карточка «Пальмовый полдень» → product-pages/palmovyy-polden.html\n`);
process.stdout.write(`Карточка «Пудровое утро» → product-pages/pudrovoe-utro.html\n`);
process.stdout.write(`Карточка «Льняное утро» → product-pages/lnyanoe-utro.html\n`);
process.stdout.write(`Карточка «Розовый сад» → product-pages/rozovyy-sad.html\n`);
process.stdout.write(`Карточка «Белая классика» (женская) → product-pages/belaya-klassika.html\n`);
process.stdout.write(`Карточка «Пионовый рассвет» → product-pages/pionovyy-rassvet.html\n`);
process.stdout.write(`Карточка «Алый кокон» → product-pages/alyy-kokon.html\n`);
process.stdout.write(`Карточка «Розовый зефир» → product-pages/rozovyy-zefir.html\n`);
process.stdout.write(`Карточка «Шалфейный кокон» → product-pages/shalfeynyy-kokon.html\n`);
process.stdout.write(`Карточка «Зайкины сны» → product-pages/zaykiny-sny.html\n`);
process.stdout.write(`Карточка «Розовая зебра» → product-pages/rozovaya-zebra.html\n`);
process.stdout.write(`Карточка «Лазурный плюш» → product-pages/lazurnyy-plyush.html\n`);
process.stdout.write(`Карточка «Снежная вязь» → product-pages/snezhnaya-vyaz.html\n`);
process.stdout.write(`Карточка «Полярный мишка» → product-pages/polyarnyy-mishka.html\n`);
process.stdout.write(`Карточка «Волны Балтики» → product-pages/volny-baltiki.html\n`);
process.stdout.write(`Карточка «Монохромный сад» → product-pages/monokhromnyy-sad.html\n`);
process.stdout.write(`Карточка «Нежный рубчик» → product-pages/nezhnyy-rubchik.html\n`);
process.stdout.write(`Карточка «Небесный шёлк» → product-pages/nebesnyy-shelk.html\n`);
process.stdout.write(`Карточка «Кружевная нега» → product-pages/kruzhevnaya-nega.html\n`);
process.stdout.write(`Карточка «Белый парус» → product-pages/beliy-parus.html\n`);
process.stdout.write(`Карточка «Ботанический сон» → product-pages/botanicheskiy-son.html\n`);
process.stdout.write(`Карточка «Ночная клетка» → product-pages/nochnaya-kletka.html\n`);
process.stdout.write(`Карточка «Ягодная клетка» → product-pages/yagodnaya-kletka.html\n`);
process.stdout.write(`Карточка «Хвойная клетка» → product-pages/khvoynaya-kletka.html\n`);
process.stdout.write(`Карточка «Ажурное утро» → product-pages/azhurnoe-utro.html\n`);
process.stdout.write(`Карточка «Снежный лён» → product-pages/snezhnyy-lyon.html\n`);
process.stdout.write(`Карточка «Тонкий кант» → product-pages/tonkiy-kant.html\n`);
process.stdout.write(`Карточка «Уютный трикотаж» → product-pages/uyutnyy-trikotazh.html\n`);
process.stdout.write(`Карточка «Лесная нега» → product-pages/lesnaya-nega.html\n`);
process.stdout.write(`Карточка «Пудровый сад» → product-pages/pudrovyy-sad.html\n`);
process.stdout.write(`Карточка «Розовый флёр» → product-pages/rozovyy-fler.html\n`);
process.stdout.write(`Карточка «Ажурная вуаль» → product-pages/azhurnaya-vual.html\n`);
process.stdout.write(`Карточка «Тропический шёлк» → product-pages/tropicheskiy-shelk.html\n`);
process.stdout.write(`Карточка «Белое кружево» → product-pages/beloe-kruzhevo.html\n`);
process.stdout.write(`Карточка «Вишнёвая сорочка» → product-pages/vishnyovaya-sorochka.html\n`);
process.stdout.write(`Карточка «Розовый атлас» → product-pages/rozovyy-atlas.html\n`);
process.stdout.write(`Карточка «Мягкий графит» → product-pages/myagkiy-grafit.html\n`);
process.stdout.write(`Карточка «Кремовый вальс» → product-pages/kremovyy-vals.html\n`);
process.stdout.write(`Карточка «Лазурная клетка» → product-pages/lazurnaya-kletka.html\n`);
process.stdout.write(`Карточка «Осенний плед» → product-pages/osenniy-pled.html\n`);
process.stdout.write(`Карточка «Снежный халат» → product-pages/snezhnyy-khalat.html\n`);
process.stdout.write(`Карточка «Тихое серебро» → product-pages/tikhoye-serebro.html\n`);
process.stdout.write(`Карточка «Ночная мгла» → product-pages/nochnaya-mgla.html\n`);
process.stdout.write(`Карточка «Акварельное утро» → product-pages/akvarelnoe-utro.html\n`);
process.stdout.write(`Карточка «Изумрудный сад» → product-pages/izumrudnyy-sad.html\n`);
process.stdout.write(`Карточка «Морской сон» → product-pages/morskoy-son.html\n`);
process.stdout.write(`Карточка «Клетка горца» → product-pages/kletka-gortsa.html\n`);
process.stdout.write(`Карточка «Изумрудная полоска» → product-pages/izumrudnaya-poloska.html\n`);
process.stdout.write(`Карточка «Розовый закат» → product-pages/rozovyy-zakat.html\n`);
process.stdout.write(`Карточка «Лесной горошек» → product-pages/lesnoy-goroshek.html\n`);
process.stdout.write(`Карточка «Морской штрих» → product-pages/morskoy-shtrikh.html\n`);
process.stdout.write(`Карточка «Графитовый сон» → product-pages/grafitovyy-son.html\n`);
process.stdout.write(`Карточка «Вишнёвый горошек» → product-pages/vishnevyy-goroshek.html\n`);
process.stdout.write(`Карточка «Кофейный плед» → product-pages/kofeynyy-pled.html\n`);
process.stdout.write(`Карточка «Праздничный бант» → product-pages/prazdnichnyy-bant.html\n`);
process.stdout.write(`Карточка «Алый квадрат» → product-pages/alyy-kvadrat.html\n`);
process.stdout.write(`Карточка «Ночной контур» → product-pages/nochnoy-kontur.html\n`);
process.stdout.write(`Карточка «Смоляная ночь» → product-pages/smolyanaya-noch.html\n`);
process.stdout.write(`Карточка «Морская нить» → product-pages/morskaya-nit.html\n`);
process.stdout.write(`Карточка «Тихая фланель» → product-pages/tikhaya-flanel.html\n`);
process.stdout.write(`Карточка «Небесный лён» → product-pages/nebesnyy-lyon.html\n`);
process.stdout.write(`Карточка «Белая классика» → product-pages/belaya-klassika-muzhskaya.html\n`);
process.stdout.write(`Карточка «Сливовый бархат» → product-pages/slivovyy-barkhat.html\n`);
process.stdout.write(`Карточка «Лавандовый вечер» → product-pages/lavandovyy-vecher.html\n`);
process.stdout.write(`Карточка «Винная полночь» → product-pages/vinnaya-polnoch.html\n`);
process.stdout.write(`Карточка «Лиловый рассвет» → product-pages/lylovyy-rassvet.html\n`);
process.stdout.write(`Карточка «Зимняя клетка» → product-pages/zimnyaya-kletka.html\n`);
process.stdout.write(`Карточка «Тихая полоска» → product-pages/tikhaya-poloska.html\n`);
process.stdout.write(`Карточка «Небесный горошек» → product-pages/nebesnyy-goroshek.html\n`);
process.stdout.write(`Карточка «Полночный уют» → product-pages/polnochnyy-uyut.html\n`);
process.stdout.write(`Карточка «Голубая линия» → product-pages/golubaya-liniya.html\n`);
process.stdout.write(`Карточка «Дымчатая клетка» → product-pages/dymchataya-kletka.html\n`);
process.stdout.write(`Карточка «Северная полоска» → product-pages/severnaya-poloska.html\n`);
process.stdout.write(`Карточка «Утренний свет» → product-pages/utrenniy-svet.html\n`);
process.stdout.write(`Карточка «Буйволовая клетка» → product-pages/buyvolovaya-kletka.html\n`);
process.stdout.write(`Ссылка «Выбрать из каталога» → prints.html\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
