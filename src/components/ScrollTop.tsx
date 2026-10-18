"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./ScrollTop.module.css";

/** Кнопка «нагору»: з'являється, коли прогорнули більше півтора екрана */
export default function ScrollTop() {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const check = () => setShown(window.scrollY > window.innerHeight * 1.5);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  // В адмінці своя навігація — як і нижнє меню, кнопку там не показуємо
  if (pathname.startsWith("/admin")) return null;

  return (
    <button
      type="button"
      className={styles.button}
      data-shown={shown ? "" : undefined}
      aria-label="Нагору"
      tabIndex={shown ? 0 : -1}
      onClick={() => {
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
