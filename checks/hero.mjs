#!/usr/bin/env node
/**
 * Первый экран: стрелка в кнопке, читаемость абзаца, свечение кнопки.
 *
 * Что сделано по просьбе владельца:
 *   — в кнопке вместо картинки-иконки (на экране она читалась как
 *     восклицательный знак) стоит шрифтовая стрелка вниз «↓»;
 *   — абзац стоит на синей плашке: затемнение только под ним, цвет взят
 *     из палитры (--color-blue), а не чёрный;
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

const blockOf = (selector) => {
  const at = CSS.indexOf(`${selector} {`);
  return at < 0 ? '' : CSS.slice(at, CSS.indexOf('}', at));
};

// ─────────────── кнопка ───────────────

const button = INDEX.match(/<a class="hero__button[^>]*>([\s\S]*?)<\/a>/)?.[1]?.trim() ?? '';

ok(button.includes('Скорее к покупкам'), 'в кнопке остался текст «Скорее к покупкам»', button);
ok(button.includes('↓'), 'вместо восклицательного знака — шрифтовая стрелка вниз', button);
ok(!button.includes('!'), 'восклицательного знака в кнопке нет', button);
ok(button.includes('&nbsp;↓'), 'стрелка приклеена к слову неразрывным пробелом');

ok(!/i-hero\.svg/.test(CSS), 'картинки-иконки в кнопке больше нет');
ok(!/\.hero__button \{[\s\S]{0,300}?background-image/.test(CSS),
  'у кнопки не осталось фона-картинки');

const buttonBlock = blockOf('.hero__button');
ok(/box-shadow:/.test(buttonBlock), 'вокруг кнопки есть свечение');
ok(/rgba\(255, 255, 255, 0\.6\)/.test(buttonBlock) && /rgba\(255, 255, 255, 0\.3\)/.test(buttonBlock),
  'свечение из двух белых слоёв: узкий яркий и широкий мягкий');

// ─────────────── плашка под абзацем ───────────────

const textBlock = blockOf('.hero__text');

ok(/--hero-veil:/.test(textBlock), 'цвет плашки вынесен в переменную', textBlock.replace(/\s+/g, ' '));
ok(/background-color: var\(--hero-veil\)/.test(textBlock), 'плашка заливает сам абзац');
ok(/box-shadow: 0 0 0 var\(--space-8\) var\(--hero-veil\)/.test(textBlock),
  'плашка на 8px шире текста: на телефоне иначе упирается в край экрана');
ok(/border-radius: var\(--radius-sm\)/.test(textBlock), 'у плашки скругление из шкалы сайта');

/* Цвет — синий из палитры, а не чёрный: rgba-запасной вариант и color-mix
   по токену --color-blue */
ok(/--hero-veil: rgba\(147, 179, 214, 0\.45\)/.test(textBlock),
  'запасной цвет — #93b3d6 с прозрачностью, это --color-blue');
ok(/@supports \(background-color: color-mix\(in srgb, red 50%, transparent\)\)/.test(CSS),
  'для современных браузеров цвет привязан к токену через color-mix');
ok(/--hero-veil: color-mix\(in srgb, var\(--color-blue\) 45%, transparent\)/.test(CSS),
  'color-mix берёт именно --color-blue');

/* Старая размытая подложка ушла: именно она давала «грязный» вид */
ok(!CSS.includes('.hero__text::before'), 'псевдоэлемента-подложки больше нет');
ok(!/filter: blur/.test(CSS), 'размытия под абзацем не осталось');

const shadowLines = textBlock.match(/text-shadow:[\s\S]*?;/)?.[0] ?? '';
ok(shadowLines.length > 0, 'у абзаца осталась тень букв', shadowLines);
ok(!/0 0 20px/.test(shadowLines), 'широкое свечение вокруг букв убрано: это и был грязный ореол');
ok(/0 1px 2px/.test(shadowLines), 'тень узкая и мягкая');

ok(/@media \(min-width: 768px\)[\s\S]{0,900}?box-shadow: 0 0 0 var\(--space-12\)/.test(CSS),
  'с 768px места хватает на разлив 12px');

ok(/@media \(min-width: 1280px\)[\s\S]{0,300}?\.hero__text \{\s*font-size: var\(--fs-18\)/.test(CSS),
  'на десктопе лид крупнее прежних 16px');

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write('Кнопка: «Скорее к покупкам ↓» + белое свечение; абзац: синяя плашка из палитры\n');

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
