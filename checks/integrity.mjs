#!/usr/bin/env node
/**
 * Целостность ссылок и ресурсов во всех HTML-файлах проекта.
 *
 * Проверяется то, что не видно в браузере, пока не ткнёшь в ссылку:
 *   — каждая внутренняя ссылка `href` ведёт на существующий файл;
 *   — якорь `#id` существует на странице, куда ведёт ссылка;
 *   — каждый `src` (картинки, стили, скрипты) указывает на существующий файл;
 *   — нет ссылок на файлы, которых нет в репозитории (опечатки в путях).
 *
 * Внешние адреса (http, mailto, tel) пропускаются: сеть здесь не проверяется.
 *
 * Запуск: node checks/integrity.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

let passed = 0;
const failures = [];

const ok = (condition, name, detail = '') => {
  if (condition) { passed++; return; }
  failures.push(detail ? `${name} — ${detail}` : name);
};

/** Все HTML-файлы проекта, кроме служебных папок. */
const htmlFiles = (() => {
  const found = [];
  const skip = new Set(['.git', '.gigatool', 'node_modules', 'figma', 'prompts', 'docs']);
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) found.push(full);
    }
  };
  walk(ROOT);
  return found.sort();
})();

/** href/src из разметки: значение и признак, что это ссылка, а не ресурс. */
const linkPattern = /\b(href|src)\s*=\s*"([^"]*)"/g;

const external = (value) => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
const isAnchorOnly = (value) => value.startsWith('#');

/** Файл, на который указывает путь, или null. */
const resolveTarget = (from, value) => {
  const clean = value.split('#')[0].split('?')[0];
  if (!clean) return null;

  const base = clean.startsWith('/') ? ROOT : dirname(from);
  const target = normalize(join(base, clean.replace(/^\/+/, '')));
  return target;
};

/** Есть ли на странице элемент с таким id. */
const hasAnchor = (file, anchor) => {
  const html = readFileSync(file, 'utf8');
  const id = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b(?:id|name)\\s*=\\s*"${id}"`).test(html);
};

const brokenFiles = [];
const brokenAnchors = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const where = relative(ROOT, file);

  for (const [, kind, raw] of html.matchAll(linkPattern)) {
    const value = raw.trim();
    if (!value || external(value) || value.startsWith('data:')) continue;

    /* Чистый якорь — проверяем на этой же странице */
    if (isAnchorOnly(value)) {
      if (!hasAnchor(file, value.slice(1))) {
        brokenAnchors.push(`${where} → ${value}`);
      }
      continue;
    }

    const target = resolveTarget(file, value);
    if (!target) continue;

    if (!existsSync(target) || !statSync(target).isFile()) {
      brokenFiles.push(`${where} → ${value} (${kind})`);
      continue;
    }

    const [path, anchor] = value.split('#');
    if (anchor && path) {
      const isHtml = target.endsWith('.html');
      if (isHtml && !hasAnchor(target, anchor)) {
        brokenAnchors.push(`${where} → ${value}`);
      }
    }
  }
}

ok(htmlFiles.length > 140, 'в проект попало больше 140 страниц', String(htmlFiles.length));
// ── «Перейти к содержимому»: WCAG 2.4.1 ──────────────────────────────

/* Ссылка должна быть первой в теле страницы: иначе с клавиатуры её надо
   искать среди пунктов меню, и смысл теряется. Ведёт на #main — он есть
   на каждой странице, это проверяет общий обход якорей выше */

const безПропуска = [];
const неПервая = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const where = relative(ROOT, file);

  if (!/href="#main"/.test(html)) безПропуска.push(where);

  const body = html.indexOf('<body');
  const firstLink = html.indexOf('<a ', body);
  if (body !== -1 && !html.slice(firstLink, firstLink + 400).includes('href="#main"')) {
    неПервая.push(where);
  }
}

ok(безПропуска.length === 0, 'на каждой странице есть ссылка «Перейти к содержимому»',
  безПропуска.slice(0, 5).join(', '));
ok(неПервая.length === 0, 'это первая ссылка в теле страницы',
  неПервая.slice(0, 5).join(', '));

const UTILITIES = readFileSync(join(ROOT, 'assets/css/utilities.css'), 'utf8');
ok(/\.visually-hidden--focusable:focus-visible/.test(UTILITIES),
  'видимой ссылка становится при фокусе — правило в utilities.css');
ok(/Перейти к содержимому/.test(readFileSync(join(ROOT, 'index.html'), 'utf8')),
  'текст ссылки по-русски и понятен без контекста');

ok(brokenFiles.length === 0, 'все href и src ведут на существующие файлы',
  brokenFiles.slice(0, 6).join(' | '));
ok(brokenAnchors.length === 0, 'все якоря существуют на своих страницах',
  brokenAnchors.slice(0, 6).join(' | '));

// ─────────────── итог ───────────────

process.stdout.write(`Проверок пройдено: ${passed}\n`);
process.stdout.write(`Страниц проверено: ${htmlFiles.length}, битых ссылок: ${brokenFiles.length}, `
  + `битых якорей: ${brokenAnchors.length}\n`);

if (failures.length) {
  process.stdout.write(`\nНЕ ПРОШЛО: ${failures.length}\n`);
  failures.forEach((failure) => process.stdout.write(`  FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write('\nВсё чисто.\n');
