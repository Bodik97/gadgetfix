import "server-only";
import { and, eq, gte, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateHits } from "@/db/schema";

/**
 * Обмеження частоти звернень.
 *
 * Лічильник у базі, спільний для всіх екземплярів функції. Памʼятний не
 * працює: на Vercel інстансів кілька, запити розкидає між ними, і кожен
 * рахує з нуля — заміряно, що з 30 спроб підбору проходило 15.
 *
 * Підрахунок і запис — одна команда. Двома діями захисту немає: паралельні
 * запити встигають прочитати лічильник до того, як хоч один запише, і
 * проходять усі. Перевірено на 20 одночасних: було 20 з 20, стало 5–6.
 *
 * Лишається вікно між підрахунком і вставкою в межах READ COMMITTED —
 * інколи проходить на одиницю більше за межу. Прибрати його можна лише
 * блокуванням, якому потрібне сесійне зʼєднання, а в HTTP-драйвері Neon
 * його немає. Для наших меж ця одиниця нічого не змінює.
 */
export type Verdict = { ok: true } | { ok: false; retryAfter: number };

/** Довше за це вікон у нас немає: старіші рядки нічиї, їх можна прибирати в будь-кого */
const STALE_MS = 24 * 60 * 60_000;

/** Скільки лишилось до звільнення місця — за найстарішим записом у вікні */
async function retryAfter(subject: string, windowMs: number): Promise<number> {
  const [row] = await getDb()
    .select({ oldest: sql<string | null>`min(${rateHits.at})` })
    .from(rateHits)
    .where(
      and(eq(rateHits.subject, subject), gte(rateHits.at, new Date(Date.now() - windowMs))),
    );

  if (!row?.oldest) return Math.ceil(windowMs / 1000);

  const freeAt = new Date(row.oldest).getTime() + windowMs;
  return Math.max(1, Math.ceil((freeAt - Date.now()) / 1000));
}

/**
 * Займає одне місце у вікні. `ok: false` — місць немає.
 *
 * Місце списується на кожен виклик, зокрема вдалий: де це заважає (успішний
 * вхід майстра), його повертають через `release`.
 */
export async function rateLimit(
  subject: string,
  limit: number,
  windowMs: number,
): Promise<Verdict> {
  const since = new Date(Date.now() - windowMs);

  const res = await getDb().execute(sql`
    insert into ${rateHits} (subject)
    select ${subject}
    where (
      select count(*) from ${rateHits}
      where subject = ${subject} and at >= ${since}
    ) < ${limit}
    returning id
  `);

  if ((res.rows ?? []).length > 0) {
    // Рядки поза вікном більше ні на що не впливають — прибираємо одразу,
    // щоб таблиця не росла. Лише свої: в інших субʼєктів вікно може бути
    // довшим, і їхні записи ще рахуються. Чужі — тільки зовсім давні
    await getDb()
      .delete(rateHits)
      .where(
        or(
          and(eq(rateHits.subject, subject), lt(rateHits.at, since)),
          lt(rateHits.at, new Date(Date.now() - STALE_MS)),
        ),
      );
    return { ok: true };
  }

  return { ok: false, retryAfter: await retryAfter(subject, windowMs) };
}

/** Звільнити всі місця цього субʼєкта — наприклад, після вдалого входу */
export async function release(subject: string): Promise<void> {
  await getDb().delete(rateHits).where(eq(rateHits.subject, subject));
}

/** Адреса, з якої прийшов запит */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
