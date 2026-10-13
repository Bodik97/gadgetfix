import styles from "./Ticker.module.css";

type Item = {
  label: string;
  /** Вміст <svg viewBox="0 0 24 24"> — той самий формат, що в services.ts */
  icon?: string;
};

export default function Ticker({ items }: { items: Item[] }) {
  const row = (
    <div className={styles.row}>
      {items.map((t) => (
        <span key={t.label} className={styles.item}>
          <span className={styles.label}>
            {t.icon && (
              <span className={styles.icon}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ stroke: "var(--accent-text)" }}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: t.icon }}
                />
              </span>
            )}
            {t.label}
          </span>
          <span className={styles.dot}>·</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={styles.tilt}>
      <div className={styles.wrap}>
        <div className={`${styles.track} ticker-track`}>
          {row}
          <span aria-hidden="true" className={styles.clone}>
            {row}
          </span>
        </div>
      </div>
    </div>
  );
}
