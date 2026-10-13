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
