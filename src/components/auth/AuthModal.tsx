"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthShell from "./AuthShell";
import SignInForm from "./SignInForm";
import { startsWithSignUp } from "./authStore";
import styles from "./AuthModal.module.css";

export default function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  // Нативний <dialog> сам тримає фокус усередині, закривається на Esc
  // і малює підкладку — власний код для цього не потрібен
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Поки вікно відкрите, сторінка під ним не має прокручуватись
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Кнопка входу живе в шапці, а шапка завжди темна (data-theme="dark").
  // Вікно виносимо в body — щоб воно йшло за темою сторінки, а не шапки.
  // На сервері вікна немає: кнопка зʼявляється лише після завантаження Clerk.
  if (typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="auth-title"
      onClose={onClose}
      // Клік по підкладці — це клік по самому <dialog>, а не по вмісту
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.body}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрити">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>

        {/* Лише коли відкрите: закрите вікно інакше тримало б у DOM другу форму
            з тими самими id (v-email, clerk-captcha), що й сторінка /vhid,
            а 3D-логотип вантажив би Three.js без потреби */}
        {open && (
          <AuthShell
            compact
            titleId="auth-title"
            // Відкрили з «Отримати −5%» — нагадуємо, заради чого реєструються
            title={startsWithSignUp() ? "Ваші −5% на перший ремонт" : "Кабінет клієнта"}
            lead={
              startsWithSignUp()
                ? "Створіть кабінет за хвилину — знижка запрацює одразу."
                : "Статус ремонту, посилка й гарантія — в одному місці."
            }
          >
            <SignInForm onDone={onClose} bare />
          </AuthShell>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
