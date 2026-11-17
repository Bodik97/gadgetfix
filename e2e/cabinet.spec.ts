import { expect, test } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { E2E_EMAIL } from "./global-setup";
import { lowContrastTexts } from "./helpers/contrast";

/**
 * Кабінет клієнта: справжній вхід через нашу форму на /vhid, порожній кабінет,
 * вихід. Тестовий клієнт без заявок — у базу нічого не пишеться.
 */

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.E2E_CLIENT_PASSWORD, "немає тестового ключа Clerk");
  // Clerk вантажить скрипти, воркери й капчу ззовні — CSP не має блокувати нічого
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
});

test.afterEach(async ({ page }) => {
  const violations = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
  expect(violations, "порушення CSP").toEqual([]);
});

test("вхід → порожній кабінет → вихід", async ({ page }) => {
  await setupClerkTestingToken({ page });

  await page.goto("/vhid");
  const form = page.locator("main");
  await form.getByLabel("Пошта").fill(E2E_EMAIL);
  await form.getByLabel("Пароль", { exact: true }).fill(process.env.E2E_CLIENT_PASSWORD!);
  await form.getByRole("button", { name: "Увійти", exact: true }).click();

  // Новий пристрій Clerk може підтверджувати кодом — для +clerk_test він фіксований
  const code = form.getByLabel("Код із листа");
  // Заголовок кабінету: «Привіт, …» або просто «Кабінет» (не «Кабінет клієнта» зі сторінки входу)
  const home = page.getByRole("heading", { level: 1, name: /^(Привіт|Кабінет$)/ });
  await expect(code.or(home)).toBeVisible({ timeout: 20_000 });
  if (await code.isVisible()) {
    await code.fill("424242");
    await form.getByRole("button", { name: "Увійти", exact: true }).click();
  }

  // Після входу — головна кабінету, звідти «Мої ремонти»
  await expect(page).toHaveURL(/\/kabinet/, { timeout: 20_000 });
  await expect(home).toBeVisible();
  await page.goto("/moi-remonty");
  await expect(page.getByRole("heading", { name: "Мої ремонти" })).toBeVisible();

  // Кабінет у світлій темі: жоден текст не губиться на тлі
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  // У посилань і кнопок плавна зміна кольору — даємо їй завершитись
  await page.waitForTimeout(500);
  expect(await page.evaluate(lowContrastTexts)).toEqual([]);
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));

  // Залогіненого /vhid одразу веде в кабінет
  await page.goto("/vhid");
  await expect(page).toHaveURL(/\/kabinet/);

  await page.getByRole("button", { name: /вийти/i }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/moi-remonty");
  await expect(page).toHaveURL(/\/vhid/);
});

test("неправильний пароль — зрозуміла помилка, кабінет не відкривається", async ({ page }) => {
  await setupClerkTestingToken({ page });

  await page.goto("/vhid");
  const form = page.locator("main");
  await form.getByLabel("Пошта").fill(E2E_EMAIL);
  await form.getByLabel("Пароль", { exact: true }).fill("zovsim-ne-toi-parol");
  await form.getByRole("button", { name: "Увійти", exact: true }).click();

  await expect(form.getByText("Пароль не підходить")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/vhid/);
});
