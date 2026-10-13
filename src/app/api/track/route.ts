import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { siteEvents } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { deviceOf, isBot, parseEvent, visitorHash } from "@/lib/track";

/**
 * Приймає перегляд сторінки чи клік на кнопку — для статистики в адмінці.
 *
 * Відповідь завжди 204: статистика не повинна нічого ламати на сайті, а
 * стороннім не варто підказувати, яку саме подію відкинуто.
 */
export async function POST(request: Request) {
  const done = new NextResponse(null, { status: 204 });

  const ua = request.headers.get("user-agent") ?? "";
  if (isBot(ua)) return done;

  // Лише зі свого сайту: чужа сторінка не має накручувати нам цифри
  const host = request.headers.get("host") ?? "";
  const origin = request.headers.get("origin");
  if (origin && origin !== `https://${host}` && origin !== `http://${host}`) return done;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return done;
  }

  const event = parseEvent(body, host.split(":")[0]);
  if (!event) return done;

  // Майстер, який перевіряє сайт, — не відвідувач
  if (await isAdmin()) return done;

  // Щедра межа: живій людині не заважає, а накрутити цифри чи забити таблицю не дає
  const ip = clientIp(request);
  try {
    if (!(await rateLimit(`track:ip:${ip}`, 120, 60_000)).ok) return done;
  } catch (error) {
    console.error("[track] ліміт не перевірено:", error);
    return done;
  }

  const salt = process.env.ADMIN_SESSION_SECRET || process.env.DATABASE_URL || "";
  const day = new Date().toISOString().slice(0, 10);

  try {
    await getDb().insert(siteEvents).values({
      ...event,
      visitor: visitorHash(ip, ua, day, salt),
      device: deviceOf(ua),
    });
  } catch (error) {
    console.error("[track] подію не записано:", error);
  }

  return done;
}
