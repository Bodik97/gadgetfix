import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "./index";
import { leads, reviews, type Lead, type Review } from "./schema";
import { addEvent } from "./events";
import { DISCOUNT_PERCENT, DISCOUNT_REASON, type DiscountKind } from "@/data/discounts";

/**
 * Яка знижка чекає клієнта на нове замовлення. 10% за відгук застосовується
 * сама; 5% за реєстрацію — коли клієнт натисне «Скористатись». null — немає.
 */
export type DiscountOffer = { kind: "review"; reviewId: string } | { kind: "signup" } | null;

export function discountOffer(repairs: Lead[], written: Review[]): DiscountOffer {
  const review = written.find((r) => r.discountAt && !r.discountLeadId);
  if (review) return { kind: "review", reviewId: review.id };
  // Перший ремонт — поки не було жодної заявки, крім відхилених
  if (repairs.every((l) => l.status === "rejected")) return { kind: "signup" };
  return null;
}

/**
 * Закріпити знижку за щойно створеною заявкою. Відгук займаємо умовним
 * оновленням — дві заявки поспіль не отримають ту саму знижку.
 */
export async function claimDiscount(
  leadId: string,
  offer: DiscountOffer,
  wantSignup: boolean,
): Promise<DiscountKind | null> {
  let kind: DiscountKind | null = null;

  if (offer?.kind === "review") {
    const taken = await getDb()
      .update(reviews)
      .set({ discountLeadId: leadId })
      .where(and(eq(reviews.id, offer.reviewId), isNull(reviews.discountLeadId)))
      .returning({ id: reviews.id });
    if (taken.length > 0) kind = "review";
  } else if (offer?.kind === "signup" && wantSignup) {
    kind = "signup";
  }

  if (!kind) return null;
  await getDb().update(leads).set({ discount: kind }).where(eq(leads.id, leadId));
  await addEvent(leadId, { text: `Застосовано знижку ${DISCOUNT_PERCENT[kind]}% ${DISCOUNT_REASON[kind]}.` });
  return kind;
}

/** Заявку відхилили — знижка повертається клієнту й діятиме на наступне замовлення */
export async function releaseDiscount(lead: Lead): Promise<void> {
  if (!lead.discount) return;
  await getDb().update(leads).set({ discount: null }).where(eq(leads.id, lead.id));
  if (lead.discount === "review") {
    await getDb().update(reviews).set({ discountLeadId: null }).where(eq(reviews.discountLeadId, lead.id));
  }
  await addEvent(lead.id, { text: "Знижку повернули клієнту — вона діятиме на наступне замовлення." });
}
