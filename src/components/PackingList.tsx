"use client";

import { useState } from "react";
import { packingList } from "@/data/mailIn";
import styles from "./PackingList.module.css";

export default function PackingList() {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  return (
    <div className={styles.list}>
      {packingList.map((label, i) => {
        const on = Boolean(checked[i]);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => setChecked((s) => ({ ...s, [i]: !s[i] }))}
            className={on ? styles.itemOn : styles.item}
          >
            <span className={on ? styles.boxOn : styles.box}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: on ? 1 : 0 }} aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
