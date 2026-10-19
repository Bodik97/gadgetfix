"use client";

import { DISCOUNT_PERCENT, type DiscountKind } from "@/data/discounts";
import styles from "./DiscountTicket.module.css";

/**
 * «Квиток» знижки у формі замовлення. 5% за реєстрацію клієнт забирає сам —
 * кнопкою «Скористатись»; 10% за відгук і до дня народження вже діють, кнопки не треба.
 * celebrate — щойно зареєструвався: квиток «вистрибує» з конфеті.
 */
export default function DiscountTicket({
  kind,
  applied,
  onApply,
  onCancel,
  celebrate,
}: {
  kind: DiscountKind;
  applied: boolean;
  onApply: () => void;
  onCancel: () => void;
  celebrate?: boolean;
}) {
  const pct = DISCOUNT_PERCENT[kind];
  const on = kind !== "signup" || applied;

  return (
    <div className={`${on ? styles.ticketOn : styles.ticket} ${celebrate ? styles.celebrate : ""}`} aria-live="polite">
      {celebrate && (
        <span className={styles.confetti} aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </span>
      )}

      <span className={styles.percent}>−{pct}%</span>

      <div className={styles.body}>
        {kind === "birthday" ? (
          <>
            <p className={styles.title}>
              <Check /> З днем народження! Знижка {pct}% уже діє 🎂
            </p>
            <p className={styles.text}>Застосуємо її до цього замовлення автоматично.</p>
          </>
        ) : kind === "review" ? (
          <>
            <p className={styles.title}>
              <Check /> Знижка {pct}% за ваш відгук — уже діє
            </p>
            <p className={styles.text}>Застосуємо її до цього замовлення автоматично. Дякуємо за відгук!</p>
          </>
        ) : applied ? (
          <>
            <p className={styles.title}>
              <Check /> Знижку {pct}% застосовано
            </p>
            <p className={styles.text}>Майстер назве ціну вже зі знижкою.</p>
            <button type="button" className={styles.cancel} onClick={onCancel}>
              Не зараз
            </button>
          </>
        ) : (
          <>
            <p className={styles.title}>{celebrate ? "Вітаємо! Ваша знижка за реєстрацію" : "Вам знижка за реєстрацію"}</p>
            <p className={styles.text}>Діє на перший ремонт — натисніть, і вона ваша.</p>
            <button type="button" className={`btn btn-accent ${styles.apply}`} onClick={onApply}>
              Скористатись знижкою {pct}%
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
