"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { plural } from "./account/plural";
import styles from "./ReviewShowcase.module.css";

export type ReviewCard = {
  id: string;
  text: string;
  name: string;
  city: string | null;
  device: string | null;
  /** Фото моделі з каталогу, якщо впізнали її в `device`, — коли клієнт не доклав свого */
  deviceImage: string | null;
  /** «15 жовтня 2026» — форматуємо на сервері, щоб не розійшлось при гідрації */
  date: string;
  rating: number;
  viaGoogle: boolean;
  /** Фото з акаунта клієнта, якщо він його ставив */
  avatar: string | null;
  /** Фото роботи, яке доклав майстер */
  image: string | null;
  /** Фото до і після ремонту від самого клієнта */
  pair: { before: string; after: string } | null;
};

/** Довший текст ховаємо за «Читати повністю», щоб картки в колоді були однакові */
const LONG_TEXT = 260;
/** Скільки летить змахнута картка */
const FLY_MS = 320;
/** Наскільки відтягнути картку, щоб вона полетіла, — менше повертається назад */
const THROW_PX = 100;
/** Скільки карток видно в стосі під верхньою */
const BEHIND = 2;

/**
 * Відгуки колодою карток: верхню змахують пальцем чи мишкою — вона відлітає
 * й лягає в кінець, а під нею вже наступна. Стрілки й крапки — для тих, хто
 * не тягне. Уперше на екрані верхня картка злегка ворушиться: її можна тягнути.
 */
