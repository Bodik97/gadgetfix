"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReviewForm from "@/components/ReviewForm";
import FormError from "@/components/FormError";
import { confirmReceived } from "@/app/moi-remonty/actions";
import styles from "./ReceivedButton.module.css";

/**
 * «Я отримав гаджет» у картці готового ремонту. Після підтвердження одразу
 * пропонуємо відгук: саме зараз враження найсвіжіші, а за відгук із фото
 * клієнт отримує −15% на наступний ремонт.
 */
export default function ReceivedButton({ id, received }: { id: string; received: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [askReview, setAskReview] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (askReview) dialogRef.current?.showModal();
  }, [askReview]);

  const confirm = () =>
    start(async () => {
      setError("");
      const res = await confirmReceived(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAskReview(true);
    });

  const close = () => {
    dialogRef.current?.close();
    setAskReview(false);
    // Оновлюємо кабінет лише після вікна: інакше картка перемалювалась би під ним
    router.refresh();
  };

  return (
    <>
      {received ? (
        <div className={styles.done}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Ви підтвердили, що отримали пристрій. Дякуємо!
        </div>
      ) : (
        <div className={styles.offer}>
          <p className={styles.offerText}>Пристрій уже у вас? Підтвердьте — майстер закриє заявку, а ви отримаєте змогу лишити відгук за −15%.</p>
          <button type="button" className={styles.button} onClick={confirm} disabled={pending}>
            {pending ? <span className={styles.spinner} aria-hidden="true" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
                <path d="M8.5 12.5l2.5 2.5 4.5-5" />
              </svg>
            )}
            Я отримав гаджет
          </button>
          <FormError>{error}</FormError>
        </div>
      )}

      {askReview && (
        <dialog ref={dialogRef} className={styles.dialog} onClose={close} aria-labelledby={`rv-${id}`}>
          <div className={styles.dialogHead}>
            <div>
              <h2 id={`rv-${id}`} className={styles.dialogTitle}>
                Радіємо, що гаджет знову з вами!
              </h2>
              <p className={styles.dialogText}>
                Розкажіть, як усе пройшло, і додайте фото до і після — після перевірки відгуку
                отримаєте <strong>−15% на наступний ремонт</strong>.
              </p>
            </div>
            <button type="button" className={styles.close} onClick={close} aria-label="Закрити — лишу відгук пізніше">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <ReviewForm leadId={id} />

          <button type="button" className={styles.later} onClick={close}>
            Лишу відгук пізніше
          </button>
        </dialog>
      )}
    </>
  );
}
