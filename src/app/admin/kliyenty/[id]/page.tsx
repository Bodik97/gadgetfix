import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { describeStatus } from "@/data/leadStatus";
import { getAccountHistory } from "@/lib/accounts";
import { isAdmin } from "@/lib/admin";
import shared from "../../page.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Клієнт — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Kyiv" });
const dateTime = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;
const via = { google: "Google", password: "Пошта й пароль", code: "Код на пошту" } as const;

/** Історія зареєстрованого клієнта: акаунт, ремонти, відгуки й знижки, гарантія */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const history = await getAccountHistory((await params).id);
  if (!history) notFound();
  const { account: a, leads, reviews, devices } = history;

  return (
    <section className={shared.wrap}>
      <Link href="/admin/kliyenty" className={styles.back}>
        ← Клієнти
      </Link>

      <div className={shared.head}>
        <div>
          <div className="kicker">Клієнт</div>
          <h1 className={shared.title}>{a.name}</h1>
          {a.email && <p className={shared.sectionNote}>{a.email}</p>}
        </div>
      </div>

      {/* Дані акаунта */}
      <dl className={styles.facts}>
        <Fact label="Вхід через" value={via[a.via]} />
        <Fact label="Зареєстрований" value={date.format(a.createdAt)} />
        <Fact label="Останній вхід" value={a.lastSignInAt ? dateTime.format(a.lastSignInAt) : "—"} />
        <Fact label="Ремонтів" value={String(a.repairs)} />
        <Fact label="Оплачено" value={uah(a.paid)} />
        <Fact label="Знижка 15%" value={a.hasDiscount ? "є, не використана" : "немає"} hot={a.hasDiscount} />
      </dl>

      {/* Ремонти */}
      <h2 className={styles.h2}>Ремонти</h2>
      {leads.length === 0 ? (
        <div className={shared.empty}>Заявок ще не було.</div>
      ) : (
        <ul className={styles.rows}>
          {leads.map((l) => {
            const s = describeStatus(l.status);
            return (
              <li key={l.id}>
                <Link href={`/admin/zayavky/${l.id}`} className={styles.row}>
                  <span className={styles.main}>
                    <span className={styles.what}>
                      №{l.orderNo} · {l.model ?? l.service ?? "Ремонт"}
                    </span>
                    {l.problem && <span className={styles.sub}>{l.problem}</span>}
                  </span>
                  <span className={styles.status} data-tone={s.tone}>
                    {s.label}
                  </span>
                  <span className={styles.num}>
                    {l.price !== null ? uah(l.price) : "—"}
                    <span className={styles.sub}>{l.paidAt ? "оплачено" : l.price !== null ? "не оплачено" : ""}</span>
                  </span>
                  <span className={styles.num}>{date.format(l.createdAt)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Відгуки й знижки */}
      <h2 className={styles.h2}>Відгуки й знижки</h2>
      {reviews.length === 0 ? (
        <div className={shared.empty}>Відгуків ще не лишав.</div>
      ) : (
        <ul className={styles.rows}>
          {reviews.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/vidhuky/${r.id}`} className={styles.row}>
                <span className={styles.main}>
                  <span className={styles.what}>
                    <span className={styles.stars} aria-label={`${r.rating} з 5`}>
                      {"★".repeat(r.rating)}
                      <span className={styles.starsOff}>{"★".repeat(5 - r.rating)}</span>
                    </span>{" "}
                    {r.device ?? ""}
                  </span>
                  <span className={styles.sub}>{r.text}</span>
                </span>
                <span className={styles.status} data-tone={r.published ? "done" : "progress"}>
                  {r.published ? "на сайті" : "на перевірці"}
                </span>
                <span className={styles.num}>
                  {r.discountLeadId ? "знижку використано" : r.discountAt ? "знижка 15% є" : "без знижки"}
                </span>
                <span className={styles.num}>{date.format(r.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Гарантія */}
      <h2 className={styles.h2}>Гарантія на пристрої</h2>
      {devices.length === 0 ? (
        <div className={shared.empty}>Пристроїв на гарантії немає.</div>
      ) : (
        <ul className={styles.rows}>
          {devices.map((d) => {
            const active = warrantyActive(d.warrantyUntil);
            return (
              <li key={d.id} className={styles.row}>
                <span className={styles.main}>
                  <span className={styles.what}>{d.name}</span>
                  {d.work && <span className={styles.sub}>{d.work}</span>}
                </span>
                <span className={styles.status} data-tone={active ? "ready" : "closed"}>
                  {active ? "діє" : "завершена"}
                </span>
                <span className={styles.num}>до {date.format(d.warrantyUntil)}</span>
                <span className={styles.num} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Як у кабінеті клієнта (Devices): гарантія діє, доки дата не минула */
function warrantyActive(until: Date): boolean {
  return until.getTime() > Date.now();
}

function Fact({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className={hot ? styles.factHot : styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
