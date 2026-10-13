"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StepDeck.module.css";

export type DeckStep = {
  no: string;
  who: string;
  when: string;
  title: string;
  body: string;
};

/** Скільки часу картка лежить зверху, поки колода гортається сама */
const AUTOPLAY_MS = 4200;
/** Скільки карток видно позаду верхньої — решта ховається в колоді */
const VISIBLE_BEHIND = 3;

/**
 * Кроки ремонту як колода карт: зверху поточний крок, позаду — наступні.
 * Поки людина не втрутилась, колода гортається сама; будь-яке натискання
 * зупиняє автопрогравання назавжди — далі людина гортає у своєму темпі.
 */
export default function StepDeck({ steps }: { steps: DeckStep[] }) {
  const [active, setActive] = useState(0);
  /** Картка, що щойно пішла з верху — їй програємо «відліт» */
  const [leaving, setLeaving] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  /** Колоду вже гортали — підказка-«підморгування» більше не потрібна */
  const [moved, setMoved] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const swipeX = useRef<number | null>(null);

  const n = steps.length;

  const go = (next: number, manual = true) => {
    const target = (next + n) % n;
    if (target === active) return;
    if (manual) setAuto(false);
    setMoved(true);
    // Відлітає лише при русі вперед; назад картка просто повертається з колоди
    setLeaving(target === (active + 1) % n ? active : null);
    setActive(target);
  };

  // Гортаємо самі лише тоді, коли колоду видно
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // Тим, хто просив менше руху, колода сама не гортається
    if (!auto || !inView || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => go(active + 1, false), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
    // go змінюється щорендеру, а залежить лише від active — його й слухаємо
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, inView, active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(active + 1);
    if (e.key === "ArrowLeft") go(active - 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    swipeX.current = e.clientX;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeX.current === null) return;
    const dx = e.clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) < 40) return;
    go(dx < 0 ? active + 1 : active - 1);
  };

  const step = steps[active];

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="region"
      aria-roledescription="карусель"
      aria-label="Як проходить ремонт поштою"
      onKeyDown={onKey}
    >
      {/* Колода */}
      <div className={styles.deckWrap}>
        {/* Що тут можна робити — окремо для миші й для пальця */}
        <p className={styles.hint}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 15a1.5 1.5 0 0 1 2.5-1.7L9 16" />
          </svg>
          <span className={styles.hintPointer}>Тисніть «Далі» або на будь-який крок праворуч</span>
          <span className={styles.hintTouch}>Гортайте картку пальцем ← → або тисніть «Далі»</span>
        </p>

        <div
          className={styles.deck}
          data-hint={(inView && !moved) || undefined}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {steps.map((s, i) => {
            const offset = (i - active + n) % n;
            const hidden = offset > VISIBLE_BEHIND;
            return (
              <article
                key={s.no}
                className={`${styles.card} ${i === leaving ? styles.leaving : ""}`}
                // Ілюстрації намальовані під темну картку — вона темна в обох темах
                data-theme="dark"
                data-active={offset === 0 || undefined}
                aria-hidden={offset !== 0}
                onAnimationEnd={() => setLeaving(null)}
                style={
                  {
                    "--offset": Math.min(offset, VISIBLE_BEHIND + 1),
                    zIndex: n - offset,
                    opacity: hidden ? 0 : 1,
                  } as React.CSSProperties
                }
              >
                <div className={styles.cardHead}>
                  <span className={styles.no}>{s.no}</span>
                  <span className={styles.who} data-who={s.who}>
                    {s.who}
                  </span>
                </div>

                <div className={styles.art} aria-hidden="true">
                  <StepArt no={s.no} />
                </div>

                <h3 className={styles.title}>{s.title}</h3>
                <p className={styles.body}>{s.body}</p>

                <div className={styles.foot}>
                  <div className={styles.when}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    {s.when}
                  </div>

                  {/* Головна підказка, що колоду можна гортати: кнопка прямо на картці */}
                  <button
                    type="button"
                    className={styles.next}
                    onClick={() => go(i + 1)}
                    tabIndex={offset === 0 ? undefined : -1}
                  >
                    {i === n - 1 ? "Ще раз спочатку" : `Далі: ${steps[i + 1].title}`}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {i === n - 1 ? (
                        <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
                      ) : (
                        <>
                          <path d="M5 12h13" />
                          <path d="M13 6l6 6-6 6" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>

                {/* Смужка часу до наступної картки — лише поки колода гортається сама */}
                {offset === 0 && auto && inView && <span key={active} className={styles.timer} />}
              </article>
            );
          })}
        </div>

        <div className={styles.controls}>
          <button type="button" className={styles.arrow} onClick={() => go(active - 1)} aria-label="Попередній крок">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H6" />
              <path d="M11 6l-6 6 6 6" />
            </svg>
          </button>
          <span className={styles.counter} aria-live="polite">
            Крок {active + 1} з {n}: {step.title}
          </span>
          <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} onClick={() => go(active + 1)} aria-label="Наступний крок">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Маршрут: усі кроки разом, із прогресом до поточного */}
      <ol className={styles.route} style={{ "--progress": active / (n - 1) } as React.CSSProperties}>
        {steps.map((s, i) => (
          <li key={s.no} className={styles.stop} data-state={i < active ? "done" : i === active ? "now" : undefined}>
            <button type="button" className={styles.stopBtn} onClick={() => go(i)} aria-current={i === active ? "step" : undefined}>
              <span className={styles.dot}>
                {i < active ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  s.no
                )}
              </span>
              <span className={styles.stopText}>
                <span className={styles.stopTitle}>{s.title}</span>
                <span className={styles.stopMeta}>
                  {s.who} · {s.when}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Ілюстрація кроку: прості лінії в акцентному кольорі й одна дія, що повторюється */
function StepArt({ no }: { no: string }) {
  const common = {
    width: "100%",
    height: "100%",
    viewBox: "0 0 160 100",
    fill: "none",
    stroke: "#DCF35A",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (no) {
    // Заявка: форма на телефоні, у відповідь — дзвінок майстра
    case "01":
      return (
        <svg {...common}>
          <rect x="34" y="12" width="44" height="78" rx="9" opacity=".9" />
          <path d="M44 32h24M44 44h24M44 56h16" opacity=".5" />
          <rect x="44" y="66" width="24" height="10" rx="5" fill="#DCF35A" stroke="none" />
          <g className={styles.pop}>
            <path d="M92 26h44a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-30l-10 9v-9h-4a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8z" />
            <text x="114" y="46" fill="#DCF35A" stroke="none" fontSize="11" textAnchor="middle" fontFamily="inherit">дзвінок</text>
          </g>
        </svg>
      );
    // Відправка: коробка їде до нас
    case "02":
      return (
        <svg {...common}>
          <path d="M10 82h140" strokeDasharray="4 7" opacity=".4" />
          <g className={styles.drive}>
            <path d="M40 40l22-10 22 10v26l-22 10-22-10z" />
            <path d="M40 40l22 10 22-10M62 50v26" opacity=".7" />
          </g>
          <path d="M120 40h22M134 32l8 8-8 8" className={styles.nudge} />
        </svg>
      );
    // Діагностика: лупа проходить по платі
    case "03":
      return (
        <svg {...common}>
          <rect x="30" y="18" width="100" height="64" rx="10" opacity=".5" />
          <path d="M46 34h18v14H46zM76 34h12M76 42h20M96 60h18M46 60h30M106 34v12" opacity=".5" />
          <g className={styles.scan}>
            <circle cx="70" cy="48" r="16" />
            <path d="M82 60l14 14" strokeWidth="4" />
          </g>
        </svg>
      );
    // Погодження: дзвінок і ваше «так»
    case "04":
      return (
        <svg {...common}>
          <rect x="26" y="14" width="40" height="72" rx="9" opacity=".9" />
          <path d="M74 36a14 14 0 0 1 0 22M82 30a24 24 0 0 1 0 34" className={styles.ring} />
          <g className={styles.pop}>
            <rect x="98" y="34" width="46" height="28" rx="14" fill="#DCF35A" stroke="none" />
            <path d="M110 48l6 6 12-12" stroke="#0B0C0E" strokeWidth="3" />
          </g>
        </svg>
      );
    // Передоплата: монета падає в слот
    case "05":
      return (
        <svg {...common}>
          <rect x="44" y="52" width="72" height="34" rx="8" />
          <path d="M64 52h32" strokeWidth="4" />
          <g className={styles.drop}>
            <circle cx="80" cy="26" r="13" fill="#DCF35A" stroke="none" />
            <text x="80" y="31" fill="#0B0C0E" stroke="none" fontSize="14" fontWeight="700" textAnchor="middle" fontFamily="inherit">₴</text>
          </g>
        </svg>
      );
    // Повернення: відремонтований телефон їде назад
    default:
      return (
        <svg {...common}>
          <path d="M10 82h140" strokeDasharray="4 7" opacity=".4" />
          <g className={styles.driveBack}>
            <path d="M76 40l22-10 22 10v26l-22 10-22-10z" />
            <path d="M88 52l7 7 13-13" strokeWidth="3" />
          </g>
          <path d="M40 40H18M26 32l-8 8 8 8" className={styles.nudge} />
        </svg>
      );
  }
}
