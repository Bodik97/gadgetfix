import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getToday, type ActionRow } from "@/db/today";
import { currentTeam } from "@/lib/admin";
import { orderLabel, STAGE_LABEL } from "@/lib/stage";
import PushToggle from "./PushToggle";
import { moveStage, remindPrice } from "./zayavky/actions";
import styles from "./today.module.css";

export const metadata: Metadata = {
  title: "Огляд — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const weekday = new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Kyiv" });

/**
 * «Огляд» за docs/admin-handoff/design/Today.dc.html: чотири плитки (кожна
 * веде на відфільтровані заявки), «Потрібна дія» — рядки з кнопкою, і хто чим зайнятий.
 */
export default async function AdminOverview() {
  const team = await currentTeam();
  if (!team) redirect("/admin/vhid");

  const { active, tiles, rows, more } = await getToday();
  const me = team.names[team.me] ?? "";
  const today = weekday.format(new Date());

  return (
    <section className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Огляд</h1>
        <span className={styles.hello}>
          {today[0].toUpperCase() + today.slice(1)} · Вітаємо, {me}
        </span>
      </header>

      <div className={styles.tiles}>
        <Link href="/admin/zayavky?view=list&late=1" className={tiles.late > 0 ? styles.tileRed : styles.tile}>
          <span className={styles.tileN}>{tiles.late}</span>
          <span>Прострочено</span>
        </Link>
        <Link href="/admin/zayavky?view=list&only=ready" className={tiles.ready > 0 ? styles.tileLime : styles.tile}>
          <span className={styles.tileN}>{tiles.ready}</span>
          <span>Видати</span>
        </Link>
        <Link href="/admin/zayavky?view=list&only=approval" className={tiles.approval > 0 ? styles.tileAmber : styles.tile}>
          <span className={styles.tileN}>{tiles.approval}</span>
          <span>Чекають відповіді</span>
        </Link>
        <Link href="/admin/zayavky?view=list&only=paused" className={styles.tile}>
          <span className={styles.tileN}>{tiles.paused}</span>
          <span>На паузі</span>
        </Link>
      </div>

      <div className={styles.grid}>
        <section className={styles.actions} aria-labelledby="need-title">
          <h2 id="need-title" className={styles.h2}>
            Потрібна дія
          </h2>
          {rows.length === 0 ? (
            <p className={styles.empty}>Усе під контролем — нічого не горить.</p>
          ) : (
            <div className={styles.rows}>
              {rows.map((r) => (
                <Row key={r.lead.id} row={r} />
              ))}
              {more > 0 && (
                <Link href="/admin/zayavky?view=list" className={styles.more}>
                  Ще {more} — у списку заявок →
                </Link>
              )}
            </div>
          )}
        </section>

        <aside className={styles.busy} aria-labelledby="busy-title">
          <h2 id="busy-title" className={styles.h2}>
            Хто чим зайнятий
          </h2>
          {Object.entries(team.names).map(([email, name], i) => {
            const mine = active.filter((l) => l.assignee === email);
            return (
              <div key={email} className={styles.person}>
                <div className={styles.personHead}>
                  <span className={i === 0 ? styles.avatarOwner : styles.avatarMaster}>{name.slice(0, 1).toUpperCase()}</span>
                  <span className={styles.personName}>
                    {name}
                    {email === team.me && <span className={styles.muted}> · ви</span>}
                  </span>
                  <span className={styles.personN}>{mine.length}</span>
                </div>
                {mine.length === 0 ? (
                  <p className={styles.muted}>Вільний — заявок не взято.</p>
                ) : (
                  mine.slice(0, 6).map((l) => (
                    <Link key={l.id} href={`/admin/zayavky/${l.id}`} className={styles.personRow}>
                      <span>
                        <span className={styles.no}>{orderLabel(l)}</span> {l.model}
                      </span>
                      <span className={styles.muted}>{l.flag === "paused" ? "пауза" : STAGE_LABEL[l.stage]}</span>
                    </Link>
                  ))
                )}
              </div>
            );
          })}
          {active.some((l) => !l.assignee) && (
            <Link href="/admin/zayavky" className={styles.more}>
              Нічиїх: {active.filter((l) => !l.assignee).length} →
            </Link>
          )}
        </aside>
      </div>

      {/* Сповіщення на цей телефон — без них сигнали видно, лише коли адмінка відкрита */}
      <PushToggle />
    </section>
  );
}

const ACTION_LABEL: Record<ActionRow["kind"], string> = {
  call: "Подзвонити",
  reply: "Відповісти",
  remind: "Нагадати",
  take: "Взяти собі",
  issue: "Видати →",
  give: "Віддати",
  open: "Відкрити",
};

/** Рядок «Потрібна дія»: 4 колонки (№ · що · мітка · кнопка), вирівняні між рядками */
function Row({ row }: { row: ActionRow }) {
  const { lead, kind, tag, tone } = row;
  const href = `/admin/zayavky/${lead.id}`;
  const what = [lead.problems.join(", ") || lead.service || lead.problem, lead.channel === "own" ? lead.name : lead.externalNo]
    .filter(Boolean)
    .join(" · ");
  const main = kind === "issue" || kind === "give";

  let button: React.ReactNode;
  if (kind === "call") {
    button = (
      <a href={`tel:${(lead.phone ?? "").replace(/[^\d+]/g, "")}`} className={styles.btnSoft}>
        {ACTION_LABEL.call}
      </a>
    );
  } else if (kind === "remind") {
    button = (
      <form action={remindPrice}>
        <input type="hidden" name="id" value={lead.id} />
        <button type="submit" className={styles.btnSoft}>
          {ACTION_LABEL.remind}
        </button>
      </form>
    );
  } else if (kind === "take" || kind === "give") {
    button = (
      <form action={moveStage}>
        <input type="hidden" name="id" value={lead.id} />
        <input type="hidden" name="to" value={kind === "give" ? "issued" : lead.channel === "online" ? "in_progress" : "diagnostics"} />
        <button type="submit" className={main ? styles.btnMain : styles.btnSoft}>
          {kind === "take" && lead.channel === "online" ? "Взяти" : ACTION_LABEL[kind]}
        </button>
      </form>
    );
  } else {
    button = (
      <Link href={href} className={main ? styles.btnMain : styles.btnSoft}>
        {ACTION_LABEL[kind]}
      </Link>
    );
  }

  return (
    <div className={tone === "red" ? styles.rowRed : styles.row}>
      <Link href={href} className={styles.no}>
        {orderLabel(lead)}
      </Link>
      <Link href={href} className={styles.what}>
        <b>{lead.model ?? "—"}</b> <span className={styles.muted}>· {what}</span>
      </Link>
      <span className={styles[`tag_${tone}`]}>{lead.deliveryRequested && kind === "issue" ? "відправити НП" : tag}</span>
      {button}
    </div>
  );
}
