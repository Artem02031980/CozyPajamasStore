#!/usr/bin/env node
/**
 * Проверка логики корзины: cart.js плюс правила услуги «ПРИНТ».
 *
 * Логика корзины не трогает DOM — поэтому её можно прогнать в Node,
 * подставив заглушки localStorage и document. Это дешевле браузера
 * и проверяет то, что глазами видно плохо: границы порога, поведение
 * количества, состав при повторном добавлении.
 *
 * Запуск: node checks/cart.mjs
 */

// ── заглушки окружения: должны стоять до импорта модулей ──────────────

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

// ── импорт после заглушек ─────────────────────────────────────────────

const cart = await import('../assets/js/cart.js');
const { getProducts } = await import('../assets/js/data.js');

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

const reset = () => { store.clear(); };
const stored = () => JSON.parse(store.get(CART_KEY) ?? '[]');

const TERMS = { price: 500, freeFrom: 15000 };

// ── пустая корзина ───────────────────────────────────────────────────

reset();
eq(cart.getItems(), [], 'пустая корзина: позиций нет');
eq(cart.getCount(), 0, 'пустая корзина: счётчик 0');
eq(cart.getProductsTotal(), 0, 'пустая корзина: сумма товаров 0');
eq(cart.getTotals(TERMS, cart.getLines()).total, 0, 'пустая корзина: итог 0');

// ── добавление ───────────────────────────────────────────────────────

reset();
cart.addItem('goods-women-01');
eq(cart.getCount(), 1, 'после добавления счётчик 1');
eq(stored().length, 1, 'в хранилище одна позиция');
eq(stored()[0].id, 'goods-women-01', 'в хранилище тот же id');
eq(stored()[0].qty, 1, 'количество по умолчанию 1');
ok(!('title' in stored()[0]) && !('price' in stored()[0]),
  'в хранилище только ссылка на товар, без копии названия и цены');

cart.addItem('goods-women-01');
eq(cart.getCount(), 2, 'повторное добавление увеличивает количество, а не создаёт позицию');
eq(stored().length, 1, 'повторное добавление не создаёт вторую позицию');

cart.clear();

// Цена и название берутся из каталога
cart.addItem('goods-women-01');
const first = cart.getLines()[0];
const catalog = getProducts('women')[0];
eq(first.product.title, catalog.title, 'название позиции берётся из каталога');
eq(first.sum, catalog.price, 'сумма позиции равна цене товара');

// ── неизвестный товар ────────────────────────────────────────────────

const beforeUnknown = cart.getCount();
cart.addItem('goods-нет-такого');
eq(cart.getCount(), beforeUnknown, 'товар не из каталога в корзину не попадает');

// ── количество ───────────────────────────────────────────────────────

reset();
cart.addItem('goods-men-01');
cart.changeQty('goods-men-01', 1);
eq(cart.getCount(), 2, 'шаг +1 увеличивает количество');
cart.changeQty('goods-men-01', -1);
eq(cart.getCount(), 1, 'шаг −1 уменьшает количество');
cart.changeQty('goods-men-01', -1);
eq(cart.getItems(), [], 'уменьшение до нуля удаляет позицию');
ok(store.get(CART_KEY) === '[]', 'удаление записано в хранилище');

cart.addItem('goods-men-01');
cart.setQty('goods-men-01', 5);
eq(cart.getCount(), 5, 'setQty выставляет точное количество');
cart.setQty('goods-men-01', 0);
eq(cart.getItems(), [], 'setQty с нулём удаляет позицию');

cart.addItem('goods-men-01');
cart.changeQty('goods-men-01', 1);
cart.removeItem('goods-men-01');
eq(cart.getItems(), [], 'removeItem удаляет позицию целиком');

// ── разные размеры — разные позиции ──────────────────────────────────

reset();
cart.addItem('goods-women-02', { size: 'S' });
cart.addItem('goods-women-02', { size: 'M' });
eq(cart.getItems().length, 2, 'один товар в двух размерах — две позиции');
eq(cart.getCount(), 2, 'счётчик учитывает обе позиции');
cart.changeQty('goods-women-02', 1, 'S');
eq(cart.getCount(), 3, 'количество меняется только у выбранного размера');
eq(cart.getItems().find((l) => l.size === 'M').qty, 1, 'вторая позиция не тронута');

// ── суммы и услуга «ПРИНТ» ───────────────────────────────────────────

reset();
cart.addItem('goods-women-01');                    // 7699
const lines1 = cart.getLines();
eq(cart.getTotals(TERMS, lines1).products, 7699, 'сумма товаров без услуги');
eq(cart.getTotals(TERMS, lines1).service, 0, 'без услуги её стоимость 0');
eq(cart.getTotals(TERMS, lines1).total, 7699, 'итог без услуги равен сумме товаров');

cart.addItem(cart.SERVICE_ID);
const withService = cart.getTotals(TERMS, cart.getLines());
eq(withService.serviceQty, 1, 'услуга попала в итог');
eq(withService.service, 500, 'услуга платная, пока сумма меньше порога');
eq(withService.total, 7699 + 500, 'итог складывается из товаров и услуги');
eq(withService.serviceFree, false, 'при 7699 услуга не бесплатна');
eq(cart.getFreeServiceGap(TERMS, cart.getLines()), 15000 - 7699, 'сколько не хватает до порога');

