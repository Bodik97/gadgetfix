import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Перевірка пари пошта+пароль — те, за чим лежать телефони всіх клієнтів,
 * листування й гроші. Тут не має бути ні поблажок до регістру пошти, ні
 * проходу з порожнім паролем, ні плутанини, хто саме зайшов.
 */

// Модуль читає cookies при завантаженні — у тестах вони не потрібні
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, set: () => {} }) }));

const ENV = {
  ADMIN_EMAIL: "perayj@example.com",
  ADMIN_PASSWORD: "parol-pershoho",
  ADMIN_NAME: "Перший",
  ADMIN_EMAIL_2: "druhyj@example.com",
  ADMIN_PASSWORD_2: "parol-druhoho",
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
  it("пускає першого й другого, і розрізняє їх", async () => {
    const { checkCredentials } = await admin();
    expect(checkCredentials(ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD)).toBe(0);
    expect(checkCredentials(ENV.ADMIN_EMAIL_2, ENV.ADMIN_PASSWORD_2)).toBe(1);
  });

  it("не пускає з чужим паролем", async () => {
    const { checkCredentials } = await admin();
    expect(checkCredentials(ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD_2)).toBeNull();
    expect(checkCredentials(ENV.ADMIN_EMAIL_2, ENV.ADMIN_PASSWORD)).toBeNull();
  });

  it("не пускає з порожнім паролем або невідомою поштою", async () => {
    const { checkCredentials } = await admin();
    expect(checkCredentials(ENV.ADMIN_EMAIL, "")).toBeNull();
    expect(checkCredentials("", "")).toBeNull();
    expect(checkCredentials("chuzhyj@example.com", ENV.ADMIN_PASSWORD)).toBeNull();
  });

  it("пошта нечутлива до регістру й пробілів, пароль — чутливий", async () => {
    const { checkCredentials } = await admin();
    expect(checkCredentials("  PeRaYj@Example.COM  ", ENV.ADMIN_PASSWORD)).toBe(0);
    expect(checkCredentials(ENV.ADMIN_EMAIL, "PAROL-PERSHOHO")).toBeNull();
    expect(checkCredentials(ENV.ADMIN_EMAIL, " parol-pershoho ")).toBeNull();
  });

  it("без другої пари працює лише один акаунт", async () => {
    vi.stubEnv("ADMIN_EMAIL_2", "");
    vi.stubEnv("ADMIN_PASSWORD_2", "");
    vi.resetModules();

    const { checkCredentials } = await admin();
    expect(checkCredentials(ENV.ADMIN_EMAIL, ENV.ADMIN_PASSWORD)).toBe(0);
    expect(checkCredentials(ENV.ADMIN_EMAIL_2, ENV.ADMIN_PASSWORD_2)).toBeNull();
  });

  it("без налаштувань адмінка не пускає нікого", async () => {
    for (const k of Object.keys(ENV)) vi.stubEnv(k, "");
    vi.resetModules();

    const { checkCredentials } = await admin();
    expect(() => checkCredentials("будь-хто@example.com", "будь-що")).toThrow();
  });

  it("неповна пара ігнорується: сама пошта без пароля не дає доступу", async () => {
    vi.stubEnv("ADMIN_PASSWORD_2", "");
    vi.resetModules();

    const { checkCredentials } = await admin();
    expect(checkCredentials(ENV.ADMIN_EMAIL_2, "")).toBeNull();
    expect(checkCredentials(ENV.ADMIN_EMAIL_2, ENV.ADMIN_PASSWORD_2)).toBeNull();
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
