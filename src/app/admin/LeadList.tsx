import Link from "next/link";
import { redirect } from "next/navigation";
import { unreadByLead } from "@/db/messages";
import { getEventsFor } from "@/db/adminStats";
import { ARCHIVED, findLeads, STATUS_OPTIONS } from "@/db/leads";
import { getOrderCounts, phoneKey } from "@/db/clients";
import { getPriceHints, hintKey } from "@/db/priceHistory";
import { getReviewDiscounts } from "@/db/reviews";
import { currentTeam } from "@/lib/admin";
import { clientBotReady, linkedLeads } from "@/lib/clientBot";
import LeadCard from "./LeadCard";
import Search, { adminHref, type ListKind, type Query } from "./Search";
import styles from "./page.module.css";

/** Заявок на сторінці — щоб база не віддавала все одразу, коли їх стануть сотні */
const PER_PAGE = 20;

export type ListParams = {
  page?: string;
  q?: string;
  status?: string;
  shipping?: string;
  /** Заявка, яку відкрити одразу розгорнутою — коли прийшли із сигналу */
  open?: string;
};

/**
 * Список заявок — спільний для робочого списку й архіву.
 *
 * Робочий список не показує закритих, архів — показує лише їх. Пошук у
 * робочому списку шукає скрізь: «2-е звернення» веде сюди за телефоном,
 * і майстер має бачити всю історію клієнта, а не лише відкриті заявки.
 */
export default async function LeadList({ kind, params }: { kind: ListKind; params: ListParams }) {
  const team = await currentTeam();
  if (!team) redirect("/admin/vhid");

  const page = Math.max(1, Number(params.page) || 1);

  // Статус лише зі свого набору — чужий з адреси ігноруємо, щоб фільтр не зламав вибірку
  const allowed = STATUS_OPTIONS.filter((o) => ARCHIVED.includes(o.value) === (kind === "archive"));
  const status = allowed.find((o) => o.value === params.status)?.value;
  const shipping = kind === "active" ? params.shipping : undefined;

  const query: Query = { q: params.q, status, shipping };

  const { rows, found } = await findLeads({
    q: params.q,
    status,
    shipping: Boolean(shipping),
    scope: kind === "archive" ? "archive" : params.q ? "all" : "active",
    page,
    perPage: PER_PAGE,
  });

  const pages = Math.max(1, Math.ceil(found / PER_PAGE));
  const ids = rows.map((r) => r.id);
  const [eventsByLead, unread, orderCounts, priceHints, withBot, discounts] = await Promise.all([
    getEventsFor(ids),
    unreadByLead(ids, "client"),
    getOrderCounts(rows.map((r) => r.phone)),
    getPriceHints(),
    linkedLeads(rows),
    getReviewDiscounts(),
  ]);

  // Невикористану знижку показуємо на відкритих заявках клієнта, використану — там, де її врахували
  const discountFor = (r: (typeof rows)[number]) => {
    const applied = discounts.find((d) => d.discountLeadId === r.id);
    if (applied) return { reviewId: applied.id, applied: true };
    if (ARCHIVED.includes(r.status) || !r.clerkUserId) return null;
    const open = discounts.find((d) => !d.discountLeadId && d.clerkUserId === r.clerkUserId);
    return open ? { reviewId: open.id, applied: false } : null;
  };
  const botReady = clientBotReady();

  const filtered = Boolean(params.q || status || shipping);

  return (
    <section className={`${styles.wrap} ${styles.wrapList}`}>
      {/* Заголовок і пошук лишаються на місці — під ними прокручуються лише заявки */}
      <div className={styles.listTop}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{kind === "archive" ? "Архів" : "Заявки"}</h1>
          {kind === "archive" && (
            <p className={styles.hello}>Завершені ремонти й відмови. Пошук працює і тут.</p>
          )}
        </div>
        {kind === "active" && (
          <Link href="/admin/nova" className={`btn btn-accent ${styles.newLead}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Нова заявка
          </Link>
        )}
      </div>

      <Search query={query} found={found} kind={kind} />
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          {filtered
            ? "За цим запитом нічого не знайшли. Спробуйте інший або скиньте фільтр."
            : kind === "archive"
              ? "Архів порожній: закритих заявок ще немає."
              : "Заявок у роботі немає."}
        </div>
      ) : (
        <div className={styles.cards}>
          {rows.map((r) => (
            <LeadCard
              key={r.id}
              lead={r}
              events={eventsByLead.get(r.id) ?? []}
              unread={unread.get(r.id) ?? 0}
              defaultOpen={r.id === params.open}
              team={team}
              telegram={botReady ? withBot.has(r.id) : null}
              discount={discountFor(r)}
              orders={orderCounts.get(phoneKey(r.phone) ?? "") ?? 1}
              /* Заявки без ціни не входять у власну статистику, тож підказка
                 завжди про інші ремонти. Там, де ціна вже стоїть, вона зайва. */
              priceHint={
                r.price === null ? (priceHints.get(hintKey(r.model, r.service) ?? "") ?? null) : null
              }
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className={styles.pager} aria-label="Сторінки заявок">
          {page > 1 && (
            <Link href={adminHref(query, { page: page - 1 }, kind)} className="btn btn-ghost">
              Новіші
            </Link>
          )}
          <span className={styles.pagerInfo}>
            Сторінка {page} з {pages}
          </span>
          {page < pages && (
            <Link href={adminHref(query, { page: page + 1 }, kind)} className="btn btn-ghost">
              Старіші
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
