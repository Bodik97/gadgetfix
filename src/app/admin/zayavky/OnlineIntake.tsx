"use client";

import { useActionState, useRef, useState } from "react";
import type { PartnerPrice } from "@/db/schema";
import { createOnlineLead } from "./actions";
import styles from "./board.module.css";

/**
 * Швидкий прийом від магазину «Онлайн» — один рядок над дошкою:
 * № квитанції магазину, робота з його прайсу (ціна підставляється сама), примітка.
 */
export default function OnlineIntake({ prices }: { prices: PartnerPrice[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [priceId, setPriceId] = useState(prices[0]?.id ?? "");
  const [error, action, pending] = useActionState(async (prev: string | null, data: FormData) => {
    const res = await createOnlineLead(prev, data);
    // Додали — чистимо № і примітку, роботу лишаємо: магазин часто несе однакові
    if (res === null) {
      form.current?.querySelectorAll<HTMLInputElement>("input[type=text]").forEach((i) => (i.value = ""));
      form.current?.querySelector<HTMLInputElement>("#on-ext")?.focus();
    }
    return res;
  }, null);

  if (prices.length === 0) {
    return (
      <p className={styles.intakeEmpty}>
        Прайс магазину порожній — додайте роботи в розділі «Онлайн», і тут зʼявиться швидкий прийом.
      </p>
    );
  }

  const price = prices.find((p) => p.id === priceId)?.price ?? 0;

  return (
    <form ref={form} action={action} className={styles.intake}>
      <p className={styles.intakeTitle}>Швидкий прийом</p>
      <div className={styles.intakeField}>
        <label htmlFor="on-ext">№ магазину</label>
        <input id="on-ext" name="externalNo" type="text" placeholder="М-4486" required autoComplete="off" />
      </div>
      <div className={styles.intakeWide}>
        <label htmlFor="on-work">Робота з прайсу магазину</label>
        <select id="on-work" name="priceId" value={priceId} onChange={(e) => setPriceId(e.target.value)}>
          {prices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.model} · {p.work} — {p.price.toLocaleString("uk-UA")} ₴
            </option>
          ))}
        </select>
      </div>
      <div className={styles.intakeWide}>
        <label htmlFor="on-note">Примітка</label>
        <input id="on-note" name="note" type="text" placeholder="необов'язково" autoComplete="off" />
      </div>
      <button type="submit" className={styles.intakeAdd} disabled={pending}>
        Додати · {price.toLocaleString("uk-UA")} ₴
      </button>
      {error && (
        <p role="alert" className={styles.intakeError}>
          {error}
        </p>
      )}
    </form>
  );
}
