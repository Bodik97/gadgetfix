import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBoardLeads, getPartnerPrices, getPointCounts, isPoint, POINTS, type Point } from "@/db/board";
import { unreadByLead } from "@/db/messages";
import { currentTeam } from "@/lib/admin";
import { BOARD_STAGES, isOverdue } from "@/lib/stage";
import Board from "./Board";
import OrderTable from "./OrderTable";
import OnlineIntake from "./OnlineIntake";
import { boardHref, type BoardParams } from "./params";
import styles from "./board.module.css";

export const metadata: Metadata = {
  title: "Заявки — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * «Заявки» — найчастіший екран: дошка за етапами або щільний список.
 * Фільтри живуть в адресі (?point=online&mine=1), тож їх видно після оновлення
 * сторінки й ними можна поділитися.
 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const team = await currentTeam();
  if (!team) redirect("/admin/vhid");

  const raw = await searchParams;
  const params: BoardParams = {
    view: raw.view === "list" || raw.q ? "list" : "board",
    point: isPoint(raw.point) ? raw.point : "all",
    q: raw.q?.trim() || undefined,
    mine: raw.mine === "1",
    late: raw.late === "1",
  };

  const [rows, counts, prices] = await Promise.all([
    getBoardLeads({
      point: params.point as Point,
      q: params.q,
      mine: params.mine ? team.me : undefined,
      lateOnly: params.late,
    }),
    getPointCounts(),
    params.point === "online" ? getPartnerPrices() : Promise.resolve([]),
  ]);
  const unread = await unreadByLead(rows.map((r) => r.id), "client");

  const now = new Date();
  const lateCount = rows.filter((r) => isOverdue(r, now)).length;
  const readyCount = rows.filter((r) => r.stage === "ready").length;
  const onBoard = rows.filter((r) => BOARD_STAGES.includes(r.stage));

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Заявки</h1>
        <span className={styles.summary}>
          {params.q
            ? `Знайдено: ${rows.length}`
            : `${rows.length} активних · ${readyCount} готові до видачі`}
        </span>

        {/* Пошук — звичайна GET-форма: працює й без JavaScript */}
        <form action="/admin/zayavky" className={styles.searchForm}>
          <label htmlFor="board-q" className="visually-hidden">
            Пошук заявки
          </label>
          <input
            id="board-q"
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder="№, модель, клієнт, телефон"
            className={styles.searchInput}
          />
          {params.point !== "all" && <input type="hidden" name="point" value={params.point} />}
        </form>

        <span className={styles.tabs} role="group" aria-label="Вигляд">
          <Link
            href={boardHref(params, { view: "board", q: undefined })}
            className={params.view === "board" ? styles.tabOn : styles.tab}
            aria-current={params.view === "board" ? "page" : undefined}
          >
            Дошка
          </Link>
          <Link
            href={boardHref(params, { view: "list" })}
            className={params.view === "list" ? styles.tabOn : styles.tab}
            aria-current={params.view === "list" ? "page" : undefined}
          >
            Список
          </Link>
        </span>
      </header>

      <div className={styles.filters}>

        <span className={styles.segment} role="group" aria-label="Точка">
          {POINTS.map((p) => (
            <Link
              key={p.value}
              href={boardHref(params, { point: p.value })}
              className={params.point === p.value ? styles.segOn : styles.seg}
              aria-current={params.point === p.value ? "true" : undefined}
            >
              {p.label}
              {counts[p.value] > 0 && <span className={styles.segCount}>{counts[p.value]}</span>}
            </Link>
          ))}
        </span>

        <Link
          href={boardHref(params, { mine: !params.mine })}
          className={params.mine ? styles.chipOn : styles.chip}
          aria-pressed={params.mine}
        >
          Мої
        </Link>
        <Link
          href={boardHref(params, { late: !params.late })}
          className={params.late ? styles.chipLateOn : lateCount > 0 ? styles.chipLate : styles.chip}
          aria-pressed={params.late}
        >
          Прострочені · {lateCount}
        </Link>
      </div>

      {params.point === "online" && !params.q && <OnlineIntake prices={prices} />}

      {params.view === "board" ? (
        <Board rows={onBoard} unread={unread} team={team} now={now} onlineOnly={params.point === "online"} />
      ) : (
        <OrderTable rows={rows} unread={unread} team={team} now={now} />
      )}
    </section>
  );
}
