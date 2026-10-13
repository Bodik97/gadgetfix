import Link from "next/link";
import { boardPrices, flatPrices, jobRange, PRICED_JOBS, PRICES_PUBLISHED, uah } from "@/data/prices";
import { services } from "@/data/services";
import styles from "./PriceSummary.module.css";

const titleOf = (slug: string) => services.find((s) => s.slug === slug)?.title ?? slug;

/** Роботи з цінами, що залежать від моделі — показуємо вилку по всьому каталогу */
const ranged = PRICED_JOBS.map((job) => ({ job, range: jobRange(job) })).filter(
  (r): r is { job: (typeof PRICED_JOBS)[number]; range: { min: number; max: number } } =>
    r.range !== null,
);

export default function PriceSummary() {
  if (!PRICES_PUBLISHED) return null;

  return (
    <section id="tsiny" className={`container ${styles.section}`}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Скільки коштує</h2>
          <p className={styles.lead}>
            Вилка по всьому каталогу — від найстаршої моделі до найновішої. Точна ціна вашої
            моделі є на її сторінці, а остаточну називаємо після безкоштовної діагностики.
          </p>
        </div>

        <Link href="/modeli" className="btn btn-ghost">
          Ціна для моєї моделі
        </Link>
      </div>

      <div className={styles.table}>
        <div className={styles.groupLabel}>Залежить від моделі</div>

        {ranged.map(({ job, range }) => (
          <div key={job} className={styles.row}>
            <span className={styles.job}>{titleOf(job)}</span>
            <span className={styles.value}>
              {uah(range.min)} <span className={styles.dash}>—</span> {uah(range.max)}
            </span>
          </div>
        ))}

        <div className={styles.groupLabel}>
          Залежить від того, що покаже діагностика
        </div>

        {boardPrices.map((b) => (
          <div key={b.slug} className={styles.row}>
            <span className={styles.job}>{titleOf(b.slug)}</span>
            <span className={styles.value}>від {uah(b.from)}</span>
          </div>
        ))}

        {flatPrices.map((f) => (
          <div key={f.slug} className={styles.row}>
            <span className={styles.job}>{titleOf(f.slug)}</span>
            <span className={styles.value}>{uah(f.price)}</span>
          </div>
        ))}

        <div className={styles.row}>
          <span className={styles.job}>Діагностика</span>
          <span className={styles.free}>безкоштовно</span>
        </div>
      </div>

      <p className={styles.note}>
        Ціни під ключ: робота разом із деталлю, без прихованих доплат. Гарантія 2 місяці на
        аналог і 4 місяці на оригінал. Ремонт іде за передоплатою — після погодження ціни ви вносите
        передоплату за деталь, решту сплачуєте при видачі.
      </p>
    </section>
  );
}
