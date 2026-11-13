/**
 * Звёздочки секции обратной связи: полёт к заголовку и соцсетям.
 *
 * В макете звёзды стоят по углам секции. Когда человек докручивает до подвала,
 * они плавно переезжают внутрь — к краям заголовка и к соцсетям — и остаются
 * там: это тот же декор, но собранный ближе к содержанию.
 *
 * Проигрывается один раз за загрузку страницы: обсервер снимается после
 * первого срабатывания. В localStorage ничего не пишем — при обновлении
 * страницы анимация повторяется.
 *
 * Сам полёт описан в CSS (assets/css/sections/feedback.css, раздел
 * «Звёздочки»): скрипт только ставит класс is-stars-in на секцию.
 */

/** Класс состояния: звёзды на конечных местах. */
const IN_VIEW = 'is-stars-in';

/**
 * Когда считаем, что человек докрутил до подвала: подвал должен быть виден
 * почти целиком. Подвал низкий (одна строка про ООО), поэтому порог 0.9 —
 * это «подвал на экране», а не «показался краешек».
 *
 * rootMargin не задаём: с отрицательным отступом снизу подвал у самого края
 * страницы оказывался за пределами уменьшенного окна, и звёзды не летели.
 */
const OBSERVER_OPTIONS = {
  threshold: 0.9,
};

/**
 * Подключает полёт звёзд.
 *
 * Точка запуска — подвал: он идёт сразу за секцией обратной связи, и его
 * появление значит, что человек дочитал страницу. Секции без звёзд
 * (все, кроме главной) скрипт пропускает.
 */
export function initStars() {
  const section = document.querySelector('[data-stars]');
  if (!section) return;

  const trigger = document.querySelector('[data-stars-trigger]') ?? section;

  /* Человек попросил меньше движения — звёзды сразу на местах, без полёта */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add(IN_VIEW);
    return;
  }

  /* Без IntersectionObserver (старые браузеры) не оставляем звёзды в углах:
     сразу ставим их на конечные места — вид тот же, анимации нет */
  if (!('IntersectionObserver' in window)) {
    section.classList.add(IN_VIEW);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      section.classList.add(IN_VIEW);
      observer.disconnect();
    });
  }, OBSERVER_OPTIONS);

  observer.observe(trigger);
}
