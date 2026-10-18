import "server-only";

import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";

export type CabinetUser = { id: string; email: string | null; name: string };

/**
 * Хто відкрив кабінет. Ім'я й пошту беремо з токена сесії — він уже є в
 * запиті, тож без окремого запиту до Clerk. Для цього в Clerk (Configure →
 * Sessions → Customize session token) мають бути поля
 * {"email": "{{user.primary_email_address}}", "firstName": "{{user.first_name}}"}.
 * Поки їх немає — питаємо Clerk, як раніше.
 */
export const getCabinetUser = cache(async (): Promise<CabinetUser | null> => {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const claims = sessionClaims as { email?: unknown; firstName?: unknown } | null;
  if (typeof claims?.email === "string" && claims.email) {
    return {
      id: userId,
      email: claims.email,
      name: typeof claims.firstName === "string" ? claims.firstName.trim() : "",
    };
  }

  const user = await currentUser();
  return {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name: user?.firstName?.trim() ?? "",
  };
});
