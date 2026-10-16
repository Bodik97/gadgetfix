import { desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "./index";
import { reviews, type Review } from "./schema";

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

/** Чи лишав цей клієнт відгук — щоб не давати писати другий */
export async function getReviewByUser(clerkUserId: string): Promise<Review | undefined> {
  const rows = await getDb()
    .select()
    .from(reviews)
    .where(eq(reviews.clerkUserId, clerkUserId))
    .limit(1);

  return rows[0];
}

/**
 * Нараховані знижки за відгуки — для карток заявок.
 * Їх одиниці, тож беремо всі одразу, а не по клієнту.
 */
export async function getReviewDiscounts(): Promise<Review[]> {
  return getDb().select().from(reviews).where(isNotNull(reviews.discountAt));
}
