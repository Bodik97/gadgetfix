import "server-only";
import { describeStatus } from "@/data/leadStatus";
import type { Lead } from "@/db/schema";
import { sendClientPush } from "./clientPush";

/** Push клієнту про новий статус — якщо він увімкнув сповіщення в кабінеті */
export async function pushStatusToClient(lead: Lead, next: Lead["status"]): Promise<void> {
  if (!lead.clerkUserId) return;
  const s = describeStatus(next);
  await sendClientPush(lead.clerkUserId, {
    title: `№${lead.orderNo}: ${s.label}`,
    body: s.hint,
    url: "/moi-remonty",
    tag: `status-${lead.id}`,
  }).catch((e) => console.error("[status] push клієнту:", e));
}
