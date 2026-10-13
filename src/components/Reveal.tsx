"use client";

import { useEffect, useRef } from "react";
import styles from "./Reveal.module.css";

/**
 * Показує елемент, коли він доходить до екрана.
 *
 * Кроки процесу так читаються по одному: прогортав — з'явився наступний.
 * Спостерігач вимикається після першої появи: повторна анімація на зворотній
 * прокрутці дратує більше, ніж допомагає.
 *
 * З сервера блок приходить видимим, ховає його вже скрипт — як у ScrollReveal.
 * Якщо скрипт не запустився, нічого не сховано — вміст на місці.
 */
export default function Reveal({
  children,
  /** Затримка в межах одного ряду, щоб сусідні картки виходили каскадом */
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Ховаємо лише те, що на момент завантаження нижче екрана: видиме не блимає
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    // Запит «менше руху» обробляє CSS: там .hidden одразу видимий,
    // тож окремої гілки в JS не потрібно.
    el.classList.add(styles.hidden);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.replace(styles.hidden, styles.shown);
        io.disconnect();
      },
      // Трохи раніше за нижній край: до моменту появи анімація вже почалась
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      el.classList.remove(styles.hidden, styles.shown);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
