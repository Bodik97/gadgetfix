import "server-only";

import type { User } from "@clerk/nextjs/server";

/**
 * Пошта акаунта — лише якщо її підтверджено кодом. За поштою підтягуються заявки
 * й чат, лишені до реєстрації; непідтверджена адреса могла б бути чужою.
 */
export function verifiedEmail(user: User | null | undefined): string | null {
  const email = user?.primaryEmailAddress;
  return email?.verification?.status === "verified" ? email.emailAddress : null;
}
