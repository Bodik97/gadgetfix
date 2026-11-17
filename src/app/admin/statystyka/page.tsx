import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteStats, type SiteStats } from "@/db/siteStats";
import { isAdmin, isOwner } from "@/lib/admin";
import PeriodFilter from "../groshi/PeriodFilter";
import { resolveRange } from "../groshi/period";
import { CLICK_LABELS, DEVICE_LABELS, DIRECT } from "./labels";
import shared from "../page.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Статистика — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const num = (n: number) => n.toLocaleString("uk-UA");

/** Частка від попереднього кроку воронки; без бази — прочерк */
const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export default async function SiteStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/vhid");
  // Статистика — лише для власника
  if (!(await isOwner())) redirect("/admin");

  const range = resolveRange(await searchParams);

  let stats: SiteStats;
  try {
    stats = await getSiteStats(range.from, range.to);
  } catch (error) {
    // 42P01 — таблиці site_events ще немає: код виїхав раніше за зміну бази
    const code = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
    if (code !== "42P01") throw error;

    return (
      <section className={shared.wrap}>
        <div className={shared.head}>
          <h1 className={shared.title}>Статистика сайту</h1>
        </div>
        <div className={shared.empty}>
          Таблицю статистики ще не створено в базі, тож відвідування поки не записуються.
          Запустіть <code>npm run db:push</code> — після цього сторінка запрацює.
        </div>
      </section>
    );
  }

  const { funnel } = stats;

  const steps = [
    { label: "Зайшли на сайт", value: funnel.visitors, of: null as number | null },
    { label: "Натиснули «Записатись»", value: funnel.intent, of: funnel.visitors },
    { label: "Надіслали заявку", value: funnel.leads, of: funnel.visitors },
    { label: "Заявка стала ремонтом", value: funnel.repairs, of: funnel.leads },
  ];

  return (
    <section className={shared.wrap}>
      <div className={shared.head}>
        <div>
          <div className="kicker">Адміністрування</div>
          <h1 className={shared.title}>Статистика сайту</h1>
          <p className={shared.sectionNote}>
            Анонімно, без cookie. Відвідувачі рахуються за днями: хто зайшов у два різні дні —
            це два відвідувачі. Ваші власні заходи з адмінки не враховано.
          </p>
        </div>
      </div>

      <div className={styles.tools}>
        <PeriodFilter key={`${range.fromDay}:${range.toDay}`} range={range} base="/admin/statystyka" />

        <a
          href={`/admin/statystyka/csv?from=${range.fromDay}&to=${range.toDay}`}
          className="btn btn-ghost"
          download
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11" />
            <path d="M8 11l4 4 4-4" />
            <path d="M5 19h14" />
          </svg>
          Вивантажити таблицю
        </a>
      </div>

      {stats.views === 0 ? (
        <div className={shared.empty}>За цей період відвідувань ще не записано.</div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.totals}>
            <div className={styles.total}>
              <span className={styles.totalValue}>{num(stats.visitors)}</span>
              <span className={styles.totalLabel}>відвідувачів</span>
            </div>
            <div className={styles.total}>
              <span className={styles.totalValue}>{num(stats.views)}</span>
              <span className={styles.totalLabel}>переглядів сторінок</span>
            </div>
            <div className={styles.total}>
              <span className={styles.totalValue}>{num(funnel.leads)}</span>
              <span className={styles.totalLabel}>заявок із сайту</span>
            </div>
            <div className={styles.total}>
              <span className={styles.totalValue}>{share(funnel.leads, funnel.visitors)}</span>
              <span className={styles.totalLabel}>відвідувачів лишили заявку</span>
            </div>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.h2}>Воронка заявок</h2>
            <table className={styles.table}>
              <tbody>
                {steps.map((s) => (
                  <tr key={s.label}>
                    <th scope="row">{s.label}</th>
                    <td>{num(s.value)}</td>
                    <td className={styles.muted}>{s.of === null ? "" : share(s.value, s.of)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>
              Відсоток «стала ремонтом» — від заявок, решта — від відвідувачів. Дзвінки напряму
              сюди не потрапляють: видно лише натискання на номер.
            </p>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.h2}>Кліки на кнопки</h2>
            {stats.clicks.length === 0 ? (
              <p className={styles.note}>Натискань за цей період немає.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Кнопка</th>
                    <th scope="col">Кліків</th>
                    <th scope="col">Людей</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.clicks.map((c) => (
                    <tr key={c.name}>
                      <th scope="row">{CLICK_LABELS[c.name] ?? c.name}</th>
                      <td>{num(c.clicks)}</td>
                      <td className={styles.muted}>{num(c.visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.panel}>
            <h2 className={styles.h2}>Сторінки</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Адреса</th>
                  <th scope="col">Переглядів</th>
                  <th scope="col">Людей</th>
                </tr>
              </thead>
              <tbody>
                {stats.pages.map((p) => (
                  <tr key={p.path}>
                    <th scope="row">{p.path}</th>
                    <td>{num(p.views)}</td>
                    <td className={styles.muted}>{num(p.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.h2}>Звідки приходять</h2>
            <table className={styles.table}>
              <tbody>
                {stats.sources.map((s) => (
                  <tr key={s.source}>
                    <th scope="row">{s.source || DIRECT}</th>
                    <td>{num(s.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className={`${styles.h2} ${styles.h2Next}`}>Пристрої</h2>
            <table className={styles.table}>
              <tbody>
                {stats.devices.map((d) => (
                  <tr key={d.device}>
                    <th scope="row">{DEVICE_LABELS[d.device] ?? d.device}</th>
                    <td>{num(d.visitors)}</td>
                    <td className={styles.muted}>{share(d.visitors, stats.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
