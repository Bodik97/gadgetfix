import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getClients } from "@/db/clients";
import { isAdmin } from "@/lib/admin";
import shared from "../page.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Клієнти — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "Europe/Kyiv",
});

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;

/** Українська форма слова за числом: 1 номер, 2 номери, 5 номерів */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;

  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export default async function ClientsPage() {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const clients = await getClients();
  const regulars = clients.filter((c) => c.orders > 1).length;

  return (
    <section className={shared.wrap}>
      <div className={shared.head}>
        <div>
          <div className="kicker">Адміністрування</div>
          <h1 className={shared.title}>Клієнти</h1>
          <p className={shared.sectionNote}>
            Заявки зведені за номером телефону: {clients.length}{" "}
            {plural(clients.length, "номер", "номери", "номерів")}
            {regulars > 0 && (
              <>
                , з них {regulars}{" "}
                {plural(regulars, "звертався", "зверталися", "зверталися")} не вперше
              </>
            )}.
          </p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className={shared.empty}>Заявок із телефоном ще немає.</div>
      ) : (
        <ul className={styles.list}>
          {clients.map((c) => (
            <li key={c.key}>
              <Link href={`/admin/zayavky?q=${encodeURIComponent(c.phone)}`} className={styles.row}>
                <span className={styles.name}>
                  {c.name}
                  {c.orders > 1 && <span className={styles.regular}>постійний</span>}
                </span>

                <span className={styles.phone}>{c.phone}</span>

                <span className={styles.cell}>
                  <span className={styles.cellLabel}>звернень</span>
                  {c.orders}
                </span>

                <span className={styles.cell}>
                  <span className={styles.cellLabel}>оплачено</span>
                  {uah(c.paid)}
                </span>

                <span className={styles.cell}>
                  <span className={styles.cellLabel}>останнє</span>
                  {dateFormat.format(c.lastAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
