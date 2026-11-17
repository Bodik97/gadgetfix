import { getMonthLeads, getSettlement, isMonthKey } from "@/db/online";
import { isOwner } from "@/lib/admin";
import { orderLabel } from "@/lib/stage";

/**
 * Акт звірки з магазином «Онлайн» за місяць — для друку або «Зберегти як PDF»
 * у вікні друку браузера. Окремий HTML без меню й теми сайту, як квитанція.
 */
const esc = (v: unknown) =>
  String(v ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
const uah = (n: number) => `${n.toLocaleString("uk-UA")} грн`;
const day = new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kyiv" });

export async function GET(req: Request) {
  if (!(await isOwner())) return new Response("Немає доступу", { status: 403 });

  const month = new URL(req.url).searchParams.get("month");
  if (!isMonthKey(month)) return new Response("Не той місяць", { status: 400 });

  const [rows, settlement] = await Promise.all([getMonthLeads(month), getSettlement(month)]);
  const amount = rows.reduce((s, r) => s + (r.price ?? 0), 0);
  const fee = settlement?.fee ?? 0;
  const [y, m] = month.split("-");
  const period = `${m}.${y}`;

  const body = rows
    .map(
      (r, i) => `<tr><td>${i + 1}</td><td>${esc(orderLabel(r))}</td><td>${esc(r.externalNo ?? "")}</td><td>${esc(r.model)} — ${esc(r.service)}</td><td>${r.issuedAt ? day.format(r.issuedAt) : ""}</td><td class="n">${uah(r.price ?? 0)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<title>Акт звірки ${esc(period)} — магазин «Онлайн»</title>
<style>
@page { size: A4; margin: 16mm }
body { font-family: system-ui, sans-serif; color: #000; font-size: 11pt }
h1 { font-size: 16pt; margin: 0 0 4mm }
p { margin: 0 0 3mm }
table { width: 100%; border-collapse: collapse; margin: 4mm 0 }
th, td { border: 1px solid #999; padding: 2mm 3mm; text-align: left; vertical-align: top }
th { background: #f2f2ec }
.n { text-align: right; white-space: nowrap }
.total td { font-weight: 700 }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 20mm; margin-top: 18mm }
.sign div { border-top: 1px solid #000; padding-top: 2mm; font-size: 9pt }
@media screen { body { max-width: 190mm; margin: 24px auto } }
</style></head><body onload="print()">
<h1>Акт звірки за ${esc(period)}</h1>
<p>Ремонт телефонів для магазину «Онлайн». Ціни — за прайсом магазину, разом із деталлю.</p>
<table>
<thead><tr><th>#</th><th>Наш №</th><th>№ магазину</th><th>Пристрій і робота</th><th>Віддали</th><th class="n">Ціна</th></tr></thead>
<tbody>${body}
<tr class="total"><td colspan="5">Разом: ${rows.length} ремонт(ів)</td><td class="n">${uah(amount)}</td></tr>
${fee > 0 ? `<tr><td colspan="5">Утримано магазином</td><td class="n">−${uah(fee)}</td></tr><tr class="total"><td colspan="5">До оплати</td><td class="n">${uah(amount - fee)}</td></tr>` : ""}
</tbody></table>
${settlement?.paidAt ? `<p>Оплачено ${day.format(settlement.paidAt)}.</p>` : ""}
<div class="sign"><div>Від сервісу GadgetFix — підпис</div><div>Від магазину «Онлайн» — підпис</div></div>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
