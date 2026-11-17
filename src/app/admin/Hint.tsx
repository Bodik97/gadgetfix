"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HINTS, type HintKey } from "@/data/hints";
import styles from "./Hint.module.css";

/**
 * Значок «?» з підказкою. Натиснув — пояснення під значком;
 * ще раз, Esc або клік деінде — закрилось. Працює й пальцем на телефоні.
 */
export default function Hint({ id, label }: { id: HintKey; label?: string }) {
  const [open, setOpen] = useState(false);
  // Де показати підказку — рахуємо від значка й тримаємо в межах екрана
  const [place, setPlace] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Підказка стоїть на місці екрана — при гортанні вона б відʼїхала від значка, тож закриваємо
    // Перші пів секунди не рахуємо: браузер сам підкручує сторінку до значка, на який натиснули
    const since = Date.now();
    const scroll = () => {
      if (Date.now() - since > 500) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scroll, { capture: true });
    };
  }, [open]);

  return (
    <span ref={box} className={styles.wrap}>
      <button
        type="button"
        className={open ? styles.qOn : styles.q}
        aria-label={`Підказка${label ? `: ${label}` : ""}`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={(e) => {
          // Значок буває всередині label чи кнопки — не чіпати їх
          e.preventDefault();
          e.stopPropagation();
          const r = box.current?.getBoundingClientRect();
          if (r) {
            const width = Math.min(300, window.innerWidth - 24);
            const left = Math.min(Math.max(12, r.left - 12), window.innerWidth - width - 12);
            // Біля низу екрана (нижня панель) — відкриваємо вгору
            const up = r.bottom > window.innerHeight - 180;
            setPlace(up ? { bottom: window.innerHeight - r.top + 8, left, width } : { top: r.bottom + 8, left, width });
          }
          setOpen(!open);
        }}
      >
        ?
      </button>
      {open && (
        <span
          id={tipId}
          role="note"
          className={styles.tip}
          style={place ?? undefined}
        >
          {HINTS[id]}
        </span>
      )}
    </span>
  );
}
