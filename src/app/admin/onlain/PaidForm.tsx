"use client";

import { useActionState, useState } from "react";
import { markPaid } from "./actions";
import styles from "./onlain.module.css";

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;

/** «Магазин оплатив»: скільки утримав — і скільки прийшло нам. Підтвердження — другим натиском. */
export default function PaidForm({ month, amount }: { month: string; amount: number }) {
  const [fee, setFee] = useState("");
  const [sure, setSure] = useState(false);
  const [error, action, pending] = useActionState(markPaid, null);
  const feeN = Number(fee.replace(/\s/g, "")) || 0;

  return (
    <form action={action} className={styles.paid}>
      <input type="hidden" name="month" value={month} />
      <label htmlFor="fee" className={styles.paidLabel}>
        Магазин утримав «за клієнтів», ₴
      </label>
      <input
        id="fee"
        name="fee"
        inputMode="numeric"
        pattern="[0-9 ]*"
        maxLength={9}
        placeholder="0"
        value={fee}
        onChange={(e) => {
          setFee(e.target.value);
          setSure(false);
        }}
        className={styles.input}
      />
      <span className={styles.paidGet}>
        Нам прийде: <b>{uah(Math.max(0, amount - feeN))}</b>
      </span>
      {sure ? (
        <button type="submit" className={styles.main} disabled={pending}>
          Так, магазин оплатив {uah(Math.max(0, amount - feeN))}
        </button>
      ) : (
        <button type="button" className={styles.soft} onClick={() => setSure(true)}>
          Магазин оплатив
        </button>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
