"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { plural } from "./account/plural";
import styles from "./ReviewShowcase.module.css";

export type ReviewCard = {
  id: string;
  text: string;
  name: string;
  city: string | null;
  device: string | null;
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

/** Скільки показуємо один відгук, перш ніж перейти до наступного */
const AUTO_MS = 7000;
/** Довший текст ховаємо за «Читати повністю», щоб вітрина не стрибала у висоту */
const LONG_TEXT = 260;

/**
 * Відгуки вітриною: один великий відгук і стрічка решти під ним.
 *
 * Велика картка дає місце фото до і після й повному тексту, а стрічка
 * показує, скільки ще відгуків і де ми зараз. Сам перемикається раз на
 * кілька секунд, але щойно людина торкнулась блоку — керує вона.
 */
export default function ReviewShowcase({
  reviews,
  stats,
}: {
  reviews: ReviewCard[];
  stats: { count: number; average: number };
}) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  // Людина сама взялась гортати — автопрокрутку більше не вмикаємо
  const [manual, setManual] = useState(false);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const count = reviews.length;
  const current = reviews[index];
  const auto = count > 1 && !manual && !hover && visible && !still;

  const goTo = useCallback(
    (next: number, by: "user" | "auto" = "user") => {
      if (by === "user") setManual(true);
      setDir(next > index || (index === count - 1 && next === 0 && by === "auto") ? 1 : -1);
      setIndex(((next % count) + count) % count);
    },
    [count, index],
  );

  // Повага до «менше руху» і пауза, коли блок поза екраном чи вкладка прихована
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(media.matches);
    sync();
    media.addEventListener("change", sync);

    const el = rootRef.current;
    const seen = el
      ? new IntersectionObserver(([e]) => setVisible(e.isIntersecting && !document.hidden), { threshold: 0.35 })
      : null;
    if (el && seen) seen.observe(el);

    const onHidden = () => {
      if (document.hidden) setVisible(false);
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      media.removeEventListener("change", sync);
      seen?.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => goTo(index + 1, "auto"), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [auto, index, goTo]);

  // Активна міні-картка завжди видна у стрічці — гортаємо лише саму стрічку
  useEffect(() => {
    const rail = railRef.current;
    const item = rail?.children[index] as HTMLElement | undefined;
    if (!rail || !item) return;
    const left = item.offsetLeft - (rail.clientWidth - item.clientWidth) / 2;
    rail.scrollTo({ left, behavior: still ? "auto" : "smooth" });
  }, [index, still]);

  if (!current) return null;

  return (
    <section
      ref={rootRef}
      className={styles.root}
      aria-roledescription="карусель"
      aria-label="Відгуки клієнтів"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
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

      {/* Вітрина. key перезапускає анімацію появи на кожному відгуку */}
      <article
        key={current.id}
        className={styles.stage}
        data-dir={dir}
        aria-roledescription="слайд"
        aria-label={`Відгук ${index + 1} з ${count}`}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          // Свайп по повзунку порівняння — це рух повзунка, а не перехід
          if ((e.target as HTMLElement).closest("[data-compare]")) return;
          if (Math.abs(dx) > 50) goTo(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div className={styles.media}>
          {current.pair ? (
            <Compare before={current.pair.before} after={current.pair.after} device={current.device} still={still} />
          ) : current.image ? (
            <a href={current.image} target="_blank" rel="noopener" className={styles.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.image} alt="Фото виконаної роботи" />
            </a>
          ) : (
            <div className={styles.quoteTile} aria-hidden="true">
              <span className={styles.quoteMark}>“</span>
              {current.device && <span className={styles.quoteDevice}>{current.device}</span>}
            </div>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.meta}>
            <Stars rating={current.rating} />
            {current.device && <span className={styles.chip}>{current.device}</span>}
            <span className={styles.date}>{current.date}</span>
          </div>

          <ReviewText key={current.id} text={current.text} />

          <footer className={styles.author}>
            <Avatar name={current.name} src={current.avatar} />
            <span className={styles.who}>
              <span className={styles.name}>{current.name}</span>
              {current.city && <span className={styles.place}>{current.city}</span>}
            </span>
            {current.viaGoogle && <GoogleMark />}
          </footer>
        </div>
      </article>

      {count > 1 && (
        <div className={styles.nav}>
          <div className={styles.rail} ref={railRef} role="tablist" aria-label="Оберіть відгук">
            {reviews.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={i === index ? styles.thumbOn : styles.thumb}
                onClick={() => goTo(i)}
              >
                <Avatar name={r.name} src={r.avatar} small />
                <span className={styles.thumbText}>
                  <span className={styles.thumbName}>
                    {r.name}
                    {r.pair && (
                      <span className={styles.thumbBadge} title="Є фото до і після">
                        до/після
                      </span>
                    )}
                  </span>
                  <span className={styles.thumbQuote}>{r.text}</span>
                </span>
                {/* Таймер автопрокрутки — видно, коли зміниться відгук */}
                {i === index && auto && <span className={styles.timer} style={{ animationDuration: `${AUTO_MS}ms` }} />}
              </button>
            ))}
          </div>

          <div className={styles.controls}>
            <button type="button" className={styles.arrow} onClick={() => goTo(index - 1)} aria-label="Попередній відгук">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <span className={styles.counter} aria-live="polite">
              <strong>{index + 1}</strong> / {count}
            </span>
            <button type="button" className={styles.arrow} onClick={() => goTo(index + 1)} aria-label="Наступний відгук">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
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

/**
 * Повзунок «до/після»: фото «після» лежить зверху й відрізається по ручці.
 * Під капотом — звичайний range: працює пальцем, мишкою й стрілками клавіатури.
 * Уперше на екрані ручка сама «показує» рух, щоб було зрозуміло, що її тягнуть.
 */
function Compare({ before, after, device, still }: { before: string; after: string; device: string | null; still: boolean }) {
  const [pos, setPos] = useState(50);
  const [hinted, setHinted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (still || hinted) return;
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const seen = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        seen.disconnect();
        setHinted(true);
        // 50 → 72 → 28 → 50 за ~1,6 с — легке «погойдування»
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1600);
          setPos(50 + Math.sin(t * Math.PI * 2) * 22 * (1 - t * 0.2));
          if (t < 1) frame = requestAnimationFrame(tick);
          else setPos(50);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [still, hinted]);

  const label = device ? `${device}: до і після ремонту` : "До і після ремонту";

  return (
    <div ref={ref} className={styles.compare} data-compare="" style={{ "--pos": `${pos}%` } as React.CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={`${label} — до`} className={styles.compareImg} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${label} — після`} className={`${styles.compareImg} ${styles.compareAfter}`} />

      <span className={styles.tagBefore}>До</span>
      <span className={styles.tagAfter}>Після</span>

      <span className={styles.handle} aria-hidden="true">
        <span className={styles.knob}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </span>
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => {
          setHinted(true);
          setPos(Number(e.target.value));
        }}
        className={styles.range}
        aria-label="Порівняти фото до і після: тягніть"
      />
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

function Avatar({ name, src, small }: { name: string; src: string | null; small?: boolean }) {
  // Адреса аватара живе в акаунті клієнта й може протухнути — тоді літера
  const [broken, setBroken] = useState(false);
  const cls = small ? styles.avatarSm : styles.avatar;

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
