#!/usr/bin/env node
/**
 * Первый экран: стрелка в кнопке, читаемость абзаца, свечение кнопки.
 *
 * Что изменилось по просьбе владельца:
 *   — в кнопке вместо картинки-иконки (на экране она читалась как
 *     восклицательный знак) стоит шрифтовая стрелка вниз «↓»;
 *   — абзац получил тень букв и мягкую подложку: белый текст на пёстрой
 *     картинке читался плохо;
 *   — вокруг кнопки белое свечение, как ореол у девушки на фоне.
 *
 * Живые замеры — в checks/req-hero.mjs.
 *
 * Запуск: node checks/hero.mjs
 */

import { readFileSync } from 'node:fs';

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(detail ? `${name} — ${detail}` : name);
};

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const INDEX = read('index.html');
const CSS = read('assets/css/sections/hero.css');

// ─────────────── кнопка ───────────────

const button = INDEX.match(/<a class="hero__button[^>]*>([\s\S]*?)<\/a>/)?.[1]?.trim() ?? '';

ok(button.includes('Скорее к покупкам'), 'в кнопке остался текст «Скорее к покупкам»', button);
ok(button.includes('↓'), 'вместо восклицательного знака — шрифтовая стрелка вниз', button);
ok(!button.includes('!'), 'восклицательного знака в кнопке нет', button);
ok(button.includes('&nbsp;↓'), 'стрелка приклеена к слову неразрывным пробелом');

ok(!/i-hero\.svg/.test(CSS), 'картинки-иконки в кнопке больше нет');
ok(!/\.hero__button \{[\s\S]{0,300}?background-image/.test(CSS),
  'у кнопки не осталось фона-картинки');
ok(/\.hero__button \{[\s\S]{0,400}?box-shadow:/.test(CSS), 'вокруг кнопки есть свечение');
ok(/rgba\(255, 255, 255, 0\.6\)/.test(CSS) && /rgba\(255, 255, 255, 0\.3\)/.test(CSS),
  'свечение из двух белых слоёв: узкий яркий и широкий мягкий');

// ─────────────── читаемость абзаца ───────────────

const textBlock = CSS.slice(CSS.indexOf('.hero__text {'), CSS.indexOf('}', CSS.indexOf('.hero__text {')));
ok(/text-shadow:/.test(textBlock), 'у абзаца есть тень букв', textBlock.replace(/\s+/g, ' '));
ok(/rgba\(18, 20, 50, 0\.55\)/.test(textBlock), 'тень тёмная и достаточно плотная');

const scrim = CSS.slice(CSS.indexOf('.hero__text::before'), CSS.indexOf('}', CSS.indexOf('.hero__text::before')));
ok(scrim.length > 0, 'под абзацем есть подложка');
ok(/background-color: rgba\(22, 24, 62, 0\.38\)/.test(scrim), 'подложка тёмная, но полупрозрачная');
ok(/filter: blur\(18px\)/.test(scrim), 'края подложки размыты: это не серая плашка');
ok(/inset: -12px -18px/.test(scrim), 'подложка чуть больше текстового блока');

ok(/\.hero__content \{[\s\S]{0,200}?isolation: isolate/.test(CSS),
  'у контента свой контекст наложения: иначе подложка уходит под фон картинки');

ok(/@media \(min-width: 1280px\)[\s\S]{0,300}?\.hero__text \{\s*font-size: var\(--fs-18\)/.test(CSS),
  'на десктопе лид крупнее прежних 16px');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write('Кнопка: «Скорее к покупкам ↓» + белое свечение; абзац: тень и размытая подложка\n');

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
