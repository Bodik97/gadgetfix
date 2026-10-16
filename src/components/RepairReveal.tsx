"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./RepairReveal.module.css";

export type RevealPair = {
  id: string;
  before: string;
  after: string;
  device: string | null;
  name: string;
  rating: number;
  text: string;
};

/** Скільки екранів скролу припадає на одну пару — менше, і ремонт «пролітає» */
const SCREENS_PER_PAIR = 1.1;

/** Розріз іде не весь відрізок: на початку видно «до», наприкінці — готове «після» */
function reveal(t: number): number {
  const x = Math.min(1, Math.max(0, (t - 0.12) / 0.66));
  return x * x * (3 - 2 * x) * 100;
}

/**
 * «Ремонт на очах»: блок прилипає до екрана, і поки людина гортає, лінія
 * розрізу проходить по фото — розбитий пристрій стає цілим. Потім наступна
 * пара. Фото надіслали самі клієнти разом із відгуком.
 */
export default function RepairReveal({ pairs }: { pairs: RevealPair[] }) {
  const rootRef = useRef<HTMLElement>(null);
  const frames = useRef<(HTMLElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  // Без анімацій — просто показуємо пари поруч, нічого не прилипає
  const [still, setStill] = useState(false);
  const count = pairs.length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (still) return;
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const run = rect.height - window.innerHeight;
      const progress = run > 0 ? Math.min(1, Math.max(0, -rect.top / run)) : 0;
      const p = progress * count;
      const i = Math.min(count - 1, Math.floor(p));

      frames.current.forEach((el, n) => {
        // Пройдені пари лишаються «після», наступні чекають у «до»
        const pos = n < i ? 100 : n > i ? 0 : reveal(p - i);
        el?.style.setProperty("--pos", `${pos}%`);
        // На краях лінія не потрібна: видно чисте «до» або вже готове «після»
        el?.toggleAttribute("data-edge", pos === 0 || pos === 100);
      });
      setIndex(i);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [still, count]);

  const current = pairs[index];

  return (
    <section
      ref={rootRef}
      className={styles.root}
      data-still={still ? "" : undefined}
      style={{ "--screens": count * SCREENS_PER_PAIR } as React.CSSProperties}
      aria-label="Фото до і після ремонту"
    >
      <div className={styles.sticky}>
        <div className={styles.head}>
          <h2 className={styles.title}>Ремонт на очах</h2>
          <p className={styles.note}>
            {still ? "Фото до і після надіслали самі клієнти." : "Гортайте — і пристрій ремонтується. Фото надіслали самі клієнти."}
          </p>
        </div>

        <div className={styles.stage}>
          {pairs.map((p, n) => {
            const label = p.device ? `${p.device}: ` : "";
            return (
              <figure
                key={p.id}
                ref={(el) => {
                  frames.current[n] = el;
                }}
                className={styles.frame}
                data-active={still || n === index ? "" : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.before} alt={`${label}до ремонту`} className={styles.img} loading={n === 0 ? "eager" : "lazy"} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.after} alt={`${label}після ремонту`} className={`${styles.img} ${styles.after}`} loading={n === 0 ? "eager" : "lazy"} />
                <span className={styles.cut} aria-hidden="true" />
                <span className={styles.tagBefore}>До</span>
                <span className={styles.tagAfter}>Після</span>

                {still && <Caption pair={p} />}
              </figure>
            );
          })}
        </div>

        {!still && (
          <div className={styles.foot}>
            <Caption pair={current} key={current.id} />
            {count > 1 && (
              <div className={styles.steps} aria-hidden="true">
                {pairs.map((p, n) => (
                  <span key={p.id} className={n <= index ? styles.stepOn : styles.step} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Caption({ pair }: { pair: RevealPair }) {
  return (
    <div className={styles.caption}>
      <span className={styles.meta}>
        <span className={styles.stars} role="img" aria-label={`${pair.rating} з 5`}>
          {"★".repeat(pair.rating)}
        </span>
        {pair.device && <strong className={styles.device}>{pair.device}</strong>}
        <span className={styles.name}>{pair.name}</span>
      </span>
      <q className={styles.quote}>{pair.text}</q>
    </div>
  );
}
