/**
 * Запрос: страница благодарности за вопрос — оба состояния.
 *
 * Сообщение кладётся в localStorage и страница перезагружается ключом
 * --expr-before. Без перезагрузки проверка бессмысленна: скрипты страницы
 * выполняются раньше, чем харнесс получает управление, поэтому запись,
 * сделанная после загрузки, до модуля уже не дойдёт — и на любой странице
 * был бы показан пустой блок.
 *
 * Запуск (два раза — с сообщением и без):
 *   node ~/.dsh/bin/browser.mjs --url http://127.0.0.1:8124/thanks-feedback.html \
 *     --request checks/req-thanks-feedback.mjs --widths 1280 --no-preflight \
 *     --expr-before "localStorage.setItem('cozy-pajamas:message', JSON.stringify({question:'…', createdAt:'2026-03-14T09:30:00.000Z'})); location.reload()"
 */

const box = (selector) => document.querySelector(selector);
const shown = (el) => Boolean(el) && !el.classList.contains('is-hidden');

/* Ждём дольше обычного: запрос приходит сразу после перезагрузки
   из --expr-before, и модулям нужно время на выполнение */
await new Promise((r) => setTimeout(r, 500));

const body = box('[data-thanks-body]');
const empty = box('[data-thanks-empty]');
const question = box('[data-thanks-question]');
const date = box('[data-thanks-date]');
const back = box('.thanks__back');

const cs = question ? getComputedStyle(question) : null;
const rect = question?.getBoundingClientRect();

return {
  заголовок: box('.thanks__title')?.textContent.trim() ?? null,
  надзаголовок: box('.thanks__overline')?.textContent.trim() ?? null,
  блокСоСообщениемВиден: shown(body),
  блокПустойВиден: shown(empty),
  вопросТекст: question?.textContent ?? null,
  вопросСодержитПеренос: (question?.textContent ?? '').includes('\n'),
  переносыВCSS: cs?.whiteSpace ?? null,
  датаТекст: date?.textContent ?? null,
  ширинаВопроса: rect ? Math.round(rect.width) : null,
  выравнивание: cs?.textAlign ?? null,
  цветФона: cs?.backgroundColor ?? null,
  путьНазад: back?.getAttribute('href') ?? null,
  путьНазадВиден: Boolean(back),
};
