import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clientPushSubscriptions } from "@/db/schema";
import { pushReady, type PushPayload } from "./push";

/**
 * Push клієнту на всі його пристрої — коли майстер написав чи змінив статус.
 * Повертає, скільки пристроїв прийняли: 0 — push у клієнта немає.
 */
export async function sendClientPush(clerkUserId: string, payload: PushPayload): Promise<number> {
  // pushReady() заодно налаштовує ключі VAPID для web-push
  if (!pushReady()) return 0;

  const rows = await getDb()
    .select()
    .from(clientPushSubscriptions)
    .where(eq(clientPushSubscriptions.clerkUserId, clerkUserId));

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    rows.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 24 * 60 * 60, urgency: "high" },
        );
        delivered++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Клієнт відписався чи очистив браузер — запис більше не потрібен
          await getDb().delete(clientPushSubscriptions).where(eq(clientPushSubscriptions.id, s.id));
        } else {
          console.error("[client-push] не доставлено:", status, e);
        }
      }
    }),
  );

  return delivered;
}
