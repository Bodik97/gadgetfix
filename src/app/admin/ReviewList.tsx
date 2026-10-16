import type { Review } from "@/db/schema";
import { deleteReview, setReviewPublished } from "./actions";
import styles from "./page.module.css";

const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

/** Що зі знижкою 15% за цей відгук — щоб майстер знав, що дасть схвалення */
function discountNote(r: Review): string {
  if (r.discountLeadId) return "Знижку 15% клієнт уже використав.";
  if (r.discountAt) return "Знижку 15% нараховано — чекає на наступний ремонт.";
  if (!r.leadId) return "Без знижки: у клієнта немає виданого ремонту через сайт.";
  if (!r.beforePath || !r.afterPath) return "Без знижки: немає обох фото до і після.";
  return "Після схвалення клієнт отримає знижку 15% на наступний ремонт.";
}

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return <div className={styles.empty}>Відгуків ще немає.</div>;
  }

  return (
    <div className={styles.cards}>
      {reviews.map((r) => (
        <article
          key={r.id}
          className={`${styles.card} ${r.published ? "" : styles.cardNew}`}
        >
          <div className={styles.cardMain}>
            <div className={styles.cardTop}>
              <span className={styles.name}>{r.authorName}</span>
              {r.device && <span className={styles.source}>{r.device}</span>}
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

            <p className={styles.problem}>{r.text}</p>

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
          </div>

          <div className={styles.cardSide}>
            <form action={setReviewPublished}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="publish" value={r.published ? "0" : "1"} />
              <button type="submit" className={r.published ? "btn btn-ghost" : "btn btn-accent"}>
                {r.published ? "Сховати" : "Опублікувати"}
              </button>
            </form>

            <form action={deleteReview}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" className={styles.deleteBtn}>
                Видалити
              </button>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}
