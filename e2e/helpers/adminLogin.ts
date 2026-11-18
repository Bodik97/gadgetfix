import { setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

export type AdminAccount = { email: string };

export const OWNER: AdminAccount = { email: process.env.ADMIN_EMAIL ?? "" };
export const MASTER: AdminAccount = { email: process.env.ADMIN_EMAIL_2 ?? "" };

/**
 * Код для пошт з «+clerk_test» на тестовому (dev) інстансі Clerk — лист не
 * надсилається, а код завжди цей. На справжній пошті автотест увійти не може.
 */
export const TEST_CODE = "424242";

/** Чи можна увійти цим акаунтом в автотесті */
export const canSignIn = (who: AdminAccount) => who.email.includes("+clerk_test");

/** Пошта → «Надіслати код» → код → адмінка */
export async function signInAdmin(page: Page, who: AdminAccount, code = TEST_CODE) {
  await setupClerkTestingToken({ page });
  await page.goto("/admin/vhid");
  await page.fill("#a-email", who.email);
  await page.click('button[type="submit"]');
  await page.fill("#a-code", code);
  await page.click('button[type="submit"]');
  if (code === TEST_CODE) await page.waitForURL((u) => u.pathname === "/admin");
}
