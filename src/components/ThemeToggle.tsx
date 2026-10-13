"use client";

import styles from "./ThemeToggle.module.css";

/** Ключ у localStorage; його ж читає скрипт у <head> (див. THEME_SCRIPT) */
export const THEME_KEY = "gf-theme";

/**
 * Типова тема — світла (атрибут на <html> у layout). Якщо відвідувач раніше
 * обрав темну, скрипт ставить її ще до першого малювання — інакше вона на
 * мить спалахувала б світлою. Виконується як inline-скрипт у <head>.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

/**
 * Перемикач світлої й темної теми.
 *
 * Стану в React немає навмисно: тема — атрибут на <html>, а яку іконку
 * показати, вирішує CSS. Так сервер і браузер малюють однаковий HTML, і
 * немає миготіння неправильної іконки під час гідратації.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";

    // Кольори перетікають, а не стрибають — якщо людина не просила менше руху
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("theme-switching");
      window.setTimeout(() => root.classList.remove("theme-switching"), 350);
    }
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Приватне вікно — тема діє до кінця сеансу, просто не запамʼятається
    }
  };

  return (
    <button type="button" className={`${styles.toggle} ${className}`} onClick={toggle} aria-label="Світла / темна тема" title="Світла / темна тема">
      {/* Сонце — у темній темі (увімкнути світлу), місяць — у світлій */}
      <svg className={styles.sun} width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </svg>
      <svg className={styles.moon} width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
