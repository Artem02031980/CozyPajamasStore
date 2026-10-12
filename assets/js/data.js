/**
 * data.js — каталог товаров.
 *
 * Здесь только данные и функции доступа к ним: ни DOM, ни разметки.
 * Отрисовкой занимается render.js, корзиной — cart.js.
 *
 * Цена хранится числом в рублях, а не строкой «9 399 ₽». Причина: число
 * можно складывать в корзине, сравнивать при сортировке и печатать
 * в одном месте (formatPrice в utils.js). Из строки число пришлось бы
 * выковыривать регулярками при каждом действии с корзиной.
 *
 * Названия, состав, цены и размеры картинок перенесены из вёрстки
 * без изменений — каталог должен выглядеть ровно как раньше.
 */

/**
 * @typedef {object} Product
 * @property {string} id          уникальный ключ: goods-<секция>-<номер>
 * @property {string} section     секция: new / women / men / other
 * @property {string} title       название модели
 * @property {string} subtitle    состав: «Брюки + Сорочка»
 * @property {string[]} [types]   типы изделия для фильтра: что входит в комплект.
 *                                Значения совпадают с подписями чипсов в разметке
 * @property {string[]} [ages]    кому подходит: «Для юных дам», «Для девушек»,
 *                                «Для мудрого возраста» — тоже по подписям чипсов
 * @property {string[]} [colors]  цвета для палитры; названия совпадают
 *                                с aria-label кружков в разметке
 * @property {number} price       цена в рублях
 * @property {string} image       путь к фото
 * @property {string} alt         описание фото для скринридера
 * @property {number} width       ширина исходника в px
 * @property {number} height      высота исходника в px
 * @property {string} [titleColor] цвет карточки: 'blue' — если задан.
 *                                В «Новой коллекции» задаёт и цвет названия,
 *                                и цвет кнопки «В корзину» — карточки идут
 *                                парами: розовая с розовой, голубая с голубой
 *
 * Теги фильтров есть только у секций с фильтрами (women и men): в «Новой
 * коллекции» и «Других товарах» фильтров нет, и выдумывать им типы незачем.
 * Значения тегов намеренно совпадают с текстом кнопок в разметке — так
 * фильтр работает по одному совпадению строки, без таблиц перевода.
 */

