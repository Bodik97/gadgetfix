"use client";

import { useActionState, useState } from "react";
import { requestDelivery, type DeliveryResult } from "@/app/moi-remonty/actions";
import FormError from "../FormError";
import styles from "./DeliveryRequest.module.css";

export default function DeliveryRequest({
  id,
  requested,
  address,
}: {
  id: string;
  requested: boolean;
  address: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Адресу тримаємо в стані: після невдалої спроби форма не має спорожніти
  const [place, setPlace] = useState("");
  const [state, action, pending] = useActionState<DeliveryResult | null, FormData>(requestDelivery, null);

  if (requested || state?.ok) {
    return (
      <div className={styles.done}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.5 2.5L16 9.5" />
        </svg>
        <div>
          Запит на відправку прийнято{address || place ? <> — {address || place.trim()}</> : null}. Надішлемо накладну, щойно
          передамо посилку.
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className={styles.offer}>
        <div className={styles.offerText}>Не можете заїхати? Надішлемо Новою Поштою за наш кошт.</div>
        <button type="button" className="btn btn-accent" onClick={() => setOpen(true)}>
          Надіслати поштою
        </button>
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`addr-${id}`} className={styles.label}>
        Місто й відділення Нової Пошти
      </label>
      <div className={styles.row}>
        <input
          id={`addr-${id}`}
          name="address"
          className="field"
          type="text"
          required
          minLength={5}
          placeholder="Напр. Тернопіль, відділення 12"
          autoFocus
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
        <button type="submit" className="btn btn-accent" disabled={pending}>
          {pending ? "Надсилаємо…" : "Замовити відправку"}
        </button>
      </div>
      <FormError>{state && !state.ok ? state.error : null}</FormError>
      <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={pending}>
        Скасувати
      </button>
    </form>
  );
}
