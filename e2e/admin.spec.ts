import { expect as baseExpect, test, type Page } from "@playwright/test";
import { base32Decode, counterAt, hotp } from "../src/lib/totp";

/**
 * Нова адмінка від входу до видачі — справжній браузер, справжня збірка.
 *
 * Ці тести ПИШУТЬ у базу: створюють заявки, приймають, видають. Тому лише
 * з E2E_ADMIN=1 і лише на тестовій гілці Neon `ci` (у CI це CI_DATABASE_URL;
 * локально — DATABASE_URL=<ci> E2E_ADMIN=1 npm run test:e2e). Без прапорця — пропуск.
 *
 * Усе, що створюємо, має мітку цього запуску й прибирається в кінці.
 */

/** Кожна дія — запит до сервера й бази (Neon, тестова гілка): даємо 15 с замість 5 */
const expect = baseExpect.configure({ timeout: 15_000 });

const enabled = process.env.E2E_ADMIN === "1";
const RUN = `E2E${Date.now().toString(36).toUpperCase()}`;
/** № квитанції магазину — свій для кожного запуску */
const SHOP_NO = String(Date.now()).slice(-7);
const OWNER = { email: process.env.ADMIN_EMAIL ?? "", password: process.env.ADMIN_PASSWORD ?? "", totp: process.env.ADMIN_TOTP_SECRET };
const MASTER = { email: process.env.ADMIN_EMAIL_2 ?? "", password: process.env.ADMIN_PASSWORD_2 ?? "", totp: process.env.ADMIN_TOTP_SECRET_2 };
const CAN_UPLOAD = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

test.describe.configure({ mode: "serial" });
test.skip(!enabled, "Адмінку перевіряємо лише з E2E_ADMIN=1 на тестовій базі");
// Сценарії довгі й пишуть у базу — один раз, на компʼютерному екрані
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "Лише на компʼютерному проєкті");
  test.setTimeout(120_000);
});

/** Пароль і, якщо налаштовано, одноразовий код з того самого секрету, що на сервері */
async function signIn(page: Page, who: typeof OWNER) {
  await page.goto("/admin/vhid");
  await page.fill("#a-email", who.email);
  await page.fill("#a-password", who.password);
  await page.click('button[type="submit"]');
  if (who.totp) {
    await page.waitForURL(/krok=kod/);
    await page.fill("#a-code", hotp(base32Decode(who.totp), counterAt(Date.now())));
    await page.click('button[type="submit"]');
  }
  await page.waitForURL((u) => u.pathname === "/admin");
}

/**
 * Одна сесія власника на весь сценарій: вхід — лише раз. Інакше кілька
 * запусків поспіль упираються в захист від підбору пароля (15 входів з IP за 15 хв).
 */
let page: Page;
test.beforeAll(async ({ browser }, info) => {
  if (!enabled || info.project.name !== "desktop") return;
  page = await (await browser.newContext()).newPage();
  await signIn(page, OWNER);
});
test.afterAll(async () => {
  await page?.context().close();
});

/** Головна кнопка внизу картки — та, що зі стрілкою */
const mainButton = (page: Page) => page.locator("form button[type=submit]", { hasText: "→" });

test("без входу адмінка не відкривається", async ({ page }) => {
  for (const path of ["/admin", "/admin/zayavky", "/admin/onlain", "/admin/groshi"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/vhid/);
  }
  const photo = await page.request.get("/admin/zayavky/00000000-0000-0000-0000-000000000000/foto/sign-intake");
  expect(photo.status()).toBe(403);
});

test("неправильний пароль — не пускає", async ({ page }) => {
  await page.goto("/admin/vhid");
  await page.fill("#a-email", OWNER.email);
  await page.fill("#a-password", "точно-не-той-пароль");
  await page.click('button[type="submit"]');
  // Після кількох запусків поспіль може спрацювати захист від підбору — теж «не пускає»
  await expect(page.getByText(/Пошта або пароль не підходять|Забагато спроб/)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/vhid/);
});