/** @type {Product[]} */
export const PRODUCTS = [
  /* ------------------------------------------------- Новая коллекция — 6 товаров
     Порядок задан по коллекциям: сначала три женские пижамы, потом три
     мужские. Только так они совпадают с чередованием фона из
     sections/goods-new.css — нечётные позиции розовые, чётные серо-голубые.
     Переставите товар иначе — пижама окажется на чужом фоне; за этим следит
     проверка checks/filters.mjs. */
  {
    id: 'goods-new-01',
    section: 'new',
    title: 'Нежное счастье',
    titleColor: 'pink',
    subtitle: 'Брюки + Сорочка',
    price: 9399,
    image: 'assets/images/products/new/new_01.png',
    alt: 'Белая кружевная сорочка-пеньюар',
    width: 576,
    height: 1160,
  },

  {
    id: 'goods-new-02',
    section: 'new',
    title: 'Ночная свобода',
    titleColor: 'blue',
    subtitle: 'Брюки + Сорочка + Майка',
    price: 5699,
    image: 'assets/images/products/new/new_03.png',
    alt: 'Мужская пижама в розово-серую клетку',
    width: 412,
    height: 1136,
  },

  {
    id: 'goods-new-03',
    section: 'new',
    title: 'Спокойная ночь IV',
    titleColor: 'pink',
    subtitle: 'Пеньюар',
    price: 14199,
    image: 'assets/images/products/new/new_02.png',
    alt: 'Светло-голубая пижама на пожилой женщине',
    width: 414,
    height: 1159,
  },

  {
    id: 'goods-new-04',
    section: 'new',
    title: 'Огонь Прометея',
    titleColor: 'blue',
    subtitle: 'Брюки + Пиджак + Футболка',
    price: 7399,
    image: 'assets/images/products/new/new_04.png',
    alt: 'Мужская пижама с розово-белым мраморным принтом',
    width: 423,
    height: 1154,
  },

  {
    id: 'goods-new-05',
    section: 'new',
    title: 'Розовые перекрестки',
    titleColor: 'pink',
    subtitle: 'Брюки + Халатик',
    price: 4999,
    image: 'assets/images/products/new/new_06.png',
    alt: 'Розовая женская пижама в клетку с поясом',
    width: 386,
    height: 1160,
  },

  {
    id: 'goods-new-06',
    section: 'new',
    title: 'Выгодная философия',
    titleColor: 'blue',
    subtitle: 'Брюки + Рубашка',
    price: 2999,
    image: 'assets/images/products/new/new_05.png',
    alt: 'Мужская пижама в серо-голубую клетку',
    width: 384,
    height: 1140,
  },

  /* ---------------------------------------------- Женская коллекция — 9 товаров */
  {
    id: 'goods-women-01',
    titleColor: 'pink',
    section: 'women',
    title: 'Солнце',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для девушек'],
    colors: ['Жёлтый', 'Белый'],
    price: 7699,
    image: 'assets/images/products/women/w01.png',
    alt: 'Жёлтая полупрозрачная пижама в белый горошек',
    width: 294,
    height: 1034,
  },
  {
    id: 'goods-women-02',
    titleColor: 'pink',
    section: 'women',
    title: 'Русская душа',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для юных дам'],
    colors: ['Белый', 'Синий'],
    price: 3999,
    image: 'assets/images/products/women/w02.png',
    alt: 'Бело-голубая пижама в полоску, рубашка на пуговицах',
    width: 349,
    height: 1135,
  },
  {
    id: 'goods-women-03',
    titleColor: 'pink',
    section: 'women',
    title: 'Клубичные поля',
    subtitle: 'Брюки + Сорочка + Майка',
    types: ['Пижама', 'Брюки', 'Сорочка', 'Майка'],
    ages: ['Для девушек'],
    colors: ['Розовый', 'Красный'],
    price: 12199,
    image: 'assets/images/products/women/w03.png',
    alt: 'Пижама с розовым цветочным принтом и красным поясом',
    width: 385,
    height: 1159,
  },
  {
    id: 'goods-women-04',
    titleColor: 'pink',
    section: 'women',
    title: 'Пшеничное поле',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для девушек'],
    colors: ['Бежевый'],
    price: 6599,
    image: 'assets/images/products/women/w04.png',
    alt: 'Бежевая пижама с мелким принтом, рубашка с планкой',
    width: 365,
    height: 1152,
  },
  {
    id: 'goods-women-05',
    titleColor: 'pink',
    section: 'women',
    title: 'Розовые поля',
    subtitle: 'Брюки + Халатик + Топик',
    types: ['Пижама', 'Брюки', 'Халатик', 'Топ'],
    ages: ['Для девушек'],
    colors: ['Розовый'],
    price: 12999,
    image: 'assets/images/products/women/w05.png',
    alt: 'Розовая полупрозрачная пижама с цветами',
    width: 471,
    height: 1113,
  },
  {
    id: 'goods-women-06',
    titleColor: 'pink',
    section: 'women',
    title: 'Тёмная ночь V',
    subtitle: 'Брюки + Свитшот',
    types: ['Пижама', 'Брюки', 'Свитшот'],
    ages: ['Для юных дам'],
    colors: ['Чёрный'],
    price: 4199,
    image: 'assets/images/products/women/w06.png',
    alt: 'Чёрная пижама: футболка с длинным рукавом и брюки с поясом',
    width: 346,
    height: 1148,
  },
  {
    id: 'goods-women-07',
    titleColor: 'pink',
    section: 'women',
    title: 'Мамино счастье VI',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для мудрого возраста'],
    colors: ['Белый', 'Розовый'],
    price: 2799,
    image: 'assets/images/products/women/w07.png',
    alt: 'Белая пижама с принтом роз и отложным воротником',
    width: 456,
    height: 1428,
  },
  {
    id: 'goods-women-08',
    titleColor: 'pink',
    section: 'women',
    title: 'Спокойный сон III',
    subtitle: 'Брюки + Халатик',
    types: ['Пижама', 'Брюки', 'Халатик'],
    ages: ['Для юных дам'],
    colors: ['Розовый', 'Белый'],
    price: 6999,
    image: 'assets/images/products/women/w08.png',
    alt: 'Розовая атласная пижама в белый горошек, бант на кармане',
    width: 623,
    height: 1403,
  },
  {
    id: 'goods-women-09',
    titleColor: 'pink',
    section: 'women',
    title: 'Нетленная классика II',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для девушек'],
    colors: ['Белый', 'Розовый'],
    price: 4599,
    image: 'assets/images/products/women/w09.png',
    alt: 'Бело-розовая пижама в клетку, рубашка с карманом',
    width: 343,
    height: 1112,
  },

  /* ----------------------------------------------- Мужская коллекция — 9 товаров */
  {
    id: 'goods-men-01',
    titleColor: 'blue',
    section: 'men',
    title: 'Мятный вечер',
    subtitle: 'Брюки + Сорочка + Майка',
    types: ['Пижама', 'Брюки', 'Сорочка', 'Майка'],
    ages: ['Для молодых людей'],
    colors: ['Синий', 'Белый', 'Мятный'],
    price: 5499,
    image: 'assets/images/products/men/01.png',
    alt: 'Мужская пижама в мятно-голубую клетку с белой майкой',
    width: 303,
    height: 953,
  },
  {
    id: 'goods-men-02',
    titleColor: 'blue',
    section: 'men',
    title: 'Синий туман',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для мудрого возраста'],
    colors: ['Синий', 'Белый'],
    price: 4999,
    image: 'assets/images/products/men/02.png',
    alt: 'Мужская пижама в синюю клетку с белым поясом',
    width: 303,
    height: 955,
  },
  {
    id: 'goods-men-03',
    titleColor: 'blue',
    section: 'men',
    title: 'Тёплая клетка',
    subtitle: 'Брюки + Сорочка + Майка',
    types: ['Пижама', 'Брюки', 'Сорочка', 'Майка'],
    ages: ['Для мудрого возраста'],
    colors: ['Бежевый', 'Белый'],
    price: 6599,
    image: 'assets/images/products/men/03.png',
    alt: 'Мужская пижама в коричневую клетку с белой майкой',
    width: 378,
    height: 1128,
  },
  {
    id: 'goods-men-04',
    titleColor: 'blue',
    section: 'men',
    title: 'Белый халат',
    subtitle: 'Брюки + Халат',
    types: ['Пижама', 'Брюки', 'Халатик'],
    ages: ['Для молодых людей'],
    colors: ['Белый'],
    price: 8999,
    image: 'assets/images/products/men/04.png',
    alt: 'Белый мужской халат с поясом и брюки',
    width: 351,
    height: 1129,
  },
  {
    id: 'goods-men-05',
    titleColor: 'blue',
    section: 'men',
    title: 'Морская дымка',
    subtitle: 'Брюки + Рубашка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для мужчин'],
    colors: ['Серый', 'Синий'],
    price: 5699,
    image: 'assets/images/products/men/05.png',
    alt: 'Серо-голубая мужская пижама с рубашкой на пуговицах',
    width: 403,
    height: 1145,
  },
  {
    id: 'goods-men-06',
    titleColor: 'blue',
    section: 'men',
    title: 'Полночный силуэт',
    subtitle: 'Брюки + Рубашка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для мужчин'],
    colors: ['Чёрный'],
    price: 7999,
    image: 'assets/images/products/men/06.png',
    alt: 'Чёрная мужская пижама: рубашка с длинным рукавом и брюки',
    width: 361,
    height: 1116,
  },
  {
    id: 'goods-men-07',
    titleColor: 'blue',
    section: 'men',
    title: 'Облачный халат',
    subtitle: 'Брюки + Халат',
    types: ['Пижама', 'Брюки', 'Халатик'],
    ages: ['Для молодых людей'],
    colors: ['Синий'],
    price: 6799,
    image: 'assets/images/products/men/07.png',
    alt: 'Светло-голубой мужской халат с принтом и брюки',
    width: 446,
    height: 1111,
  },
  {
    id: 'goods-men-08',
    titleColor: 'blue',
    section: 'men',
    title: 'Изумрудный вечер',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для мудрого возраста'],
    colors: ['Зелёный'],
    price: 7299,
    image: 'assets/images/products/men/08.png',
    alt: 'Изумрудная мужская пижама с рубашкой и карманом',
    width: 375,
    height: 1175,
  },
  {
    id: 'goods-men-09',
    titleColor: 'blue',
    section: 'men',
    title: 'Голубая классика',
    subtitle: 'Брюки + Сорочка',
    types: ['Пижама', 'Брюки', 'Сорочка'],
    ages: ['Для мудрого возраста'],
    colors: ['Синий'],
    price: 8199,
    image: 'assets/images/products/men/09.png',
    alt: 'Голубая мужская пижама с отложным воротником и карманом',
    width: 518,
    height: 1693,
  },

  /* --------------------------------------------------- Другие товары — 4 товара */
  {
    id: 'goods-other-01',
    section: 'other',
    title: 'Тёплый вечер',
    subtitle: 'Плед',
    price: 2499,
    image: 'assets/images/products/other/01.png',
    alt: 'Бежевый вязаный плед, сложенный в несколько раз',
    width: 1024,
    height: 1024,
  },
  {
    id: 'goods-other-02',
    section: 'other',
    title: 'Солнечный акцент',
    subtitle: 'Подушка',
    price: 1799,
    image: 'assets/images/products/other/02.png',
    alt: 'Жёлто-горчичная декоративная подушка с ромбовидным узором',
    width: 1024,
    height: 1024,
  },
  {
    id: 'goods-other-03',
    section: 'other',
    title: 'Нежная вафелька',
    subtitle: 'Подушка',
    price: 1999,
    image: 'assets/images/products/other/03.png',
    alt: 'Бежевая подушка из рубчатого вельвета с перекрещенными шнурами',
    width: 1024,
    height: 1024,
  },
  {
    id: 'goods-other-04',
    section: 'other',
    title: 'Мишка для объятий',
    subtitle: 'Мягкая игрушка',
    price: 2299,
    image: 'assets/images/products/other/04.png',
    alt: 'Мягкая игрушка медвежонок бежево-голубой с бантом в полоску',
    width: 1024,
    height: 1024,
  },
];

/** Секции в том порядке, в каком они идут на странице. */
export const SECTIONS = ['new', 'women', 'men', 'other'];

/**
 * Товары одной секции — в том порядке, в каком они в каталоге.
 * @param {string} section
 * @returns {Product[]}
 */
export function getProducts(section) {
  return PRODUCTS.filter((product) => product.section === section);
}

/**
 * Товар по идентификатору.
 * @param {string} id
 * @returns {Product|undefined}
 */
export function getProduct(id) {
  return PRODUCTS.find((product) => product.id === id);
}

/**
 * Сколько всего товаров в каталоге.
 * @returns {number}
 */
export function getProductsCount() {
  return PRODUCTS.length;
}
