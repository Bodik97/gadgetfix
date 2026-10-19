import "server-only";

import { cache } from "react";
import { currentUser, type User } from "@clerk/nextjs/server";
import { BIRTHDAY_RE } from "@/data/discounts";
import { normalizeUaPhone } from "@/lib/phone";

/**
 * Дані профілю, яких немає в самому Clerk: дата народження й телефон без SMS.
 * Лежать у publicMetadata — їх змінює лише сервер, тож клієнт не перепише
 * собі день народження заради знижки.
 */
export type ProfileExtras = { birthday: string | null; phone: string | null };

export function extrasOf(user: User | null): ProfileExtras {
  const meta = (user?.publicMetadata ?? {}) as { birthday?: unknown; phone?: unknown };
  const birthday = typeof meta.birthday === "string" && BIRTHDAY_RE.test(meta.birthday) ? meta.birthday : null;
  const phone = typeof meta.phone === "string" ? normalizeUaPhone(meta.phone) : null;
  return { birthday, phone };
}

/** Для сторінок кабінету — один запит до Clerk на рендер */
export const getProfileExtras = cache(async (): Promise<ProfileExtras> => extrasOf(await currentUser()));