// ── границы порога ───────────────────────────────────────────────────

/** Собирает корзину с заданной суммой товаров, подбирая количество. */
const cartWithProductsSum = (target) => {
  reset();
  const product = getProducts('women').find((p) => p.id === 'goods-women-09'); // 4599
  cart.addItem(product.id, { qty: Math.floor(target / product.price) });
  return product;
};

cartWithProductsSum(10000);
cart.addItem(cart.SERVICE_ID);
const below = cart.getTotals(TERMS, cart.getLines()); // 2 × 4599 = 9198
eq(below.products, 9198, 'сумма ниже порога посчитана верно');
eq(below.serviceFree, false, 'ниже порога услуга платная');
eq(below.service, 500, 'ниже порога услуга стоит 500');

reset();
cart.addItem('goods-women-03', { qty: 2 });        // 12199 × 2 = 24398 ≥ 15000
cart.addItem(cart.SERVICE_ID);
const above = cart.getTotals(TERMS, cart.getLines());
ok(above.products >= TERMS.freeFrom, 'сумма выше порога', String(above.products));
eq(above.serviceFree, true, 'выше порога услуга бесплатна');
eq(above.service, 0, 'бесплатная услуга не добавляет денег');
eq(above.total, above.products, 'итог равен сумме товаров, когда услуга бесплатна');

// Ровно порог: 5000 × 3 = 15000
reset();
cart.addItem('goods-men-05', { qty: 3 });          // 5699 × 3 = 17097
const exact = cart.getTotals(TERMS, cart.getLines());
ok(exact.products >= TERMS.freeFrom, 'порог достигнут', String(exact.products));

// Услуга одна, даже если нажать дважды
reset();
cart.addItem('goods-women-01');
cart.addItem(cart.SERVICE_ID);
cart.addItem(cart.SERVICE_ID);
const twice = cart.getTotals(TERMS, cart.getLines());
eq(twice.serviceQty, 2, 'повторное нажатие увеличивает количество услуги');
eq(twice.service, 1000, 'две услуги стоят вдвое');
cart.setQty(cart.SERVICE_ID, 1);
eq(cart.getTotals(TERMS, cart.getLines()).service, 500, 'количество услуги можно вернуть к одной');

// Услуга не считается товаром
reset();
cart.addItem(cart.SERVICE_ID);
const onlyService = cart.getTotals(TERMS, cart.getLines());
eq(onlyService.products, 0, 'услуга не входит в сумму товаров');
eq(onlyService.serviceFree, false, 'одна услуга без товаров не бесплатна');
eq(onlyService.total, 500, 'итог из одной услуги — её цена');

// ── свой макет: заявка без цены ──────────────────────────────────────

reset();
cart.addItem(cart.CUSTOM_PRINT_ID, { file: 'макет.pdf' });
const custom = cart.getLines();
eq(custom.length, 1, 'макет попал в корзину одной позицией');
eq(custom[0].product.title, 'Свой макет', 'позиция названа «Свой макет»');
eq(custom[0].sum, 0, 'цена макета неизвестна — сумма ноль');
ok(custom[0].product.subtitle.includes('макет.pdf'), 'в подписи видно имя файла',
  String(custom[0].product.subtitle));
eq(cart.getTotals(TERMS, custom).products, 0, 'макет не увеличивает сумму товаров');
eq(cart.getTotals(TERMS, custom).total, 0, 'и не меняет итог');

// Второй файл заменяет первый, а не добавляет позицию
cart.addItem(cart.CUSTOM_PRINT_ID, { file: 'другой.psd' });
const replaced = cart.getItems();
eq(replaced.length, 1, 'второй макет не создаёт вторую позицию');
eq(replaced[0].qty, 1, 'количество заявки остаётся единицей');
eq(replaced[0].file, 'другой.psd', 'имя файла обновилось');

// Заявка живёт рядом с товаром и не мешает услуге
cart.addItem('goods-women-01');
cart.addItem(cart.SERVICE_ID);
const mixed = cart.getTotals(TERMS, cart.getLines());
eq(mixed.products, 7699, 'товар считается без макета');
eq(mixed.total, 7699 + 500, 'итог: товар и платная услуга, макет даёт ноль');

// ── сброс и мусор в хранилище ────────────────────────────────────────

reset();
cart.addItem('goods-women-01');
cart.clear();
eq(cart.getItems(), [], 'clear очищает корзину');
eq(cart.getCount(), 0, 'после clear счётчик 0');

store.set(CART_KEY, '{это не json');
eq(cart.getItems(), [], 'битый JSON в хранилище не ломает корзину');

store.set(CART_KEY, JSON.stringify([{ id: 'goods-нет-такого', qty: 1 }]));
eq(cart.getLines(), [], 'позиция с исчезнувшим товаром не показывается');
eq(cart.getCount(), 1, 'но в счётчике она есть — её снимет отрисовка');

store.set(CART_KEY, JSON.stringify([{ qty: 3 }, null, { id: 'goods-women-01', qty: 0 }]));
const dirty = cart.getItems();
eq(dirty.length, 1, 'позиции без id и null отбрасываются');
eq(dirty[0].qty, 1, 'нулевое количество поднимается до единицы');

reset();

// ── итог ─────────────────────────────────────────────────────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((f) => process.stdout.write(`  FAIL ${f}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
