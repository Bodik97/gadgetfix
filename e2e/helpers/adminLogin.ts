import type { Page } from "@playwright/test";
import { base32Decode, counterAt, hotp } from "../../src/lib/totp";

export type AdminAccount = { email: string; password: string; totp?: string };

export const OWNER: AdminAccount = {
  email: process.env.ADMIN_EMAIL ?? "",
  password: process.env.ADMIN_PASSWORD ?? "",
  totp: process.env.ADMIN_TOTP_SECRET,
};

export const MASTER: AdminAccount = {
  email: process.env.ADMIN_EMAIL_2 ?? "",
  password: process.env.ADMIN_PASSWORD_2 ?? "",
  totp: process.env.ADMIN_TOTP_SECRET_2,
};

const STEP_MS = 30_000;

/**
 * Вхід в адмінку: пароль і, якщо налаштовано, одноразовий код з того самого
 * секрету, що на сервері. Той самий код сервер удруге не приймає — а тести
 * на різних екранах входять одночасно. Тож якщо код не прийняли, чекаємо
 * наступного 30-секундного коду й пробуємо ще раз.
 */
export async function signInAdmin(page: Page, who: AdminAccount) {
  await page.goto("/admin/vhid");
  await page.fill("#a-email", who.email);
  await page.fill("#a-password", who.password);
  await page.click('button[type="submit"]');

  if (who.totp) {
    await page.waitForURL(/krok=kod/);
    const key = base32Decode(who.totp);
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.fill("#a-code", hotp(key, counterAt(Date.now())));
      await page.click('button[type="submit"]');
      const ok = await page
        .waitForURL((u) => u.pathname === "/admin", { timeout: 5_000 })
        .then(() => true, () => false);
      if (ok) return;
      await page.waitForTimeout(STEP_MS - (Date.now() % STEP_MS) + 1_000);
    }
  }
  await page.waitForURL((u) => u.pathname === "/admin");
}
