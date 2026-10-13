import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMoney, getOutstanding, monthStart } from "@/db/adminStats";
import { categoryLabel, getExpenses, getExpenseTotal } from "@/db/expenses";
import { getMoneyJournal } from "@/db/moneyJournal";
import { isAdmin } from "@/lib/admin";
import Expenses from "./Expenses";
import PeriodFilter from "./PeriodFilter";
import Journal from "./Journal";
import { dayString, resolveRange } from "./period";
import styles from "./page.module.css";
import shared from "../page.module.css";

export const metadata: Metadata = {
  title: "Каса — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;

// Сервер живе за UTC — без явного поясу дати з'їжджали б на дві-три години
const monthName = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric", timeZone: "Europe/Kyiv" });
const day = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", timeZone: "Europe/Kyiv" });

/** Скільки місяців показуємо в історії */
const MONTHS = 6;

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const range = resolveRange(await searchParams);
  const { from, to } = range;

  const [chosen, owed, spending, journal] = await Promise.all([
    getMoney(from, to),
    getOutstanding(),
    getExpenses(from, to),
    getMoneyJournal(from, to),
  ]);

  const spent = spending.reduce((sum, e) => sum + e.amount, 0);
  // Чистими в касі — за вирахуванням і деталей, і витрат сервісу
  const net = chosen.profit - spent;
  // Середній чек рахуємо від чистого: скільки в середньому лишається з роботи
  const average = chosen.jobs > 0 ? Math.round(chosen.profit / chosen.jobs) : 0;

  // Кожен місяць — окремий проміжок [початок, початок наступного)
  const months = await Promise.all(
    Array.from({ length: MONTHS }, (_, i) => i).map(async (back) => {
      const start = monthStart(back);
      const end = back === 0 ? undefined : monthStart(back - 1);
      const [money, spent] = await Promise.all([getMoney(start, end), getExpenseTotal(start, end)]);
      // «Чистими» скрізь означає одне: за вирахуванням і деталей, і витрат сервісу
      return { from: start, money, spent, net: money.profit - spent };
    }),
  );

  const current = months[0];
  const previous = months[1];

  // На скільки відсотків місяць відрізняється від попереднього
  const delta =
    previous && previous.net > 0
      ? Math.round(((current.net - previous.net) / previous.net) * 100)
      : null;

  const best = Math.max(...months.map((m) => m.net), 1);
  const anyMoney = months.some((m) => m.money.jobs > 0 || m.money.revenue > 0 || m.spent > 0);

  return (
    <section className={shared.wrap}>
      <div className={shared.head}>
        <div>
          <h1 className={shared.title}>Каса</h1>
          <p className={shared.sectionNote}>
            Рахуємо за датою оплати, а не за датою заявки: ремонт, прийнятий торік і оплачений
            цього місяця, належить цьому місяцю.
          </p>
        </div>
      </div>

      <div className={styles.tools}>
        <PeriodFilter key={`${range.fromDay}:${range.toDay}`} range={range} />

        <a
          href={`/admin/groshi/csv?from=${range.fromDay}&to=${range.toDay}`}
          className="btn btn-ghost"
          download
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11" />
            <path d="M8 11l4 4 4-4" />
            <path d="M5 19h14" />
          </svg>
          Вивантажити
        </a>
      </div>

      <div className={styles.big}>
        <div className={styles.bigItem}>
          <span className={styles.bigLabel}>Оплачено · {range.label.toLowerCase()}</span>
          <span className={styles.bigValue}>{uah(chosen.revenue)}</span>
        </div>
        <div className={styles.bigItem}>
          <span className={styles.bigLabel}>Деталі</span>
          <span className={styles.bigValue}>
            {chosen.cost > 0 ? "−" : ""}
            {uah(chosen.cost)}
          </span>
        </div>
        <div className={styles.bigItem}>
          <span className={styles.bigLabel}>Витрати сервісу</span>
          <span className={styles.bigValue}>
            {spent > 0 ? "−" : ""}
            {uah(spent)}
          </span>
        </div>
        <div className={styles.bigItemAccent}>
          <span className={styles.bigLabel}>
            Чистими
            {range.label === "Цей місяць" && delta !== null && (
              <span className={delta >= 0 ? styles.up : styles.down}>
                {delta >= 0 ? "+" : ""}
                {delta}% до минулого
              </span>
            )}
          </span>
          <span className={styles.bigProfit}>{uah(net)}</span>
          {spent > 0 && (
            <span className={styles.sub}>
              з робіт {uah(chosen.profit)} − витрати {uah(spent)}
            </span>
          )}
        </div>
        <div className={styles.bigItem}>
          <span className={styles.bigLabel}>Ремонтів · у середньому</span>
          <span className={styles.bigValue}>
            {chosen.jobs} <span className={styles.sub}>· {uah(average)}</span>
          </span>
        </div>
      </div>

      {owed.jobs > 0 && (
        <div className={styles.owed}>
          <div>
            <span className={styles.owedLabel}>Очікує оплати</span>
            <span className={styles.owedValue}>{uah(owed.due)}</span>
          </div>
          <p className={styles.owedNote}>
            {owed.jobs} {owed.jobs === 1 ? "робота з виставленою ціною" : "робіт з виставленою ціною"}{" "}
            ще не позначені як оплачені
            {owed.prepaid > 0 && <> · з них уже внесено передоплат на {uah(owed.prepaid)}</>}.
          </p>
        </div>
      )}

      <h2 className={styles.h2}>Історія руху</h2>
      <Journal entries={journal} />

      <Expenses
        today={dayString(new Date())}
        rows={spending.map((e) => ({
          id: e.id,
          день: day.format(e.spentAt),
          сума: uah(e.amount),
          категорія: categoryLabel(e.category),
          нотатка: e.note,
        }))}
      />

      <h2 className={styles.h2}>Останні {MONTHS} місяців</h2>

      {anyMoney ? (
        <div className={styles.table}>
          {months.map((m) => {
            const label = monthName.format(m.from);
            const width = Math.max(2, Math.round((m.net / best) * 100));

            return (
              <div key={label} className={styles.row}>
                <span className={styles.month}>{label}</span>

                <span className={styles.bar} aria-hidden="true">
                  <span className={styles.barFill} style={{ width: `${width}%` }} />
                </span>

                <span className={styles.cell}>
                  <span className={styles.cellLabel}>оплачено</span>
                  {uah(m.money.revenue)}
                </span>
                <span className={styles.cell}>
                  <span className={styles.cellLabel}>деталі</span>
                  {m.money.cost > 0 ? "−" : ""}
                  {uah(m.money.cost)}
                </span>
                <span className={styles.cell}>
                  <span className={styles.cellLabel}>витрати</span>
                  {m.spent > 0 ? "−" : ""}
                  {uah(m.spent)}
                </span>
                <span className={styles.cellStrong}>
                  <span className={styles.cellLabel}>чистими</span>
                  {uah(m.net)}
                </span>
                <span className={styles.cell}>
                  <span className={styles.cellLabel}>ремонтів</span>
                  {m.money.jobs}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={shared.empty}>
          Поки нічого не оплачено. Впишіть ціну в заявці й позначте «оплачено» — суми зʼявляться
          тут.
        </div>
      )}
    </section>
  );
}
