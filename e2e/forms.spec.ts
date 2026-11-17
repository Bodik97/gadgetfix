import { expect, test, type Page } from "@playwright/test";

/**
 * Форми запису й перевірки статусу. Запити до API перехоплюються в браузері —
 * у справжню базу жодна тестова заявка не потрапляє.
 */

/**
 * Відкрити й дочекатись, поки React оживить сторінку. Інакше Playwright
 * встигає ввести текст до гідратації, і React затирає його своїм порожнім станом.
 */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}

type Captured = { body: Record<string, unknown> | null };

async function mockLead(page: Page, status = 200): Promise<Captured> {
  const captured: Captured = { body: null };
  await page.route("**/api/lead", async (route) => {
    captured.body = route.request().postDataJSON();
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(status === 200 ? { ok: true } : { error: "x" }),
    });
  });
  return captured;
}

test.describe("форма запису на головній", () => {
  test("без імені й телефону — підказка, запит не йде", async ({ page }) => {
    const lead = await mockLead(page);
    await open(page, "/");
    const book = page.locator("#book");
    await book.getByRole("button", { name: /записатись/i }).click();
    // Помилка — під кожним полем, словами, що саме вписати
    await expect(book.getByText("Впишіть імʼя — як до вас звертатись.")).toBeVisible();
    await expect(book.getByText(/Впишіть номер телефону/)).toBeVisible();
    expect(lead.body).toBeNull();
  });

  test("заповнена — надсилає заявку й показує «Заявку прийнято»", async ({ page }) => {
    const lead = await mockLead(page);
    await open(page, "/");
    const book = page.locator("#book");

    await book.getByLabel("Ім'я").fill("Тест");
    await book.getByLabel("Телефон").fill("073 315 02 38");
    await book.getByLabel("Модель").selectOption({ index: 1 });
    await book.getByLabel("Що трапилось").fill("Розбитий екран");
    await book.getByRole("button", { name: /записатись/i }).click();

    await expect(book.getByText("Заявку прийнято")).toBeVisible();
    expect(lead.body).toMatchObject({
      name: "Тест",
      // Хай як набрали — у заявку йде один вигляд
      phone: "+380733150238",
      problem: "Розбитий екран",
      source: "landing",
    });
    expect(lead.body?.model).toBeTruthy();

    await book.getByRole("button", { name: "Надіслати ще одну" }).click();
    await expect(book.getByLabel("Ім'я")).toHaveValue("");
  });

  test("сервер відмовив — показує телефон для дзвінка, введене не губиться", async ({ page }) => {
    await mockLead(page, 500);
    await open(page, "/");
    const book = page.locator("#book");

    await book.getByLabel("Ім'я").fill("Тест");
    await book.getByLabel("Телефон").fill("0733150238");
    await book.getByRole("button", { name: /записатись/i }).click();

    await expect(book.getByText(/Не вдалося надіслати/)).toBeVisible();
    await expect(book.getByLabel("Ім'я")).toHaveValue("Тест");
  });
});

test("форма на сторінці моделі передає модель і джерело", async ({ page }) => {
  const lead = await mockLead(page);
  await open(page, "/modeli/iphone-16-pro-max");
  const book = page.locator("#book");

  await book.getByLabel("Ім'я").fill("Тест");
  await book.getByLabel("Телефон").fill("0733150238");
  await book.getByRole("button", { name: /записатись/i }).click();

  await expect(book.getByText("Заявку прийнято")).toBeVisible();
  expect(lead.body).toMatchObject({ source: "model", model: expect.stringMatching(/iPhone 16 Pro Max/i) });
});

test.describe("перевірка статусу замовлення", () => {
  test("без даних — підказка, запит не йде", async ({ page }) => {
    let called = false;
    await page.route("**/api/orders/**", (r) => {
      called = true;
      return r.abort();
    });
    await open(page, "/");
    await page.getByRole("button", { name: "Перевірити" }).click();
    await expect(page.getByText("Впишіть номер замовлення з квитанції.")).toBeVisible();
    expect(called).toBe(false);
  });

  test("знайдено — показує пристрій і етапи", async ({ page }) => {
    await page.route("**/api/orders/**", (r) =>
      r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          no: "1042",
          device: "iPhone 13",
          work: "Заміна екрана",
          stage: 1,
          stages: ["Прийнято", "Ремонт", "Готово"],
          eta: "Сьогодні",
          log: [],
        }),
      }),
    );
    await open(page, "/");
    await page.getByLabel("Номер замовлення").fill("1042");
    await page.getByLabel("Останні 4 цифри телефону").fill("0238");
    await page.getByRole("button", { name: "Перевірити" }).click();
    await expect(page.getByText("Замовлення №1042 · iPhone 13")).toBeVisible();
  });

  test("не знайдено — показує текст помилки з сервера", async ({ page }) => {
    await page.route("**/api/orders/**", (r) =>
      r.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Не знайшли замовлення з таким номером і телефоном." }),
      }),
    );
    await open(page, "/");
    await page.getByLabel("Номер замовлення").fill("1");
    await page.getByLabel("Останні 4 цифри телефону").fill("0000");
    await page.getByRole("button", { name: "Перевірити" }).click();
    await expect(page.getByText("Не знайшли замовлення з таким номером і телефоном.")).toBeVisible();
  });

  test("у поле телефону не можна ввести більше 4 цифр і літери", async ({ page }) => {
    await open(page, "/");
    const tail = page.getByLabel("Останні 4 цифри телефону");
    await tail.pressSequentially("ab12345");
    await expect(tail).toHaveValue("1234");
  });
});

test("вікно входу відкривається з формою і закривається", async ({ page }) => {
  await open(page, "/");
  await expect(page.locator("#v-email")).toHaveCount(0);

  await page.getByRole("button", { name: "Вхід" }).click();
  const dialog = page.getByRole("dialog", { name: "Кабінет клієнта" });
  await expect(dialog.getByLabel("Пошта")).toBeVisible();

  await dialog.getByRole("button", { name: "Закрити" }).click();
  await expect(page.locator("#v-email")).toHaveCount(0);
});

test("вікно входу не порушує CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy/i.test(m.text()) && violations.push(m.text()));
  await open(page, "/");
  await page.getByRole("button", { name: "Вхід" }).click();
  await expect(page.getByRole("dialog", { name: "Кабінет клієнта" }).getByLabel("Пошта")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});
