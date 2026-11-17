import { and, asc, desc, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "./index";
import { leads, partnerPrices, type Lead, type PartnerPrice } from "./schema";

/**
 * Дані для «Заявок»: дошка й список.
 *
 * Точка «магазин Онлайн» — це channel = 'online'; решта точок — поле location
 * у своїх заявках. «Інші» — інше місто (назва в city).
 */
export type Point = "all" | "lviv" | "novyi-rozdil" | "online" | "other";

export const POINTS: { value: Point; label: string }[] = [
  { value: "all", label: "Усі" },
  { value: "lviv", label: "Львів" },
  { value: "novyi-rozdil", label: "Новий Розділ" },
  { value: "online", label: "магазин Онлайн" },
  { value: "other", label: "Інші" },
];

export const isPoint = (v: unknown): v is Point => POINTS.some((p) => p.value === v);

function pointWhere(point: Point): SQL | undefined {
  switch (point) {
    case "all":
      return undefined;
    case "online":
      return eq(leads.channel, "online");
    default:
      return and(eq(leads.channel, "own"), eq(leads.location, point));
  }
}

/** Активна = ще не віддана і не відмова */
const active = and(ne(leads.stage, "issued"), or(isNull(leads.flag), ne(leads.flag, "refused")));

/**
 * Пошук: №1092, О-218, М-4486, імʼя, телефон, модель, поломка.
 * Номер із «№»/«О-» шукаємо точно — інакше «12» знаходило б і 1012, і 1120.
 */
function textWhere(q: string): SQL | undefined {
  const text = q.trim();
  if (!text) return undefined;

  const online = /^[оo]-?\s*(\d+)$/i.exec(text);
  if (online) return eq(leads.onlineNo, Number(online[1]));
  // Номер заявки — до 7 цифр; довше — це вже шматок телефону
  const own = /^№?\s*(\d{1,7})$/.exec(text);
  if (own) {
    return or(eq(leads.orderNo, Number(own[1])), ilike(leads.phone, `%${own[1]}%`));
  }

  const like = `%${text.replace(/[%_\\]/g, "\\$&")}%`;
  return or(
    ilike(leads.name, like),
    ilike(leads.phone, like),
    ilike(leads.model, like),
    ilike(leads.problem, like),
    ilike(leads.service, like),
    ilike(leads.externalNo, like),
    ilike(leads.imei, like),
  );
}

/** Вузькі вибірки для плиток «Огляду»: готові до видачі, чекають відповіді, на паузі */
export type Only = "ready" | "approval" | "paused";
export const isOnly = (v: unknown): v is Only => v === "ready" || v === "approval" || v === "paused";
export const ONLY_LABEL: Record<Only, string> = {
  ready: "Видати",
  approval: "Чекають відповіді",
  paused: "На паузі",
};

function onlyWhere(only: Only): SQL {
  return only === "paused" ? eq(leads.flag, "paused") : and(eq(leads.stage, only), isNull(leads.flag))!;
}

export type BoardFilter = {
  point: Point;
  q?: string;
  /** Пошта майстра для «Мої» */
  mine?: string;
  lateOnly?: boolean;
  only?: Only;
};

/**
 * Заявки для дошки й списку. З пошуком шукаємо скрізь, і серед виданих:
 * майстер, вводячи номер чи телефон, хоче знайти саме ту заявку, навіть стару.
 */
export async function getBoardLeads(f: BoardFilter): Promise<Lead[]> {
  const q = f.q?.trim();
  const parts = [
    q ? textWhere(q) : active,
    pointWhere(f.point),
    f.mine ? eq(leads.assignee, f.mine) : undefined,
    f.lateOnly ? sql`${leads.dueAt} < now()` : undefined,
    f.only ? onlyWhere(f.only) : undefined,
  ].filter(Boolean) as SQL[];

  return getDb()
    .select()
    .from(leads)
    .where(and(...parts))
    // Прострочені вгорі, далі за терміном, без терміну — за датою
    .orderBy(
      sql`case when ${leads.dueAt} < now() and ${leads.stage} <> 'issued' then 0 else 1 end`,
      asc(leads.dueAt),
      desc(leads.createdAt),
    )
    .limit(q ? 50 : 500);
}

/** Скільки активних заявок на кожній точці — для чипів фільтра */
export async function getPointCounts(): Promise<Record<Point, number>> {
  const rows = await getDb()
    .select({
      channel: leads.channel,
      location: leads.location,
      n: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(active)
    .groupBy(leads.channel, leads.location);

  const counts: Record<Point, number> = { all: 0, lviv: 0, "novyi-rozdil": 0, online: 0, other: 0 };
  for (const r of rows) {
    counts.all += r.n;
    if (r.channel === "online") counts.online += r.n;
    else if (r.location) counts[r.location] += r.n;
  }
  return counts;
}

/** Прайс магазину «Онлайн» — лише чинні позиції, за моделлю */
export async function getPartnerPrices(): Promise<PartnerPrice[]> {
  return getDb()
    .select()
    .from(partnerPrices)
    .where(eq(partnerPrices.active, true))
    .orderBy(asc(partnerPrices.model), asc(partnerPrices.work));
}
