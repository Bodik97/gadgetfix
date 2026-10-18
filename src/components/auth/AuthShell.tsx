import LogoScene from "./LogoScene";
import styles from "./AuthShell.module.css";

const perks = [
  "Статус ремонту в реальному часі — без дзвінків",
  "Номер посилки Нової Пошти одразу на сторінці",
  "Гарантія на кожен пристрій — видно, доки діє",
];

/** Нерівний «рваний» край панелі: вертикальний — для широкого екрана, горизонтальний — для телефона */
const TEAR_V =
  "M0 0 L17.1 0 L25.4 17.0 L23.9 32.5 L14.7 53.8 L15.4 77.9 L16.9 100.6 L25.1 116.4 L18.7 147.0 L29.6 165.4 L27.5 198.4 L35.3 220.3 L31.9 235.2 L15.0 255.0 L17.5 271.4 L12.7 301.7 L21.2 327.3 L18.0 348.8 L6.6 364.0 L19.6 382.2 L11.1 404.7 L14.0 430.4 L21.7 450.4 L10.4 478.4 L17.8 503.9 L24.1 535.4 L30.9 555.2 L19.6 571.5 L15.6 600.7 L14.5 624.4 L31.7 651.8 L34.9 677.3 L31.3 697.5 L28.7 723.4 L33.9 746.5 L24.6 779.4 L14.0 806.7 L25.1 834.8 L26.7 868.6 L15.9 888.3 L6.4 915.7 L8.6 938.9 L5.7 955.3 L6.9 984.6 L17.8 1000 L0 1000Z";
const TEAR_H =
  "M0 40 L0 18.0 L25.2 29.9 L48.5 22.0 L74.3 16.1 L98.5 26.6 L128.4 15.1 L148.4 14.8 L178.6 27.2 L193.5 32.9 L226.7 23.9 L253.1 11.4 L267.4 18.6 L282.5 10.3 L301.4 5.7 L324.7 13.7 L355.5 14.6 L382.3 14.0 L409.6 13.5 L429.1 26.0 L463.0 24.1 L491.2 14.2 L509.8 14.8 L525.2 26.2 L547.2 29.3 L568.9 32.8 L599.9 12.7 L618.1 33.0 L641.5 34.5 L663.4 14.1 L690.0 28.7 L709.4 12.6 L730.1 30.7 L759.2 10.3 L778.2 8.7 L793.4 23.2 L810.9 17.0 L833.9 8.0 L862.5 6.0 L889.4 5.6 L911.8 8.1 L931.2 25.4 L961.2 12.1 L992.9 11.9 L1000 25.1 L1000 40Z";

type Props = {
  title: string;
  lead: string;
  /** На сторінці /vhid — h1, у вікні — h2 з id для aria-labelledby */
  titleAs?: "h1" | "h2";
  titleId?: string;
  /** У вікні: менше висоти, без зайвих відступів */
  compact?: boolean;
  children: React.ReactNode;
};

/**
 * Каркас входу: ліворуч біла панель із формою й рваним краєм, праворуч —
 * темна вітрина з обʼємним логотипом, назвою й перевагами кабінету.
 * Спільний для сторінки /vhid і вікна входу з шапки.
 */
export default function AuthShell({ title, lead, titleAs: Title = "h2", titleId, compact, children }: Props) {
  return (
    <div className={compact ? `${styles.shell} ${styles.compact}` : styles.shell}>
      <div className={styles.formSide}>
        <svg className={styles.tearV} viewBox="0 0 40 1000" preserveAspectRatio="none" aria-hidden="true">
          <path d={TEAR_V} />
        </svg>
        <svg className={styles.tearH} viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
          <path d={TEAR_H} />
        </svg>

        <div className={styles.head}>
          <Title id={titleId} className={styles.title}>
            {title}
          </Title>
          <p className={styles.lead}>{lead}</p>
        </div>

        {children}
      </div>

      {/* Вітрина завжди темна — лаймовий знак світиться на чорному */}
      <div className={styles.showcase} data-theme="dark">
        <div className={styles.scene}>
          <LogoScene />
        </div>

        <div className={styles.brand}>
          <div className={styles.wordmark}>
            Gadget<span>Fix</span>
          </div>
          <p className={styles.tagline}>Ваш ремонт — під контролем</p>
        </div>

        <ul className={styles.perks}>
          {perks.map((p) => (
            <li key={p}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