test("магазин «Онлайн»: прайс → швидкий прийом → Взяти → Готово → Віддати → розрахунок", async () => {

  // Позиція прайсу з міткою запуску — щоб не зачепити справжні
  await page.goto("/admin/onlain");
  const add = page.locator("#price-add");
  await add.getByLabel("Модель").fill(`${RUN} Phone`);
  await add.getByLabel("Робота").fill("АКБ");
  await add.getByLabel("Ціна магазину, ₴").fill("777");
  await add.getByLabel("Нам деталь коштує, ₴").fill("300");
  await add.getByRole("button", { name: "+ Додати" }).click();
  await expect(page.locator(`input[value="${RUN} Phone"]`)).toBeVisible();

  await page.goto("/admin/zayavky?point=online");
  await page.fill("#on-ext", SHOP_NO);
  await page.selectOption("#on-work", { label: `${RUN} Phone · АКБ — 777 ₴` });
  await page.getByRole("button", { name: /Додати · 777/ }).click();

  const card = page.locator("article", { hasText: `${RUN} Phone` });
  await expect(card).toBeVisible();
  await expect(card).toContainText(`М-${SHOP_NO}`);

  // Той самий № магазину вдруге — ні
  await page.fill("#on-ext", SHOP_NO);
  await page.getByRole("button", { name: /Додати · 777/ }).click();
  await expect(page.getByText(/уже прийнято/)).toBeVisible();

  for (const step of ["Взяти", "Готово", "Віддати"]) {
    await card.getByRole("button", { name: new RegExp(`^${step}`) }).click();
    if (step !== "Віддати") await expect(card.getByRole("button", { name: /^(Готово|Віддати)/ })).toBeVisible();
  }
  await expect(card).toHaveCount(0);

  // Віддане — у розрахунку цього місяця
  await page.goto("/admin/onlain?tab=money");
  const row = page.locator("tr", { hasText: `М-${SHOP_NO}` });
  await expect(row).toContainText("777");

  // Прибираємо за собою — заявку магазину теж
  await row.getByRole("link").first().click();
  await page.getByRole("button", { name: /Видалити дані/ }).click();
  await page.getByRole("button", { name: /Так|Видалити/ }).last().click();
  await page.waitForURL(/\/admin\/zayavky$/);
});

