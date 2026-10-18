import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { ownsLead } from "@/db/messages";
import { isAdmin } from "./admin";
import { verifiedEmail } from "@/lib/verifiedEmail";

export type ChatSide = "client" | "master";

/**
 * Чи має право писати/читати цей чат від імені вказаного боку.
 *
 * Бік задає та сторінка, з якої прийшов запит, а не те, ким людина є взагалі:
 * майстер, залогінений і як клієнт, зі своєї сторінки пише саме як клієнт.
 * Інакше його повідомлення підписувались би «майстер» у власному ж чаті.
 */
export async function canUseChat(leadId: string, side: ChatSide): Promise<boolean> {
  if (side === "master") return isAdmin();

  const user = await currentUser();
  if (!user) return false;

  return ownsLead(leadId, user.id, verifiedEmail(user));
}
