"use client";

import { useState } from "react";
import styles from "./PasswordInput.module.css";

/** Поле пароля з оком: показати набране, щоб не заплутатись */
export default function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);

  return (
    <div className={styles.wrap}>
      <input className="field" {...props} type={shown ? "text" : "password"} />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Сховати пароль" : "Показати пароль"}
        aria-pressed={shown}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
