import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./index";
import { reviews, type Lead, type Review } from "./schema";

/** Відгуки для головної — лише схвалені майстром */
export async function getPublishedReviews(limit = 6): Promise<Review[]> {
  return getDb()
    .select()
    .from(reviews)
    .where(eq(reviews.published, true))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

/** Усі відгуки для адмінки — нові зверху */
export async function getAllReviews(): Promise<Review[]> {
  return getDb().select().from(reviews).orderBy(desc(reviews.createdAt));
}

/** Відгуки клієнта, нові зверху: по одному на кожен виданий ремонт */
export async function getReviewsByUser(clerkUserId: string): Promise<Review[]> {
  return getDb()
    .select()
    .from(reviews)
    .where(eq(reviews.clerkUserId, clerkUserId))
    .orderBy(desc(reviews.createdAt));
}

/**
 * Про що клієнт може написати відгук зараз: виданий ремонт без відгуку
 * (бажано той, про який питають), інакше — один загальний відгук без знижки.
 * undefined — писати вже нема про що.
 */
export function reviewTarget(
  repairs: Lead[],
  written: Review[],
  leadId?: string | null,
): { leadId: string | null } | undefined {
  const reviewed = new Set(written.map((r) => r.leadId));
  // Відмова закриває відгук, навіть якщо клієнт раніше натиснув «Я отримав гаджет»
  const open = repairs.filter(
    (l) => l.status !== "rejected" && (l.status === "done" || l.receivedAt) && !reviewed.has(l.id),
  );
  const lead = open.find((l) => l.id === leadId) ?? open[0];
  if (lead) return { leadId: lead.id };
  return written.length === 0 ? { leadId: null } : undefined;
}

/**
 * Нараховані знижки за відгуки — для карток заявок.
 * Їх одиниці, тож беремо всі одразу, а не по клієнту.
 */
export async function getReviewDiscounts(): Promise<Review[]> {
  return getDb().select().from(reviews).where(isNotNull(reviews.discountAt));
}

/** Середня оцінка й кількість опублікованих відгуків — для підсумку над стрічкою */
export async function getReviewStats(): Promise<{ count: number; average: number }> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int`, average: sql<number>`coalesce(avg(${reviews.rating}), 0)::float` })
    .from(reviews)
    .where(eq(reviews.published, true));
  return { count: row?.count ?? 0, average: row?.average ?? 0 };
}
