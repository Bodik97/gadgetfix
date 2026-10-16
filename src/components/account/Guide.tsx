"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./Guide.module.css";

/**
 * Інструкція до кабінету — згорнута плашка, що розгортається в покрокову
 * екскурсію. Кожен крок має живу міні-сцену і кнопку «Показати на сторінці»:
 * вона гортає до потрібного блоку й на мить підсвічує його, тож людина бачить
 * не опис, а саме місце, де натискати.
 */

type Scene = "stage" | "chat" | "telegram" | "delivery" | "warranty" | "review";

type Step = {
  scene: Scene;
  title: string;
  text: string;
  /** Блок кабінету з data-guide=… — куди веде «Показати на сторінці» */
  target: string[];
  /** Що сказати, коли такого блоку на сторінці ще немає */
  missing: string;
};

const steps: Step[] = [
  {
    scene: "stage",
    title: "Етап ремонту — без дзвінків",
    text: "У блоці «Зараз у роботі» видно, що відбувається з пристроєм просто зараз. Сторінка оновлюється сама, перезавантажувати не треба.",
    target: ["stage"],
    missing: "Блок зʼявиться, щойно ми приймемо ваш пристрій у роботу.",
  },
  {
    scene: "chat",
    title: "Питання — одразу майстру",
    text: "У картці ремонту натисніть «Написати майстру». Можна додати фото, а відповідь прийде сюди ж.",
    target: ["chat"],
    missing: "Чат зʼявиться в картці ремонту, коли пристрій буде в роботі.",
  },
  {
    scene: "telegram",
    title: "Статус у Telegram",
    text: "Натисніть «Статус у Telegram», а в боті — «Start». Він сам напише про кожен етап і про погоджену ціну.",
    target: ["chat"],
    missing: "Кнопка зʼявиться в картці ремонту, коли пристрій буде в роботі.",
  },
  {
    scene: "delivery",
    title: "Готово — заберіть або отримайте поштою",
    text: "Коли ремонт завершено, в картці зʼявиться кнопка доставки Новою Поштою. Або просто заберіть пристрій у сервісі.",
    target: ["delivery", "stage"],
    missing: "Кнопка доставки зʼявиться в картці, щойно пристрій буде готовий.",
  },
  {
    scene: "warranty",
    title: "Гарантія завжди під рукою",
    text: "Нижче видно, до якої дати діє гарантія на кожен пристрій, і всі ваші завершені ремонти.",
    target: ["warranty", "history"],
    missing: "Гарантія зʼявиться тут після видачі першого ремонту.",
  },
  {
    scene: "review",
    title: "Відгук — і мінус 15%",
    text: "Розкажіть, як усе пройшло, і додайте фото до і після. Після перевірки отримаєте знижку 15% на наступний ремонт.",
    target: ["review"],
    missing: "Форма відгуку — внизу сторінки.",
  },
];

/** Гортає до блоку й на мить підсвічує його. Повертає false, якщо блоку немає. */
function showOnPage(targets: string[]): boolean {
  for (const name of targets) {
    const el = document.querySelector<HTMLElement>(`[data-guide="${name}"]`);
    if (!el) continue;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    // Скидаємо атрибут, щоб повторне натискання знову запускало спалах
    el.removeAttribute("data-guide-flash");
    void el.offsetWidth;
    el.setAttribute("data-guide-flash", "");
    window.setTimeout(() => el.removeAttribute("data-guide-flash"), 2600);
    return true;
  }
  return false;
}

