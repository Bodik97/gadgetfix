"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./ServiceList.module.css";

export type ServiceRow = { slug: string; title: string; body: string; meta: string; icon?: string };

/**
 * Послуги на головній — рядками зі значками. Один рядок завжди висунутий:
 * на комп'ютері — той, на який навели курсор, на телефоні — той, що зараз
 * посередині екрана. Відкритий лише один, тож сторінка не «стрибає».
 * Натискання на рядок веде на сторінку послуги.
 */
export default function ServiceList({ items }: { items: ServiceRow[] }) {
  const [open, setOpen] = useState(0);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  // Телефон: висуваємо рядок, що перетнув середину екрана
  useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (!hit) return;
        const i = rows.current.indexOf(hit.target as HTMLLIElement);
        // Невелика затримка — щоб під час швидкої прокрутки рядки не мигали
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setOpen(i), 120);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    rows.current.forEach((el) => el && io.observe(el));
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, []);

  return (
    <ol className={styles.list}>
      {items.map((s, i) => (
        <li
          key={s.slug}
          ref={(el) => {
            rows.current[i] = el;
          }}
          className={styles.row}
          data-open={open === i || undefined}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setOpen(i);
          }}
        >
          <Link href={`/poslugy/${s.slug}`} className={styles.head} onFocus={() => setOpen(i)}>
            <span className={styles.icon}>
              {s.icon && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: s.icon }}
                />
              )}
            </span>
            <h3 className={styles.title}>{s.title}</h3>
            <span className={styles.meta}>{s.meta}</span>
            <span className={styles.arrow} aria-hidden="true" />
          </Link>

          <div className={styles.panel}>
            <div className={styles.panelInner}>
              <div className={styles.panelBody}>
                <p className={styles.body}>{s.body}</p>
                <Link href={`/poslugy/${s.slug}`} className={`btn btn-ghost ${styles.more}`} tabIndex={-1}>
                  Детальніше
                </Link>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
