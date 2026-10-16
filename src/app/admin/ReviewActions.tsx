"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { deleteReview, setReviewDiscount, setReviewPublished } from "./actions";
import styles from "./ReviewActions.module.css";

/** Стан знижки за відгук, як його бачить кнопка */
export type DiscountState = "none" | "available" | "granted" | "used";

const icon = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  hide: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.3 7.6C4.2 9.2 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1" />
    </>
  ),
  open: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5H5V6h5" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="7" cy="7" r="2.2" />
      <circle cx="17" cy="17" r="2.2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof icon }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icon[name]}
    </svg>
  );
}

/** Кнопка форми, що показує роботу, поки сервер відповідає — майстер не тисне двічі */
function Submit({ className, children, label }: { className: string; children: React.ReactNode; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-label={label} title={label}>
      {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/**
 * Панель дій відгуку: опублікувати, знижка, відкрити, видалити.
 * Одна на список і на сторінку відгуку, щоб кнопки поводились однаково.
 */
export default function ReviewActions({
  id,
  published,
  discount,
  showOpen = true,
}: {
  id: string;
  published: boolean;
  discount: DiscountState;
  /** На сторінці самого відгуку «Відкрити» зайве */
  showOpen?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  return (
    <div className={styles.bar}>
      <div className={styles.main}>
        <form action={setReviewPublished}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="publish" value={published ? "0" : "1"} />
          <Submit className={published ? styles.ghost : styles.primary}>
            <Icon name={published ? "hide" : "check"} />
            {published ? "Сховати з сайту" : "Опублікувати"}
          </Submit>
        </form>

        {discount === "available" && (
          <form action={setReviewDiscount}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="grant" value="1" />
            <Submit className={styles.discount}>
              <Icon name="percent" />
              Нарахувати −15%
            </Submit>
          </form>
        )}

        {discount === "granted" && (
          <span className={styles.discountOn}>
            <Icon name="percent" />
            −15% нараховано
            <form action={setReviewDiscount}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="grant" value="0" />
              <Submit className={styles.undo} label="Скасувати знижку">
                <Icon name="close" />
              </Submit>
            </form>
          </span>
        )}

        {discount === "used" && (
          <span className={styles.discountUsed}>
            <Icon name="percent" />
            −15% використано
          </span>
        )}

        {showOpen && (
          <Link href={`/admin/vidhuky/${id}`} className={styles.ghost}>
            <Icon name="open" />
            Відкрити
          </Link>
        )}
      </div>

      {/* Два кроки замість вікна підтвердження — як у заявок */}
      {armed ? (
        <span className={styles.confirm}>
          Видалити назовсім разом із фото?
          <form action={deleteReview}>
            <input type="hidden" name="id" value={id} />
            {!showOpen && <input type="hidden" name="back" value="1" />}
            <Submit className={styles.yes}>Так</Submit>
          </form>
          <button type="button" className={styles.no} onClick={() => setArmed(false)}>
            Ні
          </button>
        </span>
      ) : (
        <button type="button" className={styles.trash} onClick={() => setArmed(true)} aria-label="Видалити відгук" title="Видалити відгук">
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
}
