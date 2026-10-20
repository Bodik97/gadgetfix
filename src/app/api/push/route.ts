import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clientPushSubscriptions } from "@/db/schema";

export const dynamic = "force-dynamic";

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

/** Клієнт увімкнув сповіщення на цьому пристрої */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Увійдіть у кабінет" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sub?: Sub; userAgent?: unknown } | null;
  const endpoint = String(body?.sub?.endpoint ?? "");
  const p256dh = String(body?.sub?.keys?.p256dh ?? "");
  const authKey = String(body?.sub?.keys?.auth ?? "");
  // Endpoint видає браузер, і це завжди https-адреса push-сервісу
  if (!/^https:\/\//.test(endpoint) || !p256dh || !authKey) {
    return NextResponse.json({ error: "Некоректна підписка" }, { status: 400 });
  }

  await getDb()
    .insert(clientPushSubscriptions)
    .values({ clerkUserId: userId, endpoint, p256dh, auth: authKey, userAgent: String(body?.userAgent ?? "").slice(0, 300) })
    .onConflictDoUpdate({ target: clientPushSubscriptions.endpoint, set: { clerkUserId: userId, p256dh, auth: authKey } });

  return NextResponse.json({ ok: true });
}

/** Вимкнув — прибираємо лише свою підписку */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Увійдіть у кабінет" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = String(body?.endpoint ?? "");
  const [row] = await getDb()
    .select({ user: clientPushSubscriptions.clerkUserId })
    .from(clientPushSubscriptions)
    .where(eq(clientPushSubscriptions.endpoint, endpoint))
    .limit(1);
  if (row?.user === userId) {
    await getDb().delete(clientPushSubscriptions).where(eq(clientPushSubscriptions.endpoint, endpoint));
  }
  return NextResponse.json({ ok: true });
}
