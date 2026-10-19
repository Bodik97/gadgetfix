"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthState } from "./auth/authStore";
import BookingForm from "./BookingForm";
import Logo from "./Logo";
import { services } from "@/data/services";
import styles from "./BookingModal.module.css";

type Opener = (preset?: { service?: string; model?: string }) => void;

const BookingContext = createContext<Opener | null>(null);

/** Відкрити вікно запису з будь-якої кнопки на сторінці */
export function useBooking(): Opener {
  const open = useContext(BookingContext);
  // Поза провайдером просто нічого не робимо — сторінка не має падати
  return open ?? (() => {});
}

export default function BookingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<{ service?: string; model?: string }>({});
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { isSignedIn } = useAuthState();

  // Нативний <dialog> сам тримає фокус усередині й закривається на Esc
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const openWith: Opener = (p) => {
    // Хто увійшов, замовляє з кабінету: контакти вже є, і там видно його знижку
    if (isSignedIn) {
      const q = new URLSearchParams();
      if (p?.service) q.set("service", p.service);
      if (p?.model) q.set("model", p.model);
      router.push(q.size ? `/moi-remonty?${q}` : "/moi-remonty");
      return;
    }
    setPreset(p ?? {});
    setOpen(true);
  };

  return (
    <BookingContext.Provider value={openWith}>
      {children}

      <dialog
        ref={ref}
        className={styles.dialog}
        aria-labelledby="booking-title"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
      >
        <div className={styles.body}>
          <button
            type="button"
            className={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Закрити"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>

          <div className={styles.head}>
            <Logo as="text" />
            <h2 id="booking-title" className={styles.title}>
              Залиште номер&nbsp;— передзвонимо
            </h2>
            <p className={styles.lead}>Підкажемо ціну й&nbsp;термін. Діагностика безкоштовна, якщо ремонтуємо в&nbsp;нас.</p>
          </div>

          {open && (
            <BookingForm
              source="landing"
              model={preset.model}
              select={{
                name: "service",
                label: "Що сталося",
                placeholder: "Оберіть послугу",
                options: services.map((s) => s.title),
              }}
              initialChoice={preset.service}
              bare
              simple
              submitLabel="Записатись"
            />
          )}
        </div>
      </dialog>
    </BookingContext.Provider>
  );
}
