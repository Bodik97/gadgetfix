import styles from "./ParcelDecor.module.css";

/**
 * Шлях посилки навколо блоку перевірки статусу: запакували — везуть — у
 * відділенні — клієнт чекає — прийшло сповіщення — отримав. Лише прикраса,
 * тому від читалок екрана схована.
 */

const icon = {
  width: 48,
  height: 48,
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Запакована посилка — з усмішкою */
const Packed = () => (
  <svg {...icon}>
    <rect x="8" y="14" width="32" height="26" rx="4" />
    <path d="M8 21h32M24 14v7" />
    <g className={styles.accent}>
      <circle cx="18" cy="29" r="1.3" fill="currentColor" />
      <circle cx="30" cy="29" r="1.3" fill="currentColor" />
      <path d="M19 33.5q5 4 10 0" />
    </g>
  </svg>
);

/** Посилка в дорозі */
const Truck = () => (
  <svg {...icon}>
    <rect x="12" y="15" width="18" height="17" rx="2" />
    <path d="M30 20h7l6 6v6H30z" />
    <circle cx="19" cy="34" r="3.5" />
    <circle cx="37" cy="34" r="3.5" />
    <path className={styles.accent} d="M2 19h6M4 24.5h4M2 30h6" />
  </svg>
);

/** Посилка доїхала до відділення */
const Arrived = () => (
  <svg {...icon}>
    <path d="M34 7a8 8 0 0 1 8 8c0 6-8 14-8 14s-8-8-8-14a8 8 0 0 1 8-8z" />
    <circle className={styles.accent} cx="34" cy="15" r="2.6" />
    <path d="M7 40c9 0 8-9 17-9" strokeDasharray="1 5" />
    <circle cx="5.5" cy="40" r="1.8" />
  </svg>
);

/** Клієнт чекає */
const Waiting = () => (
  <svg {...icon}>
    <circle cx="24" cy="24" r="15" />
    <path className={styles.accent} d="M24 15v9l6 4" />
    <path d="M24 5v2M24 41v2M5 24h2M41 24h2" />
  </svg>
);

/** Прийшло сповіщення: посилка у відділенні */
const Notified = () => (
  <svg {...icon}>
    <rect x="13" y="7" width="18" height="35" rx="4" />
    <path d="M19.5 37h5" />
    <g className={styles.accent}>
      <circle cx="33" cy="12" r="6.5" />
      <path d="M33 9v4.2M33 15.4v.1" />
    </g>
  </svg>
);

/** Посилку відкрили — усе на місці */
const Opened = () => (
  <svg {...icon}>
    <rect x="8" y="20" width="32" height="20" rx="3" />
    <path d="M8 20l-4-8h14l6 8M40 20l4-8H30l-6 8" />
    <path className={styles.accent} d="M17 30l5 5 9-10" />
  </svg>
);

/** Клієнт із посилкою в руках */
const Happy = () => (
  <svg {...icon}>
    <circle cx="24" cy="11" r="5" />
    <path d="M11 41c0-9 5-15 13-15s13 6 13 15" />
    <rect className={styles.accent} x="18.5" y="30" width="11" height="9" rx="1.5" />
  </svg>
);

const journey = [Packed, Truck, Arrived, Waiting, Notified, Opened];
const extras = [Arrived, Happy, Packed];

export default function ParcelDecor() {
  return (
    <div className={styles.decor} aria-hidden="true">
      <div className={styles.journey}>
        {journey.map((Icon, i) => (
          <span key={i} className={styles.step}>
            <Icon />
          </span>
        ))}
      </div>

      <div className={styles.extras}>
        {extras.map((Icon, i) => (
          <span key={i} className={styles.extra}>
            <Icon />
          </span>
        ))}
      </div>
    </div>
  );
}
