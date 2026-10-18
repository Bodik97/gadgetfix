import base from "@/app/moi-remonty/page.module.css";
import styles from "./CabinetSkeleton.module.css";

/**
 * Сірий «скелет» сторінки кабінету: з'являється одразу після натискання,
 * поки сервер збирає заявки й повідомлення. Без нього здавалось, що
 * натискання не спрацювало.
 */
export default function CabinetSkeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className={base.page} aria-busy="true" aria-label="Завантаження">
      <div className={base.head}>
        <div className={base.headTop}>
          <span className={`${styles.bone} ${styles.pill}`} />
          <span className={`${styles.bone} ${styles.pill}`} />
        </div>
        <span className={`${styles.bone} ${styles.title}`} />
        <span className={`${styles.bone} ${styles.line}`} />
      </div>

      {Array.from({ length: blocks }, (_, i) => (
        <span key={i} className={`${styles.bone} ${styles.card}`} />
      ))}
    </div>
  );
}
