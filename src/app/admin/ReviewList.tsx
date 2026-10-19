import Link from "next/link";
import type { Review } from "@/db/schema";
import { reviewDevice } from "@/data/deviceImage";
import ReviewActions, { type DiscountState } from "./ReviewActions";
import styles from "./page.module.css";

const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

/** Що зі знижкою 10% за цей відгук — щоб майстер знав, що дасть схвалення */
export function discountNote(r: Review): string {
  if (r.discountLeadId) return "Знижку 10% клієнт уже використав.";
  if (r.discountAt) return "Знижку 10% нараховано — чекає на наступний ремонт.";
  if (!r.leadId) return "Автоматично знижки не буде: у клієнта немає виданого ремонту через сайт. Можна нарахувати вручну.";
  if (!r.beforePath || !r.afterPath) return "Автоматично знижки не буде: немає обох фото до і після. Можна нарахувати вручну.";
  return "Після схвалення клієнт отримає знижку 10% на наступний ремонт.";
}

/** Що можна зробити зі знижкою: відгук майстра чи без акаунта — знижку нікуди записати */
export function discountState(r: Review): DiscountState {
  if (r.discountLeadId) return "used";
  if (r.discountAt) return "granted";
  return r.byMaster || !r.clerkUserId ? "none" : "available";
}

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return <div className={styles.empty}>Відгуків ще немає.</div>;
  }

  return (
    <div className={styles.cards}>
      {reviews.map((r) => {
        // Модель не вписали — беремо ту, що названа в тексті відгуку
        const device = reviewDevice(r.device, r.text);
        return (
          <article
            key={r.id}
            className={`${styles.card} ${r.published ? "" : styles.cardNew}`}
          >
            <div className={styles.cardMain}>
              <div className={styles.cardTop}>
                <Link href={`/admin/vidhuky/${r.id}`} className={styles.name}>
                  {r.authorName}
                </Link>
                {device.name && <span className={styles.source}>{device.name}</span>}
                <span className={styles.stars} role="img" aria-label={`${r.rating} з 5`}>
                  {"★".repeat(r.rating)}
                  <span className={styles.starsOff} aria-hidden="true">{"★".repeat(5 - r.rating)}</span>
                </span>
                <span className={styles.when}>{dateFormat.format(r.createdAt)}</span>
                {r.published ? (
                  <span className={styles.tagAccount}>на сайті</span>
                ) : (
                  <span className={styles.tagAnon}>чекає</span>
                )}
              </div>

              <div className={styles.reviewBody}>
                {device.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- маленька мініатюра з каталогу
                  <img src={device.image} alt={device.name ?? ""} className={styles.reviewModel} loading="lazy" />
                )}
                <p className={styles.reviewText}>{r.text}</p>
              </div>

              {(r.beforePath || r.afterPath) && (
                <div className={styles.reviewPhotos}>
                  {r.beforePath && (
                    <a href={`/api/reviews/${r.id}/image?v=before`} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/reviews/${r.id}/image?v=before`} alt="До ремонту" loading="lazy" />
                      <span>до</span>
                    </a>
                  )}
                  {r.afterPath && (
                    <a href={`/api/reviews/${r.id}/image?v=after`} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/reviews/${r.id}/image?v=after`} alt="Після ремонту" loading="lazy" />
                      <span>після</span>
                    </a>
                  )}
                </div>
              )}

              {!r.byMaster && <p className={styles.hint}>{discountNote(r)}</p>}

              <ReviewActions id={r.id} published={r.published} discount={discountState(r)} />
            </div>

          </article>
        );
      })}
    </div>
  );
}
