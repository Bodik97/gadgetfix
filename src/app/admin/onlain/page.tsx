import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  countOnlineActive,
  getAllPartnerPrices,
  getMonthLeads,
  getSettlement,
  getSettlements,
  isMonthKey,
  monthKey,
  nextMonthKey,
} from "@/db/online";
import { currentTeam } from "@/lib/admin";
import { orderLabel } from "@/lib/stage";
import PaidForm from "./PaidForm";
import PriceList from "./PriceList";
import styles from "./onlain.module.css";

export const metadata: Metadata = {
  title: "Онлайн — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;
const day = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", timeZone: "Europe/Kyiv" });
const monthName = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const name = new Intl.DateTimeFormat("uk-UA", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
};
const prevMonthKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/**
 * Магазин «Онлайн»: прайс і розрахунок за місяць. Самі заявки магазину —
 * у «Заявках» (точка «магазин Онлайн»), тут їх не дублюємо.
 */
export default async function OnlinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const team = await currentTeam();
  if (!team) redirect("/admin/vhid");

  const raw = await searchParams;
  // Розрахунок — гроші, бачить лише власник; майстер працює з прайсом
  const tab = raw.tab === "money" && team.owner ? "money" : "price";
  const month = isMonthKey(raw.month) ? raw.month : monthKey();

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Онлайн</h1>
        <span className={styles.sub}>магазин-партнер · свої ціни · окремий облік</span>
        <span className={styles.tabs} role="group" aria-label="Розділ">
          <Link href="/admin/onlain" className={tab === "price" ? styles.tabOn : styles.tab}>
            Прайс магазину
          </Link>
          {team.owner && (
            <Link href={`/admin/onlain?tab=money&month=${month}`} className={tab === "money" ? styles.tabOn : styles.tab}>
              Розрахунок
            </Link>
          )}
        </span>
        <Link href="/admin/zayavky?point=online" className={styles.ghost}>
          Заявки магазину →
        </Link>
      </header>

      {tab === "price" ? <PriceTab /> : <MoneyTab month={month} />}
    </section>
  );
}

async function PriceTab() {
  return <PriceList prices={await getAllPartnerPrices()} />;
}

async function MoneyTab({ month }: { month: string }) {
  const [rows, settlement, history, inWork] = await Promise.all([
    getMonthLeads(month),
    getSettlement(month),
    getSettlements(),
    countOnlineActive(),
  ]);
  const amount = rows.reduce((s, r) => s + (r.price ?? 0), 0);
  const ourCost = rows.reduce((s, r) => s + (r.partsCost ?? 0), 0);
  const fee = settlement?.fee ?? 0;
  const isCurrent = month === monthKey();

  return (
    <div className={styles.money}>
      <nav className={styles.monthNav} aria-label="Місяць">
        <Link href={`/admin/onlain?tab=money&month=${prevMonthKey(month)}`} className={styles.ghost} aria-label="Попередній місяць">
          ‹
        </Link>
        <span className={styles.monthName}>{monthName(month)}</span>
        {!isCurrent && (
          <Link href={`/admin/onlain?tab=money&month=${nextMonthKey(month)}`} className={styles.ghost} aria-label="Наступний місяць">
            ›
          </Link>
        )}
        {settlement ? (
          <span className={styles.paidTag}>оплачено {settlement.paidAt ? day.format(settlement.paidAt) : ""}</span>
        ) : rows.length > 0 ? (
          <span className={styles.owedTag}>магазин винен</span>
        ) : null}
      </nav>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>Віддано магазину</p>
          <p className={styles.tileValue}>{rows.length}</p>
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>Сума за прайсом</p>
          <p className={styles.tileValue}>{uah(amount)}</p>
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>{settlement ? "Прийшло нам" : "Магазин винен"}</p>
          <p className={styles.tileValue}>{uah(amount - fee)}</p>
          {settlement && fee > 0 && <p className={styles.tileHint}>утримав {uah(fee)}</p>}
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>Деталі нам коштували</p>
          <p className={styles.tileValue}>{uah(ourCost)}</p>
          <p className={styles.tileHint}>заробіток {uah(amount - fee - ourCost)}</p>
        </div>
      </div>

      {isCurrent && inWork > 0 && (
        <p className={styles.lead}>Ще в роботі: {inWork} — потраплять у розрахунок того місяця, коли їх віддасте.</p>
      )}

      <div className={styles.actions}>
        {rows.length > 0 && (
          <a href={`/admin/onlain/akt?month=${month}`} target="_blank" rel="noopener" className={styles.ghost}>
            Акт для друку / PDF
          </a>
        )}
        {!settlement && rows.length > 0 && <PaidForm month={month} amount={amount} />}
      </div>

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>№</th>
                <th>Магазин</th>
                <th>Пристрій і робота</th>
                <th>Віддали</th>
                <th>Ціна</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/zayavky/${r.id}`} className={styles.no}>
                      {orderLabel(r)}
                    </Link>
                  </td>
                  <td>{r.externalNo ?? "—"}</td>
                  <td>
                    <b>{r.model}</b> · {r.service}
                  </td>
                  <td>{r.issuedAt ? day.format(r.issuedAt) : "—"}</td>
                  <td className={styles.sum}>{uah(r.price ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.empty}>За {monthName(month).toLowerCase()} магазину ще нічого не віддавали.</p>
      )}

      {history.length > 0 && (
        <div className={styles.history}>
          <p className={styles.tileLabel}>Історія розрахунків</p>
          {history.map((h) => {
            const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit" }).format(h.periodStart);
            return (
              <Link key={h.id} href={`/admin/onlain?tab=money&month=${key}`} className={styles.historyRow}>
                <span>
                  {monthName(key)} · {h.ordersCount} рем.
                </span>
                <span>
                  {uah(h.amount - h.fee)}
                  {h.fee > 0 ? ` (утримано ${uah(h.fee)})` : ""} · оплачено
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
