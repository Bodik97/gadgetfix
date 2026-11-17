import QRCode from "qrcode";
import { getLeadById } from "@/db/events";
import { isAdmin } from "@/lib/admin";
import { orderLabel } from "@/lib/stage";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Наклейка на телефон: великий номер, модель і QR, що відкриває заявку в адмінці.
 * Щоб телефони (особливо від магазину) не переплутались на столі.
 * Розмір 58×40 мм — типова термоетикетка; друкується й на звичайному принтері.
 */
const esc = (v: unknown) =>
  String(v ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Немає доступу", { status: 403 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Не знайдено", { status: 404 });
  const lead = await getLeadById(id);
  if (!lead) return new Response("Не знайдено", { status: 404 });

  const qr = await QRCode.toString(`${siteUrl()}/admin/zayavky/${lead.id}`, { type: "svg", margin: 0 });
  const what = [lead.model, lead.problems.join(", ") || lead.service].filter(Boolean).join(" · ");
  const extra = lead.channel === "online" ? lead.externalNo : lead.name;

  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<title>Наклейка ${esc(orderLabel(lead))}</title>
<style>
@page { size: 58mm 40mm; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: system-ui, sans-serif; color: #000 }
.label { width: 58mm; height: 40mm; padding: 3mm; display: grid; grid-template-columns: 1fr 18mm; gap: 2mm; align-items: start }
.no { font-size: 20pt; font-weight: 800; line-height: 1 }
.what { margin-top: 2mm; font-size: 8.5pt; line-height: 1.2; max-height: 3.6em; overflow: hidden }
.extra { margin-top: 1mm; font-size: 8pt }
.qr svg { width: 18mm; height: 18mm }
@media screen { body { padding: 16px; background: #eee } .label { background: #fff; outline: 1px dashed #999 } }
</style></head><body onload="print()">
<div class="label"><div><div class="no">${esc(orderLabel(lead))}</div><div class="what">${esc(what)}</div><div class="extra">${esc(extra)}</div></div><div class="qr">${qr}</div></div>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
