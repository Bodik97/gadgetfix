import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCounters, getMoney, monthStart } from "@/db/adminStats";
import { getExpenseTotal } from "@/db/expenses";
import { getSignals, getWorkload } from "@/db/signals";
import { STATUS_OPTIONS } from "@/data/leadStatus";
import { adminDirectory, currentAdmin } from "@/lib/admin";
import Age from "./Age";
import PushToggle from "./PushToggle";
import { leadLink } from "@/lib/adminLinks";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Огляд — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Сайт обіцяє передзвонити протягом 25 хвилин — довше нова заявка вже прострочена */
const CALLBACK_MIN = 25;

const openLead = leadLink;

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export default async function AdminOverview() {
  const master = await currentAdmin();
  if (!master) redirect("/admin/vhid");

  const [counters, money, spent, signals, workload] = await Promise.all([
    getCounters(),
    getMoney(monthStart()),
    // «Чистими» — як у касі: без деталей і без витрат сервісу
    getExpenseTotal(monthStart()),
    getSignals(),
    getWorkload(),
  ]);

  // Свої заявки першими — їх майстер шукає очима найчастіше
  const team = adminDirectory().sort((a, b) => Number(b.email === master.email) - Number(a.email === master.email));
  const nameOf = (email: string) => team.find((a) => a.email === email)?.name ?? email.split("@")[0];
  const statusLabel = (v: string) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;

  const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;
  const total =
    signals.fresh.length + signals.chats.length + signals.ship.length + signals.reviews.length;

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className="kicker">Адміністрування</div>
          <h1 className={styles.title}>Огляд</h1>
          <p className={styles.hello}>Вітаємо, {master.name}</p>
        </div>
        <Link href="/admin/nova" className={`btn btn-accent ${styles.newLead}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Нова заявка
        </Link>
      </div>

      {/* Сповіщення на цей телефон — без них сигнали видно, лише коли адмінка відкрита */}
      <PushToggle />

      {/* Сигнали — те, що чекає на майстра зараз. Найстаріше в кожній групі першим */}
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          Сигнали
          {total > 0 && <span className={styles.signalCount}>{total}</span>}
        </h2>
      </div>

      {total === 0 ? (
        <div className={styles.empty}>Усе оброблено: нових заявок, повідомлень і відгуків немає.</div>
      ) : (
        <div className={styles.signals}>
          {signals.fresh.length > 0 && (
            <div className={styles.signalGroup}>
              <h3 className={styles.signalHead}>Нові заявки — передзвонити</h3>
              {signals.fresh.map((f) => (
                <div key={f.leadId} className={styles.signal}>
                  <div className={styles.signalBody}>
                    <div className={styles.signalTitle}>
                      <span className={styles.signalNo}>№&#8202;{f.orderNo}</span>
                      {f.name}
                      {f.assignee &&
                        (f.assignee === master.email ? (
                          <span className={styles.tagMine}>ваша</span>
                        ) : (
                          <span className={styles.tagTaken}>бере: {nameOf(f.assignee)}</span>
                        ))}
                      <Age at={f.at.toISOString()} overdueMin={CALLBACK_MIN} />
                    </div>
                    <div className={styles.signalText}>
                      {[f.what, f.phone].filter(Boolean).join(" · ") || "Без деталей"}
                    </div>
                  </div>
                  <div className={styles.signalActions}>
                    {f.phone && (
                      <a href={tel(f.phone)} className="btn btn-accent">
                        Подзвонити
                      </a>
                    )}
                    <Link href={openLead(f.orderNo, f.leadId)} className="btn btn-ghost">
                      Відкрити
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {signals.chats.length > 0 && (
            <div className={styles.signalGroup}>
              <h3 className={styles.signalHead}>Повідомлення від клієнтів</h3>
              {signals.chats.map((c) => (
                <div key={c.leadId} className={styles.signal}>
                  <div className={styles.signalBody}>
                    <div className={styles.signalTitle}>
                      <span className={styles.signalNo}>№&#8202;{c.orderNo}</span>
                      {c.name}
                      {c.count > 1 && <span className={styles.tagHot}>{c.count}</span>}
                      <Age at={c.at.toISOString()} />
                    </div>
                    <div className={styles.signalText}>{c.lastText}</div>
                  </div>
                  <div className={styles.signalActions}>
                    <Link href={openLead(c.orderNo, c.leadId)} className="btn btn-accent">
                      Відповісти
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {signals.ship.length > 0 && (
            <div className={styles.signalGroup}>
              <h3 className={styles.signalHead}>Чекають відправки — вписати ТТН</h3>
              {signals.ship.map((sh) => (
                <div key={sh.leadId} className={styles.signal}>
                  <div className={styles.signalBody}>
                    <div className={styles.signalTitle}>
                      <span className={styles.signalNo}>№&#8202;{sh.orderNo}</span>
                      {sh.name}
                      <Age at={sh.at.toISOString()} />
                    </div>
                    <div className={styles.signalText}>{sh.address ?? "Адресу не вказано"}</div>
                  </div>
                  <div className={styles.signalActions}>
                    <Link href={openLead(sh.orderNo, sh.leadId)} className="btn btn-accent">
                      Вписати ТТН
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {signals.reviews.length > 0 && (
            <div className={styles.signalGroup}>
              <h3 className={styles.signalHead}>Нові відгуки — на модерацію</h3>
              {signals.reviews.map((rv) => (
                <div key={rv.id} className={styles.signal}>
                  <div className={styles.signalBody}>
                    <div className={styles.signalTitle}>
                      <span className={styles.stars} role="img" aria-label={`Оцінка ${rv.rating} з 5`}>
                        {"★".repeat(rv.rating)}
                        <span className={styles.starsOff} aria-hidden="true">{"★".repeat(5 - rv.rating)}</span>
                      </span>
                      {rv.author}
                      <Age at={rv.at.toISOString()} />
                    </div>
                    <div className={styles.signalText}>{rv.text}</div>
                  </div>
                  <div className={styles.signalActions}>
                    <Link href="/admin/vidhuky" className="btn btn-accent">
                      Модерувати
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Хто чим зайнятий — щоб майстри не брали ту саму заявку двічі */}
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Хто чим зайнятий</h2>
      </div>

      <div className={styles.team}>
        {team.map((a) => {
          const items = workload.byAdmin.get(a.email) ?? [];
          return (
            <div key={a.email} className={styles.member}>
              <div className={styles.memberHead}>
                <span className={styles.memberMark} aria-hidden="true">
                  {a.name.slice(0, 1).toUpperCase()}
                </span>
                <span className={styles.memberName}>
                  {a.name}
                  {a.email === master.email && <span className={styles.memberYou}> · ви</span>}
                </span>
                <span className={styles.memberCount}>{items.length}</span>
              </div>

              {items.length === 0 ? (
                <p className={styles.memberEmpty}>Вільний — заявок не взято.</p>
              ) : (
                <ul className={styles.memberList}>
                  {items.map((it) => (
                    <li key={it.leadId}>
                      <Link href={openLead(it.orderNo, it.leadId)} className={styles.memberItem}>
                        <span className={styles.signalNo}>№&#8202;{it.orderNo}</span>
                        <span className={styles.memberWhat}>{it.what ?? it.name}</span>
                        <span className={styles.memberStatus}>{statusLabel(it.status)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {workload.unassigned > 0 && (
        <p className={styles.unassigned}>
          Ще не взято: <strong>{workload.unassigned}</strong> — у{" "}
          <Link href="/admin/zayavky">списку заявок</Link> натисніть «Взяти собі».
        </p>
      )}

      <div className={styles.summary}>
        <Link href="/admin/zayavky" className={styles.stat}>
          <span className={styles.statValue}>{counters.total}</span>
          <span className={styles.statLabel}>заявок усього</span>
        </Link>
        <Link
          href="/admin/zayavky?status=new"
          className={counters.fresh > 0 ? styles.statHot : styles.stat}
        >
          <span className={styles.statValue}>{counters.fresh}</span>
          <span className={styles.statLabel}>нових</span>
        </Link>
        <Link
          href="/admin/zayavky?shipping=1"
          className={counters.toShip > 0 ? styles.statHot : styles.stat}
        >
          <span className={styles.statValue}>{counters.toShip}</span>
          <span className={styles.statLabel}>чекають відправки</span>
        </Link>
        <Link href="/admin/groshi" className={styles.stat}>
          <span className={styles.statValue}>{uah(money.profit - spent)}</span>
          <span className={styles.statLabel}>чистими за місяць</span>
        </Link>
      </div>
    </section>
  );
}
