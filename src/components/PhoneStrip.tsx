"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PhoneStrip.module.css";

type StripModel = { name: string; slug: string; img: string; year: string };

/** З якої моделі починаємо: не з краю, щоб з обох боків було видно сусідів */
const START = 2;

/**
 * Карусель моделей: та, що по центру, — велика й підсвічена, сусіди менші й
 * тьмяніші. Гортається пальцем, трекпадом або стрілками; натискання на будь-яку
 * картку веде на сторінку моделі.
 */
export default function PhoneStrip({ models }: { models: StripModel[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(START);

  /** Для кожної картки рахуємо відстань до центру в «картках» — від неї
      залежать розмір і яскравість (--d у стилях) */
  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    let min = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const li = child as HTMLElement;
      const d = Math.abs(li.offsetLeft + li.offsetWidth / 2 - mid) / li.offsetWidth;
      li.style.setProperty("--d", Math.min(d, 2).toFixed(3));
      if (d < min) {
        min = d;
        nearest = i;
      }
    });
    setActive(nearest);
  }, []);

  const go = useCallback((i: number, behavior: ScrollBehavior = "smooth") => {
    const el = ref.current;
    const li = el?.children[i] as HTMLElement | undefined;
    if (!el || !li) return;
    el.scrollTo({ left: li.offsetLeft + li.offsetWidth / 2 - el.clientWidth / 2, behavior });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    go(START, "instant");
    sync();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [go, sync]);

  const last = models.length - 1;

  return (
    <div className={styles.strip}>
      <ul className={styles.track} ref={ref}>
        {models.map((m, i) => (
          <li key={m.slug} className={i === active ? `${styles.item} ${styles.on}` : styles.item}>
            <Link href={`/modeli/${m.slug}`} className={styles.card}>
              <span className={styles.no} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={styles.shot}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.img} alt="" loading="lazy" draggable={false} />
              </span>
              <span className={styles.name}>{m.name}</span>
              <span className={styles.meta}>
                <span>{m.year}</span>
                <span className={styles.more}>
                  Ціни
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.controls}>
        <button type="button" className={styles.arrow} onClick={() => go(active - 1)} disabled={active === 0} aria-label="Попередня модель">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>

        <div className={styles.progress} aria-hidden="true">
          <span className={styles.count}>{String(active + 1).padStart(2, "0")}</span>
          <span className={styles.bar}>
            <span className={styles.barFill} style={{ width: `${((active + 1) / models.length) * 100}%` }} />
          </span>
          <span className={styles.count}>{String(models.length).padStart(2, "0")}</span>
        </div>

        <button type="button" className={styles.arrow} onClick={() => go(active + 1)} disabled={active === last} aria-label="Наступна модель">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
