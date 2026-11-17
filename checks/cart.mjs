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

// ── принты из каталога: та же услуга, своя строка ────────────────────

/* Принт — это нанесение, а не товар: он не входит в сумму товаров,
   иначе сам приближал бы порог бесплатной печати. Когда товаров хватает,
   печать бесплатна — и в позиции, и в итоге */

reset();
cart.addItem('print-01');                     // принт, 500 ₽
cart.addItem('goods-men-04');                 // 8999
const printBelow = cart.getTotals(TERMS, cart.getLines());
eq(printBelow.products, 8999, 'принт не входит в сумму товаров');
eq(printBelow.printQty, 1, 'принт посчитан отдельно');
eq(printBelow.prints, 500, 'ниже порога печать стоит 500');
eq(printBelow.printsFree, false, 'ниже порога печать платная');
eq(printBelow.total, 9499, 'итог: товар и платная печать');

reset();
cart.addItem('print-01');
cart.addItem('goods-men-04');
cart.addItem('goods-men-07');                 // 8999 + 7299 = 16298 ≥ 15000
const printAbove = cart.getTotals(TERMS, cart.getLines());
ok(printAbove.products >= TERMS.freeFrom, 'товаров выше порога', String(printAbove.products));
eq(printAbove.products, 16298, 'принт не увеличивает сумму товаров');
eq(printAbove.printsFree, true, 'выше порога печать бесплатна');
eq(printAbove.prints, 0, 'бесплатная печать не добавляет денег');
eq(printAbove.total, 16298, 'итог равен сумме товаров');

/* Несколько принтов считаются по количеству, а не по числу позиций */
reset();
cart.addItem('print-01');
cart.addItem('print-02', { qty: 2 });
const manyPrints = cart.getTotals(TERMS, cart.getLines());
eq(manyPrints.printQty, 3, 'количество принтов складывается');
eq(manyPrints.prints, 1500, 'три принта по 500');
eq(manyPrints.total, 1500, 'итог из одних принтов');

/* Свой макет денег не добавляет и порог не приближает */
reset();
cart.addItem(cart.CUSTOM_PRINT_ID, { file: 'макет.pdf' });
cart.addItem('print-01');
const customAndPrint = cart.getTotals(TERMS, cart.getLines());
eq(customAndPrint.products, 0, 'макет и принт не дают суммы товаров');
eq(customAndPrint.printQty, 1, 'макет не считается принтом с ценой');
eq(customAndPrint.prints, 500, 'платная печать считается только у принта');
eq(customAndPrint.total, 500, 'макет в итог не входит');

// ── один бесплатный принт за каждые 15 000 ₽ ─────────────────────────

/* Правило маркетинга: бесплатных принтов столько, сколько раз порог
   уложился в сумму товаров. Два принта — только от 30 000, три — от 45 000.
   Суммы товаров заданы снимками позиций: так проверка не зависит от цен
   каталога и проверяет ровно арифметику правила */

const сКорзиной = (goodsSum, prints) => cart.getTotals(TERMS, [
  { id: 'goods-men-04', qty: 1, size: 'XXL', sum: goodsSum },
  ...prints.map(([id, qty]) => ({ id, qty, size: '', sum: qty * 500 })),
]);

reset();
eq(сКорзиной(0, []).freePrints, 0, 'пустая корзина: бесплатных принтов нет');

const ниже = сКорзиной(8999, [['print-03', 18]]);
eq(ниже.freePrints, 0, 'товаров меньше порога — бесплатных нет');
eq(ниже.paidPrints, 18, 'все 18 принтов платные');
eq(ниже.prints, 9000, '18 принтов по 500');
eq(ниже.printsFree, false, 'печать не бесплатна');

const один = сКорзиной(24697, [['print-03', 18]]);
eq(один.products, 24697, 'товары без принтов');
eq(один.freePrints, 1, 'при 24 697 бесплатен один принт');
eq(один.paidPrints, 17, 'остальные 17 платные');
eq(один.prints, 8500, '17 принтов по 500');
eq(один.total, 24697 + 8500, 'итог: товары и платная печать');
eq(cart.getFreeServiceGap(TERMS, [
  { id: 'goods-men-04', qty: 1, size: 'XXL', sum: 24697 },
  { id: 'print-03', qty: 18, size: '', sum: 9000 },
]), 30000 - 24697, 'до следующего бесплатного — до 30 000');

const два = сКорзиной(30000, [['print-03', 2]]);
eq(два.freePrints, 2, 'на 30 000 товаров — два бесплатных');
eq(два.paidPrints, 0, 'два принта при 30 000 бесплатны');
eq(два.prints, 0, 'печать не добавляет денег');
eq(два.total, 30000, 'итог равен сумме товаров');

const три = сКорзиной(45000, [['print-01', 4]]);
eq(три.freePrints, 3, 'на 45 000 товаров — три бесплатных');
eq(три.paidPrints, 1, 'четвёртый платный');
eq(три.prints, 500, 'за четвёртый принт платят 500');

/* Бесплатные раздаются по порядку позиций: цена видна по позиции */
reset();
const поПорядку = cart.getTotals(TERMS, [
  { id: 'goods-men-04', qty: 1, size: 'XXL', sum: 15000 },
  { id: 'print-01', qty: 1, size: '', sum: 500 },
  { id: 'print-02', qty: 2, size: '', sum: 1000 },
]);
eq(поПорядку.printLines[cart.lineKey({ id: 'print-01', size: '' })],
  { free: 1, paid: 0, cost: 0 }, 'первый принт бесплатен целиком');
eq(поПорядку.printLines[cart.lineKey({ id: 'print-02', size: '' })],
  { free: 0, paid: 2, cost: 1000 }, 'второй принт платный');

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
