import { and, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { getPaidLeads } from "@/db/adminStats";
import { categoryLabel, getExpenses } from "@/db/expenses";
import { leads } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { resolveRange } from "../period";

/**
 * Один стовпчик CSV: лапки подвоюємо, бо всередині може бути «;» або перенос.
 * Текст, що починається з «=», «+», «-», «@», Excel виконав би як формулу —
 * а імʼя, модель чи коментар вписує клієнт. Апостроф попереду лишає його
 * текстом; так само телефон «+380…» не перетворюється на число.
 * Числа (зокрема відʼємне «чистими») не чіпаємо.
 */
function cell(v: string | number | null): string {
  if (v === null) return "";
  const s = typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

const date = new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeZone: "Europe/Kyiv" });

/**
 * Вивантаження оплачених робіт за період.
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
  const { from, to } = range;

  const [rows, spending] = await Promise.all([getPaidLeads(from, to), getExpenses(from, to)]);

  // Сума передоплати без позначки «внесено» — лише домовленість, грошей у касі
  // не було. getPaidLeads цієї позначки не віддає, тож добираємо її окремо
  const prepaid = new Set(
    rows.length === 0
      ? []
      : (
          await getDb()
            .select({ orderNo: leads.orderNo })
            .from(leads)
            .where(and(inArray(leads.orderNo, rows.map((r) => r.orderNo)), isNotNull(leads.prepaidAt)))
        ).map((r) => r.orderNo),
  );

  const head = ["Номер", "Оплачено", "Клієнт", "Телефон", "Модель", "Послуга", "Ціна", "Деталі", "Передоплата", "Чистими"];
  const body = rows.map((r) => {
    const price = r.price ?? 0;
    const cost = r.partsCost ?? 0;
    return [
      cell(r.orderNo),
      cell(r.paidAt ? date.format(r.paidAt) : ""),
      cell(r.name),
      cell(r.phone),
      cell(r.model),
      cell(r.service),
      cell(price),
      cell(cost),
      cell(prepaid.has(r.orderNo) ? (r.prepayment ?? 0) : 0),
      cell(price - cost),
    ].join(";");
  });

  // Витрати окремим блоком нижче: бухгалтеру потрібні обидві половини в одному файлі
  const spentHead = ["Витрати", "Дата", "На що", "Коментар", "Сума"];
  const spentBody = spending.map((e) =>
    [
      cell(""),
      cell(date.format(e.spentAt)),
      cell(categoryLabel(e.category)),
      cell(e.note),
      cell(e.amount),
    ].join(";"),
  );

  const csv =
    "﻿" +
    [head.map(cell).join(";"), ...body, "", spentHead.map(cell).join(";"), ...spentBody].join(
      "\r\n",
    );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gadgetfix-kasa-${range.fromDay}_${range.toDay || "dosi"}.csv"`,
      "cache-control": "no-store",
    },
  });
}
