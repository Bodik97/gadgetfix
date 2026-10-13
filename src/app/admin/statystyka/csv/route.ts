import { getSiteStats } from "@/db/siteStats";
import { isAdmin } from "@/lib/admin";
import { resolveRange } from "../../groshi/period";
import { CLICK_LABELS, DEVICE_LABELS, DIRECT } from "../labels";

/**
 * Один стовпчик CSV: лапки подвоюємо, бо всередині може бути «;» або перенос.
 * Текст, що починається з «=», «+», «-», «@», Excel виконав би як формулу —
 * а шлях сторінки чи джерело приходять ззовні. Апостроф попереду лишає його текстом.
 */
function cell(v: string | number): string {
  const s = typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

const row = (...cells: (string | number)[]) => cells.map(cell).join(";");

/**
 * Вивантаження статистики сайту за період — ті самі таблиці, що на сторінці.
 *
 * Крапка з комою й BOM — щоб Excel відкривав файл одразу по стовпчиках,
 * а кирилиця не перетворювалась на кракозябри.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Немає доступу", { status: 403 });

  const params = new URL(request.url).searchParams;
  const range = resolveRange({
    period: params.get("period") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  const s = await getSiteStats(range.from, range.to);

  const lines = [
    row("Період", range.fromDay, range.toDay),
    "",
    row("Підсумок", "Значення"),
    row("Відвідувачів", s.visitors),
    row("Переглядів сторінок", s.views),
    "",
    row("Воронка", "Кількість"),
    row("Зайшли на сайт", s.funnel.visitors),
    row("Натиснули «Записатись»", s.funnel.intent),
    row("Надіслали заявку", s.funnel.leads),
    row("Заявка стала ремонтом", s.funnel.repairs),
    "",
    row("Кнопка", "Кліків", "Людей"),
    ...s.clicks.map((c) => row(CLICK_LABELS[c.name] ?? c.name, c.clicks, c.visitors)),
    "",
    row("Сторінка", "Переглядів", "Людей"),
    ...s.pages.map((p) => row(p.path, p.views, p.visitors)),
    "",
    row("Джерело", "Відвідувачів"),
    ...s.sources.map((x) => row(x.source || DIRECT, x.visitors)),
    "",
    row("Пристрій", "Відвідувачів"),
    ...s.devices.map((d) => row(DEVICE_LABELS[d.device] ?? d.device, d.visitors)),
  ];

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gadgetfix-statystyka-${range.fromDay}_${range.toDay || "dosi"}.csv"`,
      "cache-control": "no-store",
    },
  });
}
