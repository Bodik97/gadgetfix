"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import slider from "./ReviewSlider.module.css";
import styles from "./WorkSlider.module.css";

export type WorkCard = { id: string; device: string; text: string };

const photo = (id: string, v: "before" | "after") => `/api/works/${id}/image?v=${v}`;

/**
 * Результати робіт стрічкою — та сама механіка, що й у відгуків:
 * гортається пальцем, на компʼютері — стрілками.
 */
export default function WorkSlider({ works }: { works: WorkCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const slide = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector("figure");
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  return (
    <div className={slider.wrap}>
      <div className={slider.track} ref={trackRef} tabIndex={0} aria-label="Результати робіт">
        {works.map((w) => (
          <figure key={w.id} className={styles.card}>
            <div className={styles.pair}>
              {(["before", "after"] as const).map((v) => (
                <a key={v} href={photo(w.id, v)} target="_blank" rel="noopener" className={styles.photo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo(w.id, v)} alt={`${w.device} ${v === "before" ? "до" : "після"} ремонту`} loading="lazy" />
                  <span className={v === "after" ? styles.tagAfter : styles.tag}>{v === "before" ? "До" : "Після"}</span>
                </a>
              ))}
            </div>

            <figcaption className={styles.caption}>
              <span className={styles.device}>{w.device}</span>
              <span className={styles.text}>{w.text}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      {works.length > 1 && (
        <div className={slider.controls}>
          <button type="button" className={slider.arrow} onClick={() => slide(-1)} disabled={atStart} aria-label="Попередні роботи">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className={slider.arrow} onClick={() => slide(1)} disabled={atEnd} aria-label="Наступні роботи">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
