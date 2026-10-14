#!/usr/bin/env node
/**
 * Проверка формы обратной связи: правила вопроса и разметка страниц.
 *
 * Как checks/checkout.mjs, работает без браузера: feedback.js держит проверку
 * отдельной функцией (validateQuestion) и не трогает DOM в ней, а DOM-часть —
 * это только показ ошибки. Поэтому логику гоняем в Node с заглушкой
 * localStorage, а разметку читаем из файлов.
 *
 * Запуск: node checks/feedback.mjs
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

const MESSAGE_KEY = 'cozy-pajamas:message';

// ── импорт после заглушек ─────────────────────────────────────────────

const { validateQuestion, submitQuestion, LIMITS } = await import('../assets/js/feedback.js');
const { readMessage, clearMessage } = await import('../assets/js/storage.js');

const { readFileSync } = await import('node:fs');

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
const stored = () => store.get(MESSAGE_KEY) ?? null;

const QUESTION = 'Подскажите, есть ли пижама ростом 170 см?';

// ─────────────── правило проверки вопроса ───────────────

eq(LIMITS, { min: 10, max: 1000 }, 'пределы длины вопроса: 10 и 1000 символов');

eq(validateQuestion(QUESTION), '', 'обычный вопрос проходит');
eq(validateQuestion('  ' + QUESTION + '  '), '', 'пробелы по краям не мешают');

ok(validateQuestion('').length > 0, 'пустое поле не проходит');
ok(validateQuestion('   ').length > 0, 'поле из пробелов не проходит');
ok(validateQuestion('Привет').length > 0, 'короткий вопрос не проходит');
ok(validateQuestion('а'.repeat(9)).length > 0, 'девять символов не проходят');
eq(validateQuestion('а'.repeat(10)), '', 'десять символов проходят — это нижняя граница');
eq(validateQuestion('а'.repeat(1000)), '', 'тысяча символов проходит — это верхняя граница');
ok(validateQuestion('а'.repeat(1001)).length > 0, 'тысяча один символ не проходит');

/* Пробелы по краям не должны считаться длиной: иначе «а» с девятью
   пробелами прошла бы проверку на минимум */
ok(validateQuestion('а'.repeat(9) + '    ').length > 0,
  'пробелы по краям не добирают длину до минимума');

eq(validateQuestion(undefined), validateQuestion(''), 'undefined обрабатывается как пустое поле');
eq(validateQuestion(null), validateQuestion(''), 'null обрабатывается как пустое поле');
eq(validateQuestion(42), validateQuestion('42'), 'число приводится к строке');

/* В текстах ошибок есть цифры пределов: человек должен понимать,
   сколько именно символов не хватает */
ok(validateQuestion('Коротко').includes(String(LIMITS.min)),
  'в ошибке о коротком тексте назван минимум');
ok(validateQuestion('а'.repeat(1001)).includes(String(LIMITS.max)),
  'в ошибке о длинном тексте назван максимум');

// ─────────────── сохранение вопроса ───────────────

reset();
eq(submitQuestion(''), null, 'пустой вопрос не сохраняется');
eq(stored(), null, 'после пустого вопроса в хранилище ничего нет');

reset();
eq(submitQuestion('Коротко'), null, 'слишком короткий вопрос не сохраняется');
eq(stored(), null, 'после короткого вопроса в хранилище ничего нет');

reset();
const DATE = new Date('2026-03-14T09:30:00.000Z');
const saved = submitQuestion('  ' + QUESTION + '  ', DATE);
eq(saved.question, QUESTION, 'сохранённый вопрос обрезан по краям');
eq(saved.createdAt, DATE.toISOString(), 'сохранено время отправки');
eq(stored(), JSON.stringify(saved), 'сообщение записано в хранилище');

eq(readMessage(), saved, 'readMessage возвращает сохранённое сообщение');

/* Проверки читающей стороны: без них страница благодарности получила бы
   массив или мусор и упала бы уже на полях */
store.set(MESSAGE_KEY, '[]');
eq(readMessage(), null, 'массив сообщением не считается');
store.set(MESSAGE_KEY, '"строка"');
eq(readMessage(), null, 'строка сообщением не считается');
store.set(MESSAGE_KEY, '{битый json');
eq(readMessage(), null, 'битый JSON не роняет чтение');

clearMessage();
eq(readMessage(), null, 'после clearMessage сообщения нет');

