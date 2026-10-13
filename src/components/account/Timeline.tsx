"use client";

import { useState } from "react";
import type { LeadEvent } from "@/db/schema";
import styles from "./Timeline.module.css";

const stamp = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

export default function Timeline({ events }: { events: LeadEvent[] }) {
  const [open, setOpen] = useState(false);

  if (events.length === 0) return null;

  // Останню подію показуємо завжди — решту ховаємо, щоб картка не розросталась
  const latest = events[events.length - 1];
  const shown = open ? events : [latest];

  return (
    <div className={styles.wrap}>
      <ol className={styles.list}>
        {shown.map((e, i) => {
          const isLast = open ? i === shown.length - 1 : true;
          return (
            <li key={e.id} className={styles.item}>
              <span className={isLast ? styles.dotNow : styles.dot} aria-hidden="true" />
              <div className={styles.body}>
                <span className={styles.text}>{e.text}</span>
                <time className={styles.time}>{stamp.format(e.createdAt)}</time>
              </div>
            </li>
          );
        })}
      </ol>

      {events.length > 1 && (
        <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)}>
          {open ? "Згорнути хроніку" : `Показати всю хроніку · ${events.length}`}
        </button>
      )}
    </div>
  );
}
