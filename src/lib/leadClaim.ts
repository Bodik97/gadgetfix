import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { addEvent } from "@/db/events";
import { getClientLeads } from "@/db/leads";
import type { DiscountKind } from "@/data/discounts";

/**
 * Заявку лишили без входу, а потім у тому ж браузері створили кабінет —
 * заявка переїжджає в кабінет, і на неї діє −5% за реєстрацію.
 *
 * Що заявку створили саме тут, знає лише підписане cookie: id заявки й підпис
 * секретом сервера. Підробити чи підставити чужу заявку без секрету не можна.
 */
export const CLAIM_COOKIE = "gf_claim";
/** Скільки після заявки ще можна прив'язати її до нового кабінету */
export const CLAIM_MS = 24 * 60 * 60_000;

function sign(leadId: string): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", `lead-claim:${secret}`).update(leadId).digest("base64url");
}

/** Значення cookie для щойно створеної анонімної заявки; без секрету — null */
export function claimToken(leadId: string): string | null {
  const sig = sign(leadId);
  return sig ? `${leadId}.${sig}` : null;
}

function readClaim(token: string | undefined): string | null {
  if (!token) return null;
  const [leadId, sig] = token.split(".");
  const expected = leadId ? sign(leadId) : null;
  if (!expected || !sig || sig.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? leadId : null;
}

/**
 * Прив'язати заявку з cookie до клієнта, який щойно увійшов. Перший ремонт —
 * одразу з −5%. Повторний виклик нічого не робить: заявка вже чиясь.
 */
export async function claimPendingLead(
  userId: string,
  email: string | null,
): Promise<{ orderNo: number; discount: DiscountKind | null } | null> {
  const leadId = readClaim((await cookies()).get(CLAIM_COOKIE)?.value);
  if (!leadId) return null;

  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead || lead.clerkUserId || Date.now() - lead.createdAt.getTime() > CLAIM_MS) return null;

  // Перший ремонт — якщо інших заявок, крім відхилених, у клієнта не було
  const others = (await getClientLeads(userId, email)).filter((l) => l.id !== leadId);
  const first = others.every((l) => l.status === "rejected");
  const discount: DiscountKind | null = lead.discount ?? (first && lead.status !== "rejected" ? "signup" : null);

  const done = await getDb()
    .update(leads)
    .set({ clerkUserId: userId, email: lead.email ?? email, discount })
    .where(and(eq(leads.id, leadId), isNull(leads.clerkUserId)))
    .returning({ id: leads.id });
  if (done.length === 0) return null;

  await addEvent(leadId, {
    text: discount === "signup" && !lead.discount
      ? "Клієнт створив кабінет — заявку прив'язано, застосовано знижку 5% за реєстрацію."
      : "Клієнт створив кабінет — заявку прив'язано.",
  });
  return { orderNo: lead.orderNo, discount };
}