// ─────────────── разметка главной страницы ───────────────

const HOME = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const THANKS = readFileSync(new URL('../thanks-feedback.html', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../assets/css/sections/feedback.css', import.meta.url), 'utf8');
const SCRIPT = readFileSync(new URL('../assets/js/script.js', import.meta.url), 'utf8');
const THANKS_JS = readFileSync(new URL('../assets/js/thanks.js', import.meta.url), 'utf8');

ok(HOME.includes('data-feedback-form'), 'у формы обратной связи есть признак data-feedback-form');
ok(/action="thanks-feedback\.html"/.test(HOME), 'форма уходит на thanks-feedback.html без скрипта');
ok(HOME.includes('method="post"'), 'у формы задан метод');
ok(HOME.includes('novalidate'), 'у формы снята нативная проверка: ошибку показывает модуль');
ok(HOME.includes('data-feedback-field'), 'у поля вопроса есть признак data-feedback-field');
ok(HOME.includes('data-feedback-error'), 'в разметке есть место под текст ошибки');
ok(HOME.includes('id="feedback"'), 'у секции обратной связи есть якорь #feedback');

/* Границы в разметке и в модуле должны совпадать: если maxlength меньше
   LIMITS.max, браузер обрежет текст, который проверка считает нормальным */
const maxlength = HOME.match(/maxlength="(\d+)"/)?.[1];
eq(Number(maxlength), LIMITS.max, 'maxlength у поля совпадает с пределом модуля');
ok(HOME.includes('aria-describedby="feedback-error"'),
  'поле связано с текстом ошибки через aria-describedby');
ok(HOME.includes('role="alert"'), 'текст ошибки объявлен как alert — его прочитают сразу');

/* Якорь #feedback есть и в разметке, и в ссылке возврата: без него кнопка
   «Вернуться к форме» вела бы на главную, но не к форме */
ok(THANKS.includes('href="index.html#feedback"'), 'со страницы благодарности есть путь к форме');

// ─────────────── разметка страницы благодарности ───────────────

ok(THANKS.length > 0, 'thanks-feedback.html не пустой', `${THANKS.length} байт`);
ok(THANKS.includes('data-page="thanks-feedback"'), 'страница помечена как thanks-feedback');
ok(THANKS.includes('data-thanks-body'), 'есть блок с сообщением');
ok(THANKS.includes('data-thanks-empty'), 'есть блок «Сообщения нет»');
ok(THANKS.includes('data-thanks-question'), 'есть место под текст вопроса');
ok(THANKS.includes('data-thanks-date'), 'есть место под дату отправки');
ok(THANKS.includes('assets/js/script.js'), 'страница подключает точку входа скриптов');
ok(THANKS.includes('assets/css/style.css'), 'страница подключает стили');

/* Текст вопроса печатается через textContent: чужой текст не должен
   становиться разметкой страницы */
ok(/thanks__question[^>]*>/.test(THANKS), 'вопрос выводится в отдельный абзац');
ok(!/data-thanks-question[^>]*>\s*[^<\s]/.test(THANKS), 'абзац вопроса пуст в разметке — его наполняет скрипт');

// ─────────────── связка модулей ───────────────

ok(SCRIPT.includes("initFeedback"), 'точка входа запускает форму обратной связи');
ok(SCRIPT.includes('thanks-feedback'), 'точка входа знает про страницу благодарности за вопрос');
ok(THANKS_JS.includes('initThanksFeedback'), 'thanks.js умеет показывать вопрос');
ok(THANKS_JS.includes('readMessage'), 'thanks.js читает сообщение из хранилища');

// ─────────────── стили ошибки ───────────────

ok(/\.feedback__error\s*\{/.test(CSS), 'у текста ошибки есть стиль');
ok(/\.feedback__input\.is-invalid\s*\{/.test(CSS), 'у неверного поля есть стиль');
ok(/\.feedback__error\s*\{[^}]*position:\s*absolute/.test(CSS),
  'текст ошибки вынут из потока: подпись не растягивает поле');
ok(/#fe0000/.test(CSS), 'текст ошибки красный, как ошибки формы оформления');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Пределы вопроса: от ${LIMITS.min} до ${LIMITS.max} символов\n`);
process.stdout.write(`thanks-feedback.html: ${THANKS.length} байт\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((f) => process.stdout.write(`  FAIL ${f}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
