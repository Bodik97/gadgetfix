"use client";

import { useRef, useTransition } from "react";
import { WARRANTY_TERMS } from "@/data/warranty";
import { setWarranty } from "./actions";
import styles from "./page.module.css";

const dateFormat = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kyiv" });

/**
 * Строк гарантії для заявки. Майстер обирає його за тим, що саме поставив:
 * оригінальний екран і аналог — це різні строки, а з назви послуги цього не
 * видно. Після видачі тут же видно, до якої дати гарантія діє.
 */
export default function WarrantyField({
  id,
  days,
  until,
  active,
  handedOver,
}: {
  id: string;
  /** Обраний строк або запропонований за видом роботи */
  days: number;
  until: Date | null;
  /** Гарантія ще не минула — рахує сервер */
  active: boolean;
  /** Пристрій уже видано — гарантія йде */
  handedOver: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  const state = !handedOver
    ? "почнеться з дня видачі"
    : !until
      ? "без гарантії"
      : active
        ? `діє до ${dateFormat.format(until)}`
        : `завершилась ${dateFormat.format(until)}`;

  return (
    <form ref={formRef} action={setWarranty} className={styles.warranty}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`warranty-${id}`} className={styles.warrantyLabel}>
        Гарантія
      </label>
      <select
        id={`warranty-${id}`}
        name="days"
        defaultValue={days}
        className={styles.warrantySelect}
        onChange={() => startTransition(() => formRef.current?.requestSubmit())}
      >
        {WARRANTY_TERMS.map((t) => (
          <option key={t.days} value={t.days}>
            {t.label} — {t.scope}
          </option>
        ))}
      </select>
      <span className={styles.hint} aria-live="polite">
        {pending ? "Зберігаємо…" : state}
      </span>
    </form>
  );
}
