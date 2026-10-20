"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./CoachMark.module.css";

// Значення змінюємо лише самі, у цій же вкладці, — підписуватись нема на що
const noSubscribe = () => () => {};

/**
 * Разова підказка «що тут і як»: показуємо, доки людина не натисне
 * «Зрозуміло», і більше не повертаємось. id — окремий ключ у localStorage.
 */
export default function CoachMark({ id, children }: { id: string; children: React.ReactNode }) {
  const key = `gf-tip-${id}`;
  // На сервері вважаємо «вже бачив»: так підказка не блимає в того, хто її закрив
  const seen = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return Boolean(localStorage.getItem(key));
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [closed, setClosed] = useState(false);
  if (seen || closed) return null;

  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Не запамʼятали — наступного разу просто покажемо ще раз
    }
  };

  return (
    <div className={styles.tip} role="note">
      <span className={styles.icon} aria-hidden="true">
        💡
      </span>
      <span className={styles.text}>{children}</span>
      <button type="button" className={styles.ok} onClick={close}>
        Зрозуміло
      </button>
    </div>
  );
}
