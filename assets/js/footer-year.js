/**
 * footer-year.js — год в подписи подвала.
 *
 * В разметке год стоит числом, чтобы страница читалась и без скрипта:
 * «ООО «Магазин уютных пижам» © 2023 - 2026». Скрипт заменяет это число
 * на текущий год — иначе в январе в подвале останется прошлогоднее.
 *
 * Подпись правится только на страницах, где есть маркер
 * data-copyright-year: сейчас это страницы товаров. У остальных страниц
 * подпись короче («© 2023»), и трогать её незачем.
 */

/** Ставит текущий год во все подписи с маркером. */
export function initFooterYear(root = document) {
  const marks = root.querySelectorAll('[data-copyright-year]');
  if (marks.length === 0) return;

  const year = String(new Date().getFullYear());
  marks.forEach((mark) => {
    mark.textContent = year;
  });
}
