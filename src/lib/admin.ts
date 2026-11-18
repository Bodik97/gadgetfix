import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { site } from "@/data/site";

const COOKIE = "gadgetfix_admin";
const MAX_AGE = 60 * 60 * 12; // 12 годин

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} не задано — адмінка вимкнена`);
  return value;
}

/** Порівняння, стійке до timing-атак (однакова довжина обовʼязкова) */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sign(payload: string): string {
  return createHmac("sha256", requireEnv("ADMIN_SESSION_SECRET")).update(payload).digest("hex");
}

type Account = { email: string; name: string };

/**
 * Доступ мають лише перелічені пошти: ADMIN_EMAIL — перший, ADMIN_EMAIL_2 — другий.
 * Входять кодом, який Clerk надсилає на цю пошту (див. enterAdmin в actions.ts).
 * Другий необовʼязковий: якщо змінної немає, працює один акаунт.
 *
 * ADMIN_NAME / ADMIN_NAME_2 — імена для адмінки. Перший акаунт — власник
 * (див. AdminRole), решта — майстри.
 */
function accounts(): Account[] {
  const list = [
    { email: process.env.ADMIN_EMAIL?.trim(), name: process.env.ADMIN_NAME },
    { email: process.env.ADMIN_EMAIL_2?.trim(), name: process.env.ADMIN_NAME_2 },
  ];

  return list
    .filter((a): a is typeof a & { email: string } => Boolean(a.email))
    .map((a) => ({
      email: a.email.toLowerCase(),
      // Без ADMIN_NAME беремо частину пошти до «@» — краще за порожнє місце
      name: a.name?.trim() || a.email.split("@")[0],
    }));
}

/** Телефон кожного майстра — у порядку ADMIN_EMAIL, ADMIN_EMAIL_2 */
const PHONES = [site.phones[1], site.phones[0]];

/** Номер майстра, що взяв заявку, — щоб клієнт дзвонив саме йому. null — ще ніхто не взяв. */
export function masterPhone(assignee: string | null): (typeof site.phones)[number] | null {
  if (!assignee) return null;
  const i = [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL_2].findIndex(
    (e) => e?.trim().toLowerCase() === assignee,
  );
  return PHONES[i] ?? null;
}

/** Хто є в адмінці — пошта й імʼя без паролів: щоб показати, хто яку заявку взяв */
export function adminDirectory(): { email: string; name: string }[] {
  return accounts().map(({ email, name }) => ({ email, name }));
}

/** Хто зайшов і як звати кожного майстра за поштою — для позначок «бере: …» */
export async function currentTeam(): Promise<{
  me: string;
  owner: boolean;
  names: Record<string, string>;
} | null> {
  const me = await currentAdmin();
  if (!me) return null;
  return {
    me: me.email,
    owner: me.role === "owner",
    names: Object.fromEntries(adminDirectory().map((a) => [a.email, a.name])),
  };
}

/** Чи є така пошта серед майстрів — щоб завести її в Clerk перед першим входом */
export function isAdminEmail(email: string): boolean {
  const given = email.trim().toLowerCase();
  return accounts().some((a) => a.email === given);
}

/**
 * Індекс майстра за підтвердженими поштами користувача Clerk, інакше null.
 * Порядок accounts() важливий: перший — власник.
 */
export function adminIndexByEmails(emails: string[]): number | null {
  const given = new Set(emails.map((e) => e.trim().toLowerCase()));
  const i = accounts().findIndex((a) => given.has(a.email));
  return i === -1 ? null : i;
}

/**
 * Відбиток акаунта в сесії: пошта майстра під нашим підписом. Змінили пошту чи
 * прибрали акаунт — старі сесії одразу недійсні.
 */
function fingerprint(a: Account): string {
  return sign(`account:${a.email}`).slice(0, 24);
}

export async function createSession(index: number): Promise<void> {
  const expires = Date.now() + MAX_AGE * 1000;
  // Індекс і відбиток всередині підпису — щоб їх не можна було підмінити на чужі
  const account = accounts()[index];
  if (!account) throw new Error("Немає такого акаунта майстра");
  const payload = `${expires}.${index}.${fingerprint(account)}`;
  const value = `${payload}.${sign(payload)}`;

  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Індекс майстра з cookie, якщо підпис наш і строк не вийшов */
async function session(): Promise<number | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const [expires, index, print, signature] = raw.split(".");
  if (!expires || !index || !print || !signature) return null;
  if (Number(expires) < Date.now()) return null;

  try {
    if (!safeEqual(signature, sign(`${expires}.${index}.${print}`))) return null;
    // Акаунт досі є й пошта та сама, з якою входили
    const account = accounts()[Number(index)];
    if (!account || !safeEqual(print, fingerprint(account))) return null;
  } catch {
    // Секрет не заданий — вважаємо, що доступу немає
    return null;
  }

  return Number(index);
}

/** true, якщо cookie підписана нашим секретом і ще не протухла */
export async function isAdmin(): Promise<boolean> {
  return (await session()) !== null;
}

/**
 * owner — власник (перший акаунт, ADMIN_EMAIL): видаляє заявки, бачить Касу
 * й Статистику. master — решта майстрів: веде заявки, але не видаляє.
 */
export type AdminRole = "owner" | "master";

/** Хто саме зайшов і з якими правами */
export async function currentAdmin(): Promise<{ name: string; email: string; role: AdminRole } | null> {
  const i = await session();
  if (i === null) return null;

  const a = accounts()[i];
  return a ? { name: a.name, email: a.email, role: i === 0 ? "owner" : "master" } : null;
}

/** true лише для власника — для видалення та грошових звітів */
export async function isOwner(): Promise<boolean> {
  return (await session()) === 0;
}
