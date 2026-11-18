#!/usr/bin/env node
/**
 * Проверка разметки корзины: render-cart.js без браузера.
 *
 * Функции разметки — чистые шаблонные строки, поэтому их можно прогнать
 * в Node с заглушкой localStorage и посмотреть на результат как на текст.
 * Здесь проверяется то, что не видно в логике:
 *
 *   — данные, пришедшие от пользователя или из хранилища (имя загруженного
 *     файла, снимок заказа), попадают в разметку экранированными;
 *   — у «Своего макета» нет кнопок количества: заявка одна;
 *   — у обычного товара кнопки количества на месте;
 *   — строка печати в итогах считает бесплатные и платные принты.
 *
 * Запуск: node checks/render-cart.mjs
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

// ── импорт после заглушек ─────────────────────────────────────────────

const cart = await import('../assets/js/cart.js');
const { renderCartItem, renderCartSummary, renderOrderLines } = await import('../assets/js/render-cart.js');
const { escapeHtml } = await import('../assets/js/utils.js');

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(`${name}${detail ? ' -> ' + detail : ''}`);
};

const eq = (actual, expected, name) => {
  ok(JSON.stringify(actual) === JSON.stringify(expected), name,
    `получено ${JSON.stringify(actual)}, ожидалось ${JSON.stringify(expected)}`);
};

const TERMS = { price: 500, freeFrom: 15000 };
const reset = () => store.clear();

// ── экранирование ────────────────────────────────────────────────────

eq(escapeHtml('<b>&"\'>'), '&lt;b&gt;&amp;&quot;&#39;&gt;', 'экранируются все пять опасных символов');
eq(escapeHtml(''), '', 'пустая строка остаётся пустой');
eq(escapeHtml(null), '', 'null даёт пустую строку');
eq(escapeHtml('макет.pdf'), 'макет.pdf', 'обычное имя файла не меняется');

// ── свой макет: нет кнопок количества, имя файла экранировано ────────

reset();
const ОПАСНОЕ_ИМЯ = '<img src=x onerror=alert(1)>.pdf';
cart.addItem(cart.CUSTOM_PRINT_ID, { file: ОПАСНОЕ_ИМЯ });
const customLine = cart.getLines()[0];
const customHtml = renderCartItem(customLine);

ok(!customHtml.includes('<img src=x'), 'имя файла не превращается в тег');
ok(customHtml.includes('&lt;img src=x'), 'имя файла видно как текст');
ok(!customHtml.includes('class="quantity"'), 'у своего макета нет кнопок количества');
ok(!customHtml.includes('data-cart-step'), 'и нет шагов количества');
ok(customHtml.includes('по согласованию'), 'цена макета — по согласованию');
ok(customHtml.includes('data-cart-remove'), 'удалить заявку можно');

// ── обычный товар: кнопки количества на месте ────────────────────────

reset();
cart.addItem('goods-women-01');
const goodsHtml = renderCartItem(cart.getLines()[0]);

ok(goodsHtml.includes('class="quantity"'), 'у товара есть блок количества');
ok(goodsHtml.includes('data-cart-step="-1"') && goodsHtml.includes('data-cart-step="1"'),
  'у товара две кнопки — минус и плюс');

// ── состав заказа на странице благодарности ──────────────────────────

const orderHtml = renderOrderLines([
  {
    id: 'goods-women-01',
    qty: '1<b>',
    size: '<script>',
    sum: 7699,
    product: { title: '<i>Пижама</i>', price: 7699 },
  },
], 7699);

ok(!orderHtml.includes('<i>Пижама</i>'), 'название товара из заказа экранировано');
ok(orderHtml.includes('&lt;i&gt;Пижама&lt;/i&gt;'), 'название видно как текст');
ok(!orderHtml.includes('<script>'), 'размер из заказа экранирован');
ok(orderHtml.includes('&lt;script&gt;'), 'размер виден как текст');
ok(!orderHtml.includes('1<b>'), 'количество приводится к числу');

// ── итоги: печать считается по платным единицам ──────────────────────

reset();
cart.addItem('goods-men-04');           // 8999 — ниже порога
cart.addItem('print-01', { qty: 2 });
const summaryPaid = renderCartSummary(cart.getTotals(TERMS, cart.getLines()), 15000 - 8999);
/* formatPrice ставит неразрывные пробелы — сравниваем нормализованный текст */
const paidText = summaryPaid.replace(/\u00A0/g, ' ');

ok(summaryPaid.includes('data-cart-print-row'), 'в итогах есть строка печати');
ok(paidText.includes('Печать «ПРИНТ» × 2'), 'количество печати указано');
ok(paidText.includes('1 000'), 'два платных принта стоят 1 000');
ok(paidText.includes('До бесплатного принта'), 'подсказка про следующий бесплатный');

reset();
cart.addItem('goods-men-04');
cart.addItem('goods-men-07');           // 8999 + 7299 = 16 298
cart.addItem('print-01');
const summaryFree = renderCartSummary(cart.getTotals(TERMS, cart.getLines()), 0);

ok(summaryFree.includes('бесплатно'), 'при достигнутом пороге печать бесплатна');
ok(!summaryFree.includes('До бесплатного принта'), 'подсказки про добор нет');

// ── итог ─────────────────────────────────────────────────────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
