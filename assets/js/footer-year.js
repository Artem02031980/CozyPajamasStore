/**
 * footer-year.js — год в подписи подвала.
 *
 * В разметке год стоит числом, чтобы страница читалась и без скрипта:
 * «ООО «Магазин уютных пижам» © 2023 - 2026». Скрипт заменяет это число
 * на текущий год — иначе в январе в подвале останется прошлогоднее.
 *
 * Маркер data-copyright-year стоит во всех подвалах: и на главной, и в
 * каталоге принтов, и на страницах товаров. Подпись везде одинаковый
 * диапазон «© 2023 - <текущий год>», поэтому год в подвале не устаревает
 * сам по себе.
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
