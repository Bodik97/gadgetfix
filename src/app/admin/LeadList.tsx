import Link from "next/link";
import { redirect } from "next/navigation";
import { ARCHIVED, findLeads, STATUS_OPTIONS } from "@/db/leads";
import { currentTeam } from "@/lib/admin";
import LeadCards from "./LeadCards";
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
        <LeadCards rows={rows} team={team} openId={params.open} />
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