export default function Guide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const panelId = useId();
  const touchX = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const current = steps[step];
  const last = step === steps.length - 1;

  const clamp = (n: number) => Math.max(0, Math.min(steps.length - 1, n));
  const go = (next: number) => {
    setStep(clamp(next));
    setNote("");
  };
  // Від поточного кроку, а не від того, що бачив рендер: швидкі натискання не губляться
  const shift = (by: number) => {
    setStep((s) => clamp(s + by));
    setNote("");
  };

  // Розгорнули — фокус на панель, щоб стрілки клавіатури одразу гортали кроки
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  const show = () => setNote(showOnPage(current.target) ? "" : current.missing);

  if (!open) {
    return (
      <button type="button" className={styles.bar} aria-expanded={false} aria-controls={panelId} onClick={() => setOpen(true)}>
        <span className={styles.badge} aria-hidden="true">?</span>
        <span className={styles.barText}>
          <span className={styles.barTitle}>Інструкція до кабінету</span>
          <span className={styles.barSub}>{steps.length} коротких кроків · хвилина часу</span>
        </span>
        <span className={styles.barAction}>
          Відкрити
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <section
      id={panelId}
      ref={panelRef}
      className={styles.panel}
      aria-label="Інструкція до кабінету"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") shift(1);
        if (e.key === "ArrowLeft") shift(-1);
        if (e.key === "Escape") setOpen(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 48) shift(dx < 0 ? 1 : -1);
      }}
    >
      <div className={styles.top}>
        <span className={styles.counter}>
          Крок {step + 1} з {steps.length}
        </span>

        <div className={styles.dots} role="tablist" aria-label="Кроки інструкції">
          {steps.map((s, i) => (
            <button
              key={s.scene}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Крок ${i + 1}: ${s.title}`}
              className={i === step ? styles.dotOn : i < step ? styles.dotDone : styles.dot}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Згорнути інструкцію" title="Згорнути">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </div>

      {/* key перезапускає сцену й появу тексту на кожному кроці */}
      <div className={styles.body} key={current.scene} aria-live="polite">
        <div className={styles.scene} aria-hidden="true">
          <SceneArt scene={current.scene} />
        </div>

        <div className={styles.copy}>
          <h3 className={styles.title}>{current.title}</h3>
          <p className={styles.text}>{current.text}</p>

          <button type="button" className={styles.show} onClick={show}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            Показати на сторінці
          </button>
          {note && <p className={styles.note}>{note}</p>}
        </div>
      </div>

      <div className={styles.nav}>
        <button type="button" className={styles.prev} onClick={() => shift(-1)} disabled={step === 0}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Назад
        </button>

        {last ? (
          <button type="button" className={styles.next} onClick={() => { setOpen(false); go(0); }}>
            Зрозуміло
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </button>
        ) : (
          <button type="button" className={styles.next} onClick={() => shift(1)}>
            Далі
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}

/** Міні-сцени: телефон, у якому оживає саме те, про що крок */
function SceneArt({ scene }: { scene: Scene }) {
  return (
    <svg viewBox="0 0 160 160" className={styles.art}>
      {/* Телефон — спільна рамка для всіх сцен */}
      <rect x="44" y="14" width="72" height="132" rx="14" className={styles.phone} />
      <rect x="68" y="20" width="24" height="5" rx="2.5" className={styles.notch} />

      {scene === "stage" && (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i} className={styles.stageRow} style={{ "--i": i } as React.CSSProperties}>
              <circle cx="62" cy={46 + i * 24} r="6" className={styles.stageDot} />
              <rect x="74" y={42 + i * 24} width={30 - (i % 2) * 8} height="8" rx="4" className={styles.line} />
            </g>
          ))}
          <path d="M62 52V112" className={styles.stageTrack} />
          <path d="M62 52V112" className={styles.stageFill} />
        </g>
      )}

      {scene === "chat" && (
        <g>
          <rect x="52" y="42" width="44" height="20" rx="10" className={`${styles.bubble} ${styles.b1}`} />
          <rect x="64" y="70" width="44" height="20" rx="10" className={`${styles.bubbleMe} ${styles.b2}`} />
          <g className={styles.b3}>
            <rect x="52" y="98" width="36" height="20" rx="10" className={styles.bubble} />
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={62 + i * 8} cy="108" r="2.6" className={styles.typing} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </g>
        </g>
      )}

      {scene === "telegram" && (
        <g>
          <rect x="54" y="56" width="52" height="30" rx="9" className={`${styles.bubble} ${styles.toast}`} />
          <rect x="62" y="65" width="28" height="5" rx="2.5" className={`${styles.line} ${styles.toast}`} />
          <rect x="62" y="74" width="18" height="5" rx="2.5" className={`${styles.line} ${styles.toast}`} />
          <circle cx="106" cy="56" r="8" className={styles.ping} />
          <path d="M8 120l40-16-28-2z M20 102l6 12 22-10z" className={styles.plane} />
        </g>
      )}

      {scene === "delivery" && (
        <g>
          <g className={styles.box}>
            <path d="M60 74l20-10 20 10v24l-20 10-20-10z" className={styles.boxBody} />
            <path d="M60 74l20 10 20-10M80 84v24" className={styles.boxEdge} />
          </g>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${30 - i * 4} ${80 + i * 10}h${16 - i * 3}`} className={styles.speed} style={{ "--i": i } as React.CSSProperties} />
          ))}
          <circle cx="100" cy="112" r="10" className={styles.okDisk} />
          <path d="M95 112l3.5 3.5L106 108" className={styles.okTick} />
        </g>
      )}

      {scene === "warranty" && (
        <g>
          <path d="M80 44l26 10v20c0 18-11 30-26 36-15-6-26-18-26-36V54z" className={styles.shield} />
          <path d="M68 78l8 8 16-17" className={styles.shieldTick} />
          <rect x="60" y="122" width="40" height="8" rx="4" className={`${styles.line} ${styles.dateLine}`} />
        </g>
      )}

      {scene === "review" && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d="M0 -7l2.1 4.3 4.7.7-3.4 3.3.8 4.7L0 3.8l-4.2 2.2.8-4.7L-6.8-2l4.7-.7z"
              transform={`translate(${56 + i * 12} 62)`}
              className={styles.star}
              style={{ "--i": i } as React.CSSProperties}
            />
          ))}
          <g className={styles.tag}>
            <rect x="58" y="84" width="44" height="26" rx="8" className={styles.tagBody} />
            <text x="80" y="102" textAnchor="middle" className={styles.tagText}>−15%</text>
          </g>
        </g>
      )}
    </svg>
  );
}
