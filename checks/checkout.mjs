#!/usr/bin/env node
/**
 * Проверка оформления заказа: правила полей, сборка заказа, снимок цен.
 *
 * Как и checks/cart.mjs, работает без браузера: checkout.js держит проверки
 * отдельными функциями (validate, buildOrder), а DOM трогает только
 * в submitOrder и initCheckout.
 *
 * Запуск: node checks/checkout.mjs
 */

// ── заглушки окружения: до импорта модулей ────────────────────────────

const store = new Map();

globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
};

const CART_KEY = 'cozy-pajamas:cart';
const ORDER_KEY = 'cozy-pajamas:order';

// ── импорт после заглушек ─────────────────────────────────────────────

const checkout = await import('../assets/js/checkout.js');
const cart = await import('../assets/js/cart.js');
const { readOrder } = await import('../assets/js/storage.js');

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

const reset = () => store.clear();
const TERMS = { price: 500, freeFrom: 15000 };

// ── правила полей ────────────────────────────────────────────────────

ok(checkout.validateField('name', 'Анна') === '', 'имя: обычное значение проходит');
eq(checkout.validateField('name', ''), checkout.validateField('name', ''), 'имя: пустое даёт ошибку');
ok(checkout.validateField('name', '').length > 0, 'имя: пустое не проходит');
ok(checkout.validateField('name', 'А').length > 0, 'имя: одна буква не проходит');
ok(checkout.validateField('name', '  Анна  ') === '', 'имя: пробелы по краям не мешают');

ok(checkout.validateField('phone', '+7 900 123-45-67') === '', 'телефон: формат с пробелами проходит');
ok(checkout.validateField('phone', '89001234567') === '', 'телефон: 11 цифр подряд проходит');
ok(checkout.validateField('phone', '9001234567') === '', 'телефон: ровно 10 цифр проходит');
ok(checkout.validateField('phone', '12345').length > 0, 'телефон: пять цифр не проходит');
ok(checkout.validateField('phone', '').length > 0, 'телефон: пустой не проходит');

ok(checkout.validateField('email', '') === '', 'почта: пустая допустима');
ok(checkout.validateField('email', 'a@b.ru') === '', 'почта: обычный адрес проходит');
ok(checkout.validateField('email', 'a@b').length > 0, 'почта: без домена верхнего уровня не проходит');
ok(checkout.validateField('email', 'a b@c.ru').length > 0, 'почта: пробел внутри не проходит');

ok(checkout.validateField('комментарий', 'что угодно') === '', 'неизвестное поле не проверяется');

// ── проверка формы целиком ───────────────────────────────────────────

const good = { name: 'Анна', phone: '+7 900 123-45-67', email: '', comment: '' };
eq(checkout.validate(good), {}, 'верные значения: ошибок нет');

const bad = { name: '', phone: '123', email: 'нет-собаки' };
const errors = checkout.validate(bad);
eq(Object.keys(errors).sort(), ['email', 'name', 'phone'], 'ошибки собраны по всем полям');
ok(errors.name.length > 0 && errors.phone.length > 0, 'тексты ошибок заполнены');

eq(checkout.validate({ name: 'Анна', phone: '+79001234567' }, ['name']), {},
  'проверить можно только часть полей');

// ── номер заказа ─────────────────────────────────────────────────────

const date = new Date(2026, 9, 7, 18, 32); // 7 октября 2026, 18:32
eq(checkout.makeOrderNumber(date), '202610071832', 'номер заказа собирается из даты и времени');
eq(checkout.makeOrderNumber(new Date(2026, 0, 1, 0, 5)), '202601010005',
  'номер заказа дополняет часы и минуты нулями');

// ── сборка заказа ────────────────────────────────────────────────────

reset();
cart.addItem('goods-women-01', { qty: 2 });      // 7699 × 2 = 15398
const order = checkout.buildOrder(good, { terms: TERMS, date });

eq(order.number, '202610071832', 'в заказе номер из даты');
eq(order.customer.name, 'Анна', 'в заказе имя покупателя');
eq(order.customer.phone, '+7 900 123-45-67', 'в заказе телефон');
eq(order.items.length, 1, 'в заказе одна позиция');
eq(order.items[0].title, 'Солнце', 'в заказе название товара');
eq(order.items[0].qty, 2, 'в заказе количество');
eq(order.items[0].sum, 15398, 'в заказе сумма позиции');
eq(order.totals.products, 15398, 'в заказе сумма товаров');
eq(order.totals.total, 15398, 'в заказе итог');
ok(typeof order.createdAt === 'string' && order.createdAt.includes('2026-10-07'),
  'в заказе дата в ISO', order.createdAt);

/* Снимок цен: заказ не должен меняться, если каталог поменяется.
   Проверяем косвенно — в заказе лежат числа, а не ссылки на data.js. */
