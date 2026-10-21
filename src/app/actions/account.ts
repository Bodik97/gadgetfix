"use server";

import { currentUser } from "@clerk/nextjs/server";
import { discountOffer } from "@/db/discounts";
import { getClientLeads } from "@/db/leads";
import { getReviewsByUser } from "@/db/reviews";
import { verifiedEmail } from "@/lib/verifiedEmail";
import { extrasOf } from "@/lib/profile";

/** Де клієнт на шляху до −10%: зареєструвався → відремонтувався → лишив відгук */
export type Journey = {
  /** Знижка 5% за реєстрацію ще чекає на перший ремонт */
  signupWaiting: boolean;
  repaired: boolean;
  reviewed: boolean;
};

/**
 * Шлях знижок клієнта, який зараз увійшов. Блок на головній питає це вже в
 * браузері — так головна лишається статичною. Без входу — null.
 */
export async function myJourney(): Promise<Journey | null> {
  const user = await currentUser();
  if (!user) return null;
  const [repairs, written] = await Promise.all([
    getClientLeads(user.id, verifiedEmail(user)),
    getReviewsByUser(user.id),
  ]);
  return {
    signupWaiting: discountOffer(repairs, written, extrasOf(user).birthday)?.kind === "signup",
    repaired: repairs.some((l) => l.status === "done" || l.receivedAt),
    reviewed: written.length > 0,
  };
}
