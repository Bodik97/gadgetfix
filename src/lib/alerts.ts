import { esc, notifyDev } from "./telegram";

/**
 * Сповіщення про збої сервера — в окремий Telegram-чат розробника.
 *
 * Без цього падіння сторінки чи API лишалось би рядком у логах Vercel, який
 * ніхто не читає, а клієнт просто йшов би до іншого сервісу.
 */

export type ErrorRequest = { path: string; method: string };
export type ErrorContext = { routePath?: string; routeType?: string };

/** Однакова помилка — не частіше раз на 10 хвилин, щоб збій не засипав чат */
const QUIET_MS = 10 * 60_000;
const lastSent = new Map<string, number>();

/** redirect() і notFound() Next передає як помилки, але це звичайна робота */
function isControlFlow(digest: string | undefined): boolean {
  return Boolean(digest && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)/.test(digest));
}

export async function reportError(
  err: unknown,
  request: ErrorRequest,
  context: ErrorContext,
  now = Date.now(),
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;

  if (isControlFlow(digest)) return;

  // Шлях без параметрів: у них буває телефон чи пошта з пошуку в адмінці
  const path = request.path.split("?")[0];
  const where = context.routePath ?? path;

  // У тексті помилки буває те, що прислав відвідувач (кривий id, число поза
  // межами) — Postgres наводить таке в лапках. З ним кожен запит був би
  // «новою» помилкою, тож для порівняння все в лапках прибираємо
  const key = `${where}|${message.replace(/"[^"]*"|'[^']*'/g, "")}`;
  const prev = lastSent.get(key);
  if (prev !== undefined && now - prev < QUIET_MS) return;
  lastSent.set(key, now);

  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "";

  await notifyDev(
    [
      `<b>Помилка на сайті</b>${env && env !== "production" ? ` (${esc(env)})` : ""}`,
      `${esc(request.method)} ${esc(path)}`,
      `Маршрут: ${esc(where)} · ${esc(context.routeType ?? "?")}`,
      "",
      `<code>${esc(message.slice(0, 400))}</code>`,
      digest ? `digest: ${esc(digest)}` : "",
    ]
      .filter((line, i, all) => line !== "" || all[i + 1] !== "")
      .join("\n")
      .trim(),
  );
}

/** Для тестів: забути, що вже надсилали */
export function resetAlerts(): void {
  lastSent.clear();
}
