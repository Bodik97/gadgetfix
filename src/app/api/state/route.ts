import { NextResponse } from "next/server";
import { and, count, eq, isNull, max, or, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { leadMessages, leads, reviews } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { verifiedEmail } from "@/lib/verifiedEmail";

export const dynamic = "force-dynamic";

/**
 * Відбиток стану — одне коротке значення, що змінюється, коли з'явилось щось
 * нове: інший статус, нова заявка, нове повідомлення.
 *
 * Сторінка питає його раз на кілька секунд і, якщо він змінився, оновлює себе.
 * Дешевше за перезавантаження всієї сторінки й не потребує вебсокетів.
 */
export async function GET() {
  if (await isAdmin()) {
    const [row] = await getDb()
      .select({
        leads: count(),
        updated: max(leads.updatedAt),
      })
      .from(leads);

    const [msg] = await getDb()
      .select({ unread: count() })
      .from(leadMessages)
      .where(and(eq(leadMessages.author, "client"), isNull(leadMessages.readAt)));

    // Новий відгук теж сигнал на головній — без нього сторінка про нього не дізналась би
    const [rev] = await getDb()
      .select({ pending: count() })
      .from(reviews)
      .where(eq(reviews.published, false));

    return NextResponse.json({
      version: `${row.leads}:${row.updated?.getTime() ?? 0}:${msg.unread}:${rev.pending}`,
    });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ version: null });

  const email = verifiedEmail(user);
  const mine = email
    ? or(eq(leads.clerkUserId, user.id), eq(leads.email, email))
    : eq(leads.clerkUserId, user.id);

  const [row] = await getDb()
    .select({ leads: count(), updated: max(leads.updatedAt) })
    .from(leads)
    .where(mine);

  // Непрочитані від майстра — щоб значок у чаті теж оживав сам
  const [msg] = await getDb()
    .select({ unread: count() })
    .from(leadMessages)
    .where(
      and(
        eq(leadMessages.author, "master"),
        isNull(leadMessages.readAt),
        sql`${leadMessages.leadId} in (select id from ${leads} where ${mine})`,
      ),
    );

  return NextResponse.json({
    version: `${row.leads}:${row.updated?.getTime() ?? 0}:${msg.unread}`,
    // Для значка в шапці: скільки повідомлень майстра клієнт ще не бачив
    unread: msg.unread,
  });
}