test("свій клієнт: прийом без фото не проходить; повний ремонт до видачі", async () => {

  await page.goto(`/admin/nova`);
  await page.fill("#nl-name", "Тест Клієнт");
  await page.fill("#nl-phone", "671234567");
  await page.fill("#nl-model", `${RUN} iPhone`);
  await page.getByRole("button", { name: "Створити заявку" }).click();
  await page.waitForURL(/\/admin\/zayavky\/[0-9a-f-]{36}$/);
  const leadUrl = page.url();

  // Обовʼязкове — сервер не пускає далі, кнопку не вимикаємо
  await mainButton(page).click();
  await expect(page.locator("span[role=alert]")).toHaveText(/фото.*підпис/);
  await expect(page.locator("#step-title")).toHaveText(/Прийом/);

  // Без сховища фото (у CI немає ключа Vercel Blob) далі не пройти — це вже перевірено вище
  test.skip(!CAN_UPLOAD, "Немає BLOB_READ_WRITE_TOKEN — фото й підпис не перевірити");

  await page.setInputFiles('label:has-text("Спереду") input[type=file]', {
    name: "front.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByText("Спереду ✓")).toBeVisible();
  await sign(page);
  await mainButton(page).click();
  await expect(page.locator("#step-title")).toHaveText(/^Діагностика/);

  await mainButton(page).click();
  await expect(page.locator("span[role=alert]")).toHaveText(/роботу/);
  await page.getByPlaceholder("Заміна роз'єму заряджання").fill("Заміна акумулятора");
  // «1e3» не пропускає вже сам браузер (поле лише для цифр) — форма навіть не йде на сервер
  const priceField = page.getByPlaceholder("Ціна клієнту, ₴");
  await priceField.fill("1e3");
  await page.getByRole("button", { name: "+ Додати" }).click();
  expect(await priceField.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  await expect(page.getByText("Ще нічого не додано.")).toBeVisible();
  await page.getByPlaceholder("Ціна клієнту, ₴").fill("1950");
  await page.getByRole("button", { name: "+ Додати" }).click();
  await expect(page.getByText("1 950 ₴").first()).toBeVisible();

  await mainButton(page).click();
  await expect(page.locator("#step-title")).toHaveText(/^Погодження ціни/);
  await mainButton(page).click();
  await expect(page.locator("#step-title")).toHaveText(/^Ремонт/);
  await mainButton(page).click();
  await expect(page.locator("#step-title")).toHaveText(/^Перевірка і видача/);

  await mainButton(page).click();
  await expect(page.locator("span[role=alert]")).toHaveText(/Перевірте все/);
  for (const c of ["Зарядка", "Екран", "Face ID / Touch ID", "Камери", "Звук", "Мережа"]) {
    await page.locator("main").getByRole("button", { name: c, exact: true }).last().click();
  }
  await page.getByRole("radio", { name: "Готівка" }).click();
  await sign(page);
  await mainButton(page).click();
  await expect(page.getByText(/Видано клієнту/)).toBeVisible();

  // Пошук Ctrl+K знаходить її за моделлю — і серед виданих теж
  await page.keyboard.press("Control+KeyK");
  await page.keyboard.type(RUN);
  await expect(page.getByRole("option", { name: new RegExp(`${RUN} iPhone`) })).toBeVisible();
  await page.keyboard.press("Escape");

  // Прибираємо за собою: заявку разом із фото й підписом
  await page.goto(leadUrl);
  await page.getByRole("button", { name: /Видалити дані/ }).click();
  await page.getByRole("button", { name: /Так|Видалити/ }).last().click();
  await page.waitForURL(/\/admin\/zayavky$/);
});

test("майстер (не власник): Каси й Статистики немає, видалити не може", async ({ page }) => {
  test.skip(!MASTER.email, "Другого акаунта в цьому середовищі немає");
  await signIn(page, MASTER);
  await expect(page.getByRole("link", { name: "Каса" })).toHaveCount(0);
  await page.goto("/admin/groshi");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/onlain?tab=money");
  await expect(page.getByRole("link", { name: "Розрахунок" })).toHaveCount(0);
});

test("прибирання: позиція прайсу запуску прибрана", async () => {
  await page.goto("/admin/onlain");
  const row = page.locator("div", { has: page.locator(`input[value="${RUN} Phone"]`) }).last();
  await row.getByRole("button", { name: "Прибрати" }).click();
  await expect(row.getByRole("button", { name: "Повернути" })).toBeVisible();
});

test("ширини екрана: 1280 і 1440 — меню збоку; 834 — меню за ☰, дошка гортається вбік", async () => {
  for (const [w, h] of [
    [1280, 800],
    [1440, 900],
    [834, 1112],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/admin/zayavky");
    const burger = page.getByRole("button", { name: "Меню", exact: true });
    if (w > 900) {
      await expect(burger).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Розділи адміністрування" })).toBeInViewport();
    } else {
      await expect(burger).toBeVisible();
    }
    // Сторінка не роз'їжджається вбік на жодній ширині
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `ширина ${w}`).toBeLessThanOrEqual(1);
  }
});

/**
 * Підпис пальцем — мишею по полотну, потім «Зберегти підпис».
 * Щойно завантажене фото ще може зсунути сторінку — тому міряємо полотно
 * перед кожною спробою й малюємо, доки кнопка «Зберегти» не стане активною.
 */
async function sign(page: Page) {
  const canvas = page.locator("canvas").first();
  const save = page.getByRole("button", { name: "Зберегти підпис" });
  await expect(async () => {
    await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(200);
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 0; i < 15; i++) await page.mouse.move(box.x + 20 + i * 12, box.y + box.height / 2 + Math.sin(i) * 25);
    await page.mouse.up();
    await expect(save).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await save.click();
  await expect(page.getByRole("button", { name: "Підписати заново" })).toBeVisible();
}
