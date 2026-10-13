import Link from "next/link";
import type { MoneyEntry } from "@/db/moneyJournal";
import styles from "./Journal.module.css";

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;

const dayName = new Intl.DateTimeFormat("uk-UA", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Kyiv",
});

const time = new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });
const shortDate = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", timeZone: "Europe/Kyiv" });

const kindLabel: Record<MoneyEntry["kind"], string> = {
  paid: "Оплата",
  prepaid: "Завдаток",
  expense: "Витрата",
};

/** Рухи одного дня — щоб у стрічці було видно межі днів */
function groupByDay(entries: MoneyEntry[]): [string, MoneyEntry[]][] {
  const days = new Map<string, MoneyEntry[]>();

  for (const e of entries) {
    const key = dayName.format(e.at);
    const list = days.get(key) ?? [];
    list.push(e);
    days.set(key, list);
  }

  return [...days.entries()];
}

/**
 * Детальна історія каси.
 *
 * Зведені цифри не кажуть, звідки вони взялись. Тут кожен рух окремо: хто,
 * коли, за що і чи вносив завдаток до того.
 */
export default function Journal({ entries }: { entries: MoneyEntry[] }) {
  if (entries.length === 0) {
    return <p className={styles.empty}>За ці дні рухів не було.</p>;
  }

  return (
    <div className={styles.wrap}>
      {groupByDay(entries).map(([day, list]) => {
        const income = list
          .filter((e) => e.kind !== "expense")
          .reduce((s, e) => s + e.amount, 0);
        const outcome = list
          .filter((e) => e.kind === "expense")
          .reduce((s, e) => s + e.amount, 0);

        return (
          <section key={day} className={styles.day}>
            <header className={styles.dayHead}>
              <h3 className={styles.dayName}>{day}</h3>
              <span className={styles.daySum}>
                {income > 0 && <span className={styles.in}>+{uah(income)}</span>}
                {outcome > 0 && <span className={styles.out}>−{uah(outcome)}</span>}
              </span>
            </header>

            <ul className={styles.list}>
              {list.map((e) => (
                <li key={e.id} className={styles.row}>
                  <span className={styles.time}>{time.format(e.at)}</span>

                  <span className={e.kind === "expense" ? styles.tagOut : styles.tagIn}>
                    {kindLabel[e.kind]}
                  </span>

                  <span className={styles.what}>
                    {e.kind === "expense" ? (
                      <>
                        <span className={styles.client}>{e.category}</span>
                        {e.note && <span className={styles.detail}>{e.note}</span>}
                      </>
                    ) : (
                      <>
                        <Link href={`/admin/zayavky?q=${e.orderNo}`} className={styles.client}>
                          №&#8202;{e.orderNo} · {e.client}
                        </Link>

                        <span className={styles.detail}>
                          {[e.model, e.service].filter(Boolean).join(" · ")}
                          {e.phone && <> · {e.phone}</>}
                        </span>

                        {e.kind === "paid" && (
                          <span className={styles.detail}>
                            {e.prepaidAt && e.prepayment ? (
                              <>
                                завдаток {uah(e.prepayment)} внесено{" "}
                                {shortDate.format(e.prepaidAt)} · доплата при видачі
                              </>
                            ) : (
                              <>без завдатку · оплата повністю при видачі</>
                            )}
                            {e.partsCost ? <> · деталь {uah(e.partsCost)}</> : null}
                          </span>
                        )}
                      </>
                    )}
                  </span>

                  <span className={e.kind === "expense" ? styles.amountOut : styles.amountIn}>
                    {e.kind === "expense" ? "−" : "+"}
                    {uah(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
