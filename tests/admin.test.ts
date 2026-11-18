import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Хто з підтверджених пошт — майстер: за цим лежать телефони всіх клієнтів,
 * листування й гроші. Тут не має бути ні чужих пошт, ні порожніх, ні
 * плутанини, хто саме зайшов.
 */

// Модуль читає cookies при завантаженні — у тестах вони не потрібні
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, set: () => {} }) }));

const ENV = {
  ADMIN_EMAIL: "perayj@example.com",
  ADMIN_NAME: "Перший",
  ADMIN_EMAIL_2: "druhyj@example.com",
  ADMIN_NAME_2: "Другий",
  ADMIN_SESSION_SECRET: "sekret-dlia-testu",
};

beforeEach(() => {
  vi.resetModules();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
});

async function admin() {
  return import("@/lib/admin");
}

describe("вхід майстра", () => {
  it("кожна пошта — свій майстер, перший — власник", async () => {
    const { adminIndexByEmails } = await admin();
    expect(adminIndexByEmails([ENV.ADMIN_EMAIL])).toBe(0);
    expect(adminIndexByEmails([ENV.ADMIN_EMAIL_2])).toBe(1);
  });

  it("чужа чи порожня пошта — не пускає", async () => {
    const { adminIndexByEmails, isAdminEmail } = await admin();
    expect(adminIndexByEmails(["chuzhyj@example.com"])).toBeNull();
    expect(adminIndexByEmails([""])).toBeNull();
    expect(adminIndexByEmails([])).toBeNull();
    expect(isAdminEmail("chuzhyj@example.com")).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("регістр і пробіли в пошті не заважають", async () => {
    const { adminIndexByEmails, isAdminEmail } = await admin();
    expect(adminIndexByEmails(["  PeRaYj@Example.COM  "])).toBe(0);
    expect(isAdminEmail(" DRUHYJ@example.com")).toBe(true);
  });

  it("серед кількох пошт користувача знаходить майстрову", async () => {
    const { adminIndexByEmails } = await admin();
    expect(adminIndexByEmails(["inshyj@example.com", ENV.ADMIN_EMAIL_2])).toBe(1);
  });

  it("без другої пошти працює лише один акаунт", async () => {
    vi.stubEnv("ADMIN_EMAIL_2", "");
    vi.resetModules();

    const { adminIndexByEmails } = await admin();
    expect(adminIndexByEmails([ENV.ADMIN_EMAIL])).toBe(0);
    expect(adminIndexByEmails([ENV.ADMIN_EMAIL_2])).toBeNull();
  });

  it("без налаштувань адмінка не пускає нікого", async () => {
    for (const k of Object.keys(ENV)) vi.stubEnv(k, "");
    vi.resetModules();

    const { adminIndexByEmails, isAdminEmail } = await admin();
    expect(adminIndexByEmails(["будь-хто@example.com", ""])).toBeNull();
    expect(isAdminEmail("")).toBe(false);
  });
});

describe("номер майстра для клієнта", () => {
  it("клієнт дзвонить тому, хто взяв заявку: перший — 073, другий — 063", async () => {
    const { masterPhone } = await admin();
    expect(masterPhone(ENV.ADMIN_EMAIL)?.href).toBe("tel:+380733150238");
    expect(masterPhone(ENV.ADMIN_EMAIL_2)?.href).toBe("tel:+380631164377");
  });

  it("заявку ще ніхто не взяв або майстра вже немає в адмінці — номера немає", async () => {
    const { masterPhone } = await admin();
    expect(masterPhone(null)).toBeNull();
    expect(masterPhone("kolyshnij@example.com")).toBeNull();
  });
});