export default function ReviewShowcase({
  reviews,
  stats,
}: {
  reviews: ReviewCard[];
  stats: { count: number; average: number };
}) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [fly, setFly] = useState<0 | 1 | -1>(0);
  const [hint, setHint] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Картку тягнули — клік, яким закінчився рух, не має відкривати фото
  const dragged = useRef(false);

  const count = reviews.length;

  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const throwCard = useCallback(
    (dir: 1 | -1) => {
      if (fly || count < 2) return;
      setFly(dir);
      window.setTimeout(
        () => {
          setIndex((i) => (i + 1) % count);
          setFly(0);
          setDrag(0);
        },
        calm() ? 0 : FLY_MS,
      );
    },
    [count, fly],
  );

  const back = () => {
    if (fly || count < 2) return;
    setDrag(0);
    setIndex((i) => (i - 1 + count) % count);
  };

  // Підказка один раз, коли колода вперше на екрані
  useEffect(() => {
    const el = deckRef.current;
    if (!el || count < 2 || calm()) return;
    const seen = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        seen.disconnect();
        setHint(true);
      },
      { threshold: 0.6 },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [count]);

  if (count === 0) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || fly || count < 2) return;
    start.current = { x: e.clientX, y: e.clientY };
    dragged.current = false;
    setHint(false);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s0 = start.current;
    if (!s0) return;
    const dx = e.clientX - s0.x;
    const dy = e.clientY - s0.y;
    if (!dragged.current) {
      // Вертикальний рух — людина гортає сторінку, картку не чіпаємо
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      if (Math.abs(dx) < 8) return;
      dragged.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDrag(dx);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const s0 = start.current;
    start.current = null;
    if (!s0 || !dragged.current) return;
    const dx = e.clientX - s0.x;
    if (Math.abs(dx) > THROW_PX) throwCard(dx > 0 ? 1 : -1);
    else setDrag(0);
  };

  return (
    <section className={styles.root} aria-roledescription="карусель" aria-label="Відгуки клієнтів">
      <div className={styles.summary}>
        <div className={styles.score}>
          <span className={styles.scoreNum}>{stats.average.toFixed(1).replace(".", ",")}</span>
          <span className={styles.scoreSide}>
            <Stars rating={Math.round(stats.average)} size="lg" />
            <span className={styles.scoreCount}>
              {stats.count} {plural(stats.count, "відгук", "відгуки", "відгуків")} від клієнтів
            </span>
          </span>
        </div>

        <p className={styles.proof}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Пишуть лише клієнти з акаунтом і підтвердженою поштою
        </p>
      </div>

      <div className={styles.stage}>
        <div ref={deckRef} className={styles.deck} data-hint={hint ? "" : undefined} onAnimationEnd={() => setHint(false)}>
          {reviews.map((r, i) => {
            // Місце в стосі: 0 — зверху, далі — глибше
            const k = (i - index + count) % count;
            const top = k === 0;
            const depth = Math.min(k, BEHIND);

            let transform = `translateY(${depth * 16}px) scale(${1 - depth * 0.045}) rotate(${depth === 0 ? 0 : depth % 2 ? 2.4 : -1.8}deg)`;
            if (top && fly) transform = `translateX(${fly * 130}%) rotate(${fly * 22}deg)`;
            else if (top && drag) transform = `translateX(${drag}px) rotate(${drag / 18}deg)`;

            return (
              <article
                key={r.id}
                className={styles.card}
                data-top={top ? "" : undefined}
                data-dragging={top && drag && !fly ? "" : undefined}
                aria-roledescription="слайд"
                aria-label={`Відгук ${k + 1} з ${count}`}
                aria-hidden={!top}
                inert={!top}
                style={{
                  transform,
                  zIndex: count - k,
                  opacity: (top && fly) || k > BEHIND ? 0 : 1,
                }}
                onPointerDown={top ? onPointerDown : undefined}
                onPointerMove={top ? onPointerMove : undefined}
                onPointerUp={top ? onPointerUp : undefined}
                onPointerCancel={top ? onPointerUp : undefined}
                onClickCapture={(e) => {
                  if (!dragged.current) return;
                  dragged.current = false;
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <div className={styles.media}>
                  {r.pair ? (
                    <Pair before={r.pair.before} after={r.pair.after} device={r.device} />
                  ) : r.image ? (
                    <a href={r.image} target="_blank" rel="noopener" className={styles.photo} draggable={false}>
                      <Image src={r.image} alt="Фото виконаної роботи" fill sizes="(max-width: 820px) 90vw, 460px" draggable={false} />
                    </a>
                  ) : r.deviceImage ? (
                    <div className={styles.modelTile}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.deviceImage} alt={r.device ?? ""} loading="lazy" draggable={false} />
                    </div>
                  ) : (
                    <div className={styles.quoteTile} aria-hidden="true">
                      <span className={styles.quoteMark}>“</span>
                      {r.device && <span className={styles.quoteDevice}>{r.device}</span>}
                    </div>
                  )}
                </div>

                <div className={styles.body}>
                  <div className={styles.meta}>
                    <Stars rating={r.rating} />
                    {r.device && <span className={styles.chip}>{r.device}</span>}
                    <span className={styles.date}>{r.date}</span>
                  </div>

                  <ReviewText text={r.text} />

                  <footer className={styles.author}>
                    <Avatar name={r.name} src={r.avatar} />
                    <span className={styles.who}>
                      <span className={styles.name}>{r.name}</span>
                      {r.city && <span className={styles.place}>{r.city}</span>}
                    </span>
                    {r.viaGoogle && <GoogleMark />}
                  </footer>
                </div>
              </article>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <button type="button" className={styles.arrowPrev} onClick={back} aria-label="Попередній відгук">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className={styles.arrowNext} onClick={() => throwCard(-1)} aria-label="Наступний відгук">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className={styles.controls}>
          <span className={styles.dots} aria-live="polite">
            <span className="visually-hidden">
              Відгук {index + 1} з {count}
            </span>
            {reviews.map((r, i) => (
              <span key={r.id} className={i === index ? styles.dotOn : styles.dot} aria-hidden="true" />
            ))}
          </span>
        </div>
      )}
    </section>
  );
}

/** Текст відгуку: довгий згорнутий до кількох рядків, з кнопкою розгорнути */
function ReviewText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG_TEXT;

  return (
    <div className={styles.textWrap}>
      <blockquote className={long && !open ? styles.textClamp : styles.text}>{text}</blockquote>
      {long && (
        <button type="button" className={styles.more} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Згорнути" : "Читати повністю"}
        </button>
      )}
    </div>
  );
}

/** Фото до і після від клієнта — два окремі кадри поруч, кожен відкривається повністю */
function Pair({ before, after, device }: { before: string; after: string; device: string | null }) {
  const label = device ? `${device} ` : "";
  return (
    <div className={styles.pair}>
      {[
        { src: before, tag: "До", alt: `${label}до ремонту`, cls: styles.tagBefore },
        { src: after, tag: "Після", alt: `${label}після ремонту`, cls: styles.tagAfter },
      ].map((p) => (
        <a key={p.tag} href={p.src} target="_blank" rel="noopener" className={styles.pairPhoto} draggable={false}>
          <Image src={p.src} alt={p.alt} fill sizes="(max-width: 820px) 45vw, 230px" draggable={false} />
          <span className={p.cls}>{p.tag}</span>
        </a>
      ))}
    </div>
  );
}

function Stars({ rating, size }: { rating: number; size?: "lg" }) {
  return (
    <span className={size === "lg" ? styles.starsLg : styles.stars} role="img" aria-label={`${rating} з 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={n <= rating ? styles.star : styles.starOff}
          style={{ "--i": n - 1 } as React.CSSProperties}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  // Адреса аватара живе в акаунті клієнта й може протухнути — тоді літера
  const [broken, setBroken] = useState(false);
  const cls = styles.avatar;

  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cls} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className={`${cls} ${styles.initial}`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

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
