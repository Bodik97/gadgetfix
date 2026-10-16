"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ReviewSlider.module.css";

export type ReviewCard = {
  id: string;
  text: string;
  author: string;
  rating: number;
  viaGoogle: boolean;
  /** Фото з акаунта клієнта, якщо він його ставив */
  avatar: string | null;
  image: string | null;
  /** Фото до і після ремонту від самого клієнта */
  pair: { before: string; after: string } | null;
};

function GoogleMark() {
  return (
    <span className={styles.google} title="Клієнт увійшов через пошту Google">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
        <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5z" />
        <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
        <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" />
      </svg>
      підтверджено
    </span>
  );
}

/**
 * Відгуки стрічкою, яку можна гортати.
 *
 * Сіткою вони займали пів екрана, і людина проминала їх, гортаючи до форми.
 * Стрічка показує два-три й натякає краєм, що далі є ще.
 */
export default function ReviewSlider({ reviews }: { reviews: ReviewCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Адреса аватара живе в акаунті клієнта й може протухнути. Замість «битої»
  // картинки показуємо літеру — так само, як у тих, хто фото не ставив.
  const [brokenAvatars, setBrokenAvatars] = useState<string[]>([]);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  // Зірки «спалахують», коли картка вперше зʼявляється на екрані
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    el.dataset.anim = "";
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.seen = "";
          seen.unobserve(e.target);
        }
      },
      { threshold: 0.4 },
    );
    el.querySelectorAll("figure").forEach((card) => seen.observe(card));
    return () => seen.disconnect();
  }, [reviews]);

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
    // Крок — ширина однієї картки з проміжком
    const card = el.querySelector("figure");
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.track} ref={trackRef} tabIndex={0} aria-label="Відгуки клієнтів">
        {reviews.map((r) => (
          <figure key={r.id} className={styles.card}>
            <div className={styles.stars} role="img" aria-label={`${r.rating} з 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  aria-hidden="true"
                  className={n <= r.rating ? styles.star : styles.starOff}
                  style={{ "--i": n - 1 } as React.CSSProperties}
                >
                  ★
                </span>
              ))}
            </div>

            {r.pair && (
              <div className={styles.pair}>
                {(["before", "after"] as const).map((v) => (
                  <a key={v} href={r.pair![v]} target="_blank" rel="noopener" className={styles.pairPhoto}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.pair![v]} alt={v === "before" ? "До ремонту" : "Після ремонту"} loading="lazy" />
                    <span className={v === "after" ? styles.pairTagAfter : styles.pairTag}>
                      {v === "before" ? "До" : "Після"}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {r.image && !r.pair && (
              <a href={r.image} target="_blank" rel="noopener" className={styles.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.image} alt="Фото виконаної роботи" loading="lazy" />
              </a>
            )}

            <blockquote className={styles.text}>«{r.text}»</blockquote>

            <figcaption className={styles.foot}>
              {r.avatar && !brokenAvatars.includes(r.id) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.avatar}
                  alt=""
                  className={styles.avatar}
                  loading="lazy"
                  onError={() => setBrokenAvatars((prev) => [...prev, r.id])}
                />
              ) : (
                <span className={styles.initial} aria-hidden="true">
                  {r.author.slice(0, 1).toUpperCase()}
                </span>
              )}

              <span className={styles.who}>
                <span className={styles.author}>{r.author}</span>
                {r.viaGoogle && <GoogleMark />}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      {reviews.length > 1 && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => slide(-1)}
            disabled={atStart}
            aria-label="Попередні відгуки"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          <button
            type="button"
            className={styles.arrow}
            onClick={() => slide(1)}
            disabled={atEnd}
            aria-label="Наступні відгуки"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
