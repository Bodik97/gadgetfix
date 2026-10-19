"use server";

import { currentUser } from "@clerk/nextjs/server";
import { discountOffer } from "@/db/discounts";
import { getClientLeads } from "@/db/leads";
import { getReviewsByUser } from "@/db/reviews";
import { verifiedEmail } from "@/lib/verifiedEmail";

/**
 * Чи чекає на клієнта, який зараз увійшов, знижка 5% за реєстрацію — вона діє
 * лише на перший ремонт. Блок на головній питає це після входу — так головна
 * лишається статичною. Без входу — null.
 */
export async function signupDiscountWaiting(): Promise<boolean | null> {
  const user = await currentUser();
  if (!user) return null;
  const [repairs, written] = await Promise.all([
    getClientLeads(user.id, verifiedEmail(user)),
    getReviewsByUser(user.id),
  ]);
  return discountOffer(repairs, written)?.kind === "signup";
}
