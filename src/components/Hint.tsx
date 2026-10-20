"use client";

import { useId, useState } from "react";
import styles from "./Hint.module.css";

/**
 * Маленьке «?» з поясненням поруч із тим, що може бути незрозумілим:
 * ціна, передоплата, етапи, знижка. Натиснули — пояснення під ним, ще раз — сховали.
 */
export default function Hint({ text, label = "Що це?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={open ? styles.btnOn : styles.btn}
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className={styles.note}>
          {text}
        </span>
      )}
    </span>
  );
}
