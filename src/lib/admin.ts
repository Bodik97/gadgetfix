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

type Account = { email: string; password: string; name: string };

/**
 * Доступ мають лише перелічені майстри. Кожен зі своєю парою:
 * ADMIN_EMAIL / ADMIN_PASSWORD — перший, ADMIN_EMAIL_2 / ADMIN_PASSWORD_2 — другий.
 * Другий необовʼязковий: якщо змінних немає, працює один акаунт.
 *
 * ADMIN_NAME / ADMIN_NAME_2 потрібні лише для привітання в адмінці — права
 * в обох майстрів однакові.
 */
function accounts(): Account[] {
  const list = [
    { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME },
    { email: process.env.ADMIN_EMAIL_2, password: process.env.ADMIN_PASSWORD_2, name: process.env.ADMIN_NAME_2 },
  ];

  return list
    .filter((a): a is { email: string; password: string; name: string | undefined } =>
      Boolean(a.email && a.password),
    )
    .map((a) => ({
      email: a.email.trim().toLowerCase(),
      password: a.password,
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
export async function currentTeam(): Promise<{ me: string; names: Record<string, string> } | null> {
  const me = await currentAdmin();
  if (!me) return null;
  return {
    me: me.email,
    names: Object.fromEntries(adminDirectory().map((a) => [a.email, a.name])),
  };
}

/** Індекс майстра зі списку, якщо пара email+пароль зійшлася, інакше null */
export function checkCredentials(email: string, password: string): number | null {
  const list = accounts();
  if (list.length === 0) throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD не задано — адмінка вимкнена");

  const given = email.trim().toLowerCase();

  // Перебираємо всі акаунти до кінця — час відповіді не має видавати, який саме не зійшовся
  let matched: number | null = null;
  list.forEach((a, i) => {
    const ok = safeEqual(given, a.email) && safeEqual(password, a.password);
    if (ok) matched = i;
  });

  return matched;
}

export async function createSession(index: number): Promise<void> {
  const expires = Date.now() + MAX_AGE * 1000;
  // Індекс всередині підпису — щоб його не можна було підмінити на чужий
  const payload = `${expires}.${index}`;
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

  const [expires, index, signature] = raw.split(".");
  if (!expires || !index || !signature) return null;
  if (Number(expires) < Date.now()) return null;

  try {
    if (!safeEqual(signature, sign(`${expires}.${index}`))) return null;
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
 * Хто саме зайшов — потрібно лише для привітання.
 * Права на заявки, гроші й відгуки в обох майстрів однакові.
 */
export async function currentAdmin(): Promise<{ name: string; email: string } | null> {
  const i = await session();
  if (i === null) return null;

  const a = accounts()[i];
  return a ? { name: a.name, email: a.email } : null;
}
