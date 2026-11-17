import { getToday } from "@/db/today";
import { sendPush } from "@/lib/push";

/**
 * Ранковий підсумок майстрам push-ом: прострочено, видати, чекають відповіді, на паузі.
 * Запускає Vercel Cron (vercel.json) щодня зранку.
 *
 * Адреса публічна, тож пускаємо лише з секретом: Vercel сам додає
 * «Authorization: Bearer <CRON_SECRET>», якщо змінна CRON_SECRET задана в проєкті.
 * Без секрету маршрут вимкнений.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Немає доступу", { status: 401 });
  }

  const { tiles, rows } = await getToday();
  const parts = [
    tiles.late > 0 ? `прострочено ${tiles.late}` : "",
    tiles.ready > 0 ? `видати ${tiles.ready}` : "",
    tiles.approval > 0 ? `чекають відповіді ${tiles.approval}` : "",
    tiles.paused > 0 ? `на паузі ${tiles.paused}` : "",
  ].filter(Boolean);
  const fresh = rows.filter((r) => r.kind === "take").length;
  if (fresh > 0) parts.push(`нових ${fresh}`);

  const sent = await sendPush({
    title: "Доброго ранку · план на день",
    body: parts.length > 0 ? `${parts.join(" · ")}.` : "Нічого не горить — гарного дня!",
    url: "/admin",
    tag: "morning",
  });

  return Response.json({ sent });
}