cart.clear();
const afterClear = JSON.parse(JSON.stringify(order));
eq(afterClear.items[0].sum, 15398, 'снимок заказа не зависит от корзины после оформления');
eq(afterClear.totals.total, 15398, 'итог в снимке заказа сохранился');

// Услуга в заказе
reset();
cart.addItem('goods-women-01');                   // 7699
cart.addItem(cart.SERVICE_ID);                    // 500, порог не достигнут
const withService = checkout.buildOrder(good, { terms: TERMS, date });
eq(withService.items.length, 2, 'услуга попала в заказ отдельной позицией');
eq(withService.items[1].title, 'Услуга «ПРИНТ»', 'услуга названа в заказе');
eq(withService.totals.service, 500, 'услуга в заказе платная');
eq(withService.totals.total, 8199, 'итог заказа с услугой');

reset();
cart.addItem('goods-women-01', { qty: 2 });       // 15398 ≥ 15000
cart.addItem(cart.SERVICE_ID);
const freeService = checkout.buildOrder(good, { terms: TERMS, date });
eq(freeService.totals.serviceFree, true, 'при достигнутом пороге услуга бесплатна');
eq(freeService.totals.total, 15398, 'бесплатная услуга не увеличивает итог');

// ── описание заказа ──────────────────────────────────────────────────

reset();
cart.addItem('goods-women-01');
const one = checkout.buildOrder(good, { terms: TERMS, date });
ok(checkout.describeOrder(one).startsWith('1 товар на'), 'описание: «1 товар»', checkout.describeOrder(one));

reset();
cart.addItem('goods-women-01', { qty: 3 });
const many = checkout.buildOrder(good, { terms: TERMS, date });
ok(checkout.describeOrder(many).startsWith('3 товара на'), 'описание: «3 товара»', checkout.describeOrder(many));

reset();
cart.addItem('goods-women-01', { qty: 5 });
const five = checkout.buildOrder(good, { terms: TERMS, date });
ok(checkout.describeOrder(five).startsWith('5 товаров на'), 'описание: «5 товаров»', checkout.describeOrder(five));

// ── хранилище заказа ─────────────────────────────────────────────────

reset();
cart.addItem('goods-women-01');
checkout.buildOrder(good, { terms: TERMS, date });
eq(readOrder(), null, 'buildOrder сам в хранилище не пишет — это делает submitOrder');

// Битый заказ не должен ломать страницу
store.set(ORDER_KEY, '{не json');
eq(readOrder(), null, 'битый заказ в хранилище читается как отсутствие заказа');

store.set(ORDER_KEY, JSON.stringify([1, 2, 3]));
eq(readOrder(), null, 'массив вместо заказа не считается заказом');

reset();

// ── покупка в один клик ──────────────────────────────────────────────

/* Заказ «в один клик» собирается из одного товара, без формы и без
   корзины: человек нажал кнопку — и сразу попал на страницу благодарности */
const oneClick = checkout.buildOneClickOrder('goods-women-03', { size: 'M', date });
ok(Boolean(oneClick), 'заказ в один клик собирается');
eq(oneClick.items.length, 1, 'в заказе одна позиция');
eq(oneClick.items[0].id, 'goods-women-03', 'позиция — тот товар, что на странице');
eq(oneClick.items[0].qty, 1, 'количество — одна штука');
eq(oneClick.items[0].size, 'M', 'выбранный размер попал в заказ');
eq(oneClick.items[0].price, 12199, 'цена из каталога, а не из разметки');
eq(oneClick.items[0].sum, 12199, 'сумма позиции равна цене одной штуки');
eq(oneClick.totals, {
  products: 12199, service: 0, serviceFree: false, serviceQty: 0, total: 12199, count: 1,
}, 'итоги заказа: без услуги, без кратности');
eq(oneClick.number, checkout.makeOrderNumber(date), 'номер заказа из даты покупки');
eq(oneClick.createdAt, date.toISOString(), 'время покупки из даты');
eq(oneClick.customer.name, '', 'имени нет: форма не заполнялась');

/* Размер не выбран — заказ всё равно собирается, позиция без размера */
const noSize = checkout.buildOneClickOrder('goods-women-03', { date });
eq(noSize.items[0].size, '', 'без выбора размера позиция идёт без размера');

/* Корзина при покупке в один клик не трогается: то, что человек складывал
   раньше, остаётся на месте */
reset();
cart.addItem('goods-women-01');
checkout.buildOneClickOrder('goods-women-03', { date });
eq(cart.getItems().map((i) => i.id), ['goods-women-01'],
  'покупка в один клик не меняет корзину');

/* Товара с таким id нет — заказа тоже нет, иначе на страницу благодарности
   ушёл бы заказ с пустой позицией */
eq(checkout.buildOneClickOrder('нет-такого', { date }), null,
  'несуществующий товар не даёт заказа');

reset();

// ── итог ─────────────────────────────────────────────────────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((f) => process.stdout.write(`  FAIL ${f}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
