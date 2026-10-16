import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { leadEvents, leads, reviews } from "@/db/schema";

/**
 * Дії клієнта з кабінету. Головне — клієнт змінює лише своє: доставку тільки
 * своєї заявки, відгук — по одному на виданий ремонт і тільки з підтвердженою поштою.
 */

type User = {
  id: string;
  firstName: string | null;
  hasImage: boolean;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string; verification: { status: string } } | null;
};

const m = vi.hoisted(() => ({
  userId: null as string | null,
  user: null as User | null,
  pushed: [] as unknown[],
  notified: [] as string[],
  uploaded: [] as string[],
}));

// claimingDb — щоб умовний update … returning відповідав «рядок оновлено»
vi.mock("@/db", async () => {
  const { claimingDb } = await import("./helpers/claimingDb");
  return { getDb: () => claimingDb };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/notify", () => ({
  alertMasters: async (push: unknown, html: string) => {
    m.pushed.push(push);
    m.notified.push(html);
    return "push";
  },
}));
vi.mock("@vercel/blob", () => ({
  put: async (path: string) => {
    m.uploaded.push(path);
    return { pathname: path };
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: m.userId }),
  currentUser: async () => m.user,
}));

import { confirmReceived, requestDelivery } from "@/app/moi-remonty/actions";
import { claims } from "./helpers/claimingDb";
import { submitReview } from "@/app/actions/reviews";

const form = (fields: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

const USER: User = {
  id: "user_1",
  firstName: " Олег ",
  hasImage: false,
  imageUrl: "https://img.clerk.com/initials",
  primaryEmailAddress: { emailAddress: "oleg@gmail.com", verification: { status: "verified" } },
};

beforeEach(() => {
  fake.reset();
  m.userId = null;
  m.user = null;
  m.pushed = [];
  m.notified = [];
  m.uploaded = [];
  claims.reset();
});

describe("requestDelivery", () => {
  const request = (fields: Record<string, string>) => requestDelivery(null, form(fields));
  const GOOD = { id: "l1", address: "Львів, відділення 5" };
  const LEAD = { id: "l1", orderNo: 1054, name: "Олег", status: "ready", clerkUserId: "user_1", email: null, createdAt: new Date() };

  it("без входу — просимо увійти й нічого не пишемо", async () => {
    expect(await request(GOOD)).toEqual({ ok: false, error: expect.stringMatching(/увійдіть/) });
    expect(fake.queries).toEqual([]);
  });

  it("закоротка адреса — помилка, нічого не пишемо", async () => {
    m.user = USER;
    expect(await request({ id: "l1", address: " Л " })).toEqual({ ok: false, error: expect.stringMatching(/відділення/) });
    expect(fake.queries).toEqual([]);
  });

  it("чужа заявка — помилка, а не мовчазне «нічого»", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ ...LEAD, id: "l2" }]);
    expect(await request(GOOD)).toEqual({ ok: false, error: expect.stringMatching(/Не знайшли/) });
    expect(fake.writes()).toEqual([]);
    expect(m.pushed).toEqual([]);
  });

  it("свою заявку шукаємо і за акаунтом, і за поштою — як сторінка кабінету", async () => {
    m.user = USER;
    // Заявка, залишена до реєстрації: акаунта в ній немає, лише та сама пошта
    fake.onSelect(leads, () => [{ ...LEAD, clerkUserId: null, email: "oleg@gmail.com" }]);
    expect(await request(GOOD)).toEqual({ ok: true });

    const [select] = fake.queries;
    expect(select.sql).toMatch(/where \("leads"\."clerk_user_id" = \$\d+ or "leads"\."email" = \$\d+\)/);
    expect(select.params).toEqual(expect.arrayContaining(["user_1", "oleg@gmail.com"]));

    const [q] = fake.writes();
    expect(q.sql).toMatch(/^update "leads" set .* where "leads"\."id" = \$\d+$/);
    expect(q.params).toEqual(expect.arrayContaining([true, "Львів, відділення 5", "l1"]));
  });

  it("завершену чи закриту заявку не приймаємо", async () => {
    m.user = USER;
    for (const status of ["done", "rejected"]) {
      fake.reset();
      fake.onSelect(leads, () => [{ ...LEAD, status }]);
      expect(await request(GOOD), status).toEqual({ ok: false, error: expect.stringMatching(/закрито/) });
      expect(fake.writes()).toEqual([]);
    }
    expect(m.pushed).toEqual([]);
  });

  it("майстри отримують сповіщення з номером заявки й адресою", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [LEAD]);
    expect(await request({ id: "l1", address: "  Львів, <відділення> 5  " })).toEqual({ ok: true });

    expect(m.pushed).toEqual([
      { title: "№1054 · просить надіслати поштою", body: "Олег · Львів, <відділення> 5", url: "/admin/zayavky?q=1054&open=l1", tag: "delivery-l1" },
    ]);
    expect(m.notified[0]).toContain("№1054 · Олег");
    expect(m.notified[0]).toContain("Львів, &lt;відділення&gt; 5");
  });

  it("задовга адреса обрізається до 300 символів", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [LEAD]);
    await request({ id: "l1", address: "а".repeat(1000) });
    expect(fake.writes()[0].params).toContain("а".repeat(300));
  });
});

describe("submitReview", () => {
  const submit = (fields: Record<string, string>) => submitReview(null, form(fields));
  const GOOD = { text: "Замінили екран за годину, все працює.", rating: "5", device: "iPhone 13" };

  it("без входу — просимо увійти", async () => {
    expect(await submit(GOOD)).toEqual({ ok: false, error: expect.stringMatching(/увійдіть/) });
    expect(fake.queries).toEqual([]);
  });

  it("закороткий текст або оцінка поза 1–5 — помилка", async () => {
    m.user = USER;
    expect((await submit({ ...GOOD, text: "Добре" })).ok).toBe(false);
    for (const rating of ["0", "6", "4.5", "abc"]) {
      expect(await submit({ ...GOOD, rating }), rating).toEqual({ ok: false, error: "Оберіть оцінку від 1 до 5." });
    }
    expect(fake.writes()).toEqual([]);
  });

  it("непідтверджена пошта — відгук не приймаємо", async () => {
    m.user = { ...USER, primaryEmailAddress: { emailAddress: "a@b.cc", verification: { status: "unverified" } } };
    expect(await submit(GOOD)).toEqual({ ok: false, error: expect.stringMatching(/підтвердіть пошту/) });
    expect(fake.writes()).toEqual([]);
  });

  it("другий відгук від того самого клієнта — відмова", async () => {
    m.user = USER;
    fake.onSelect(reviews, () => [{ id: "r1", clerkUserId: "user_1", authorName: "Олег", rating: 5, text: "x", createdAt: new Date() }]);
    expect(await submit(GOOD)).toEqual({ ok: false, error: "Ви вже лишали відгук. Дякуємо!" });
    expect(fake.writes()).toEqual([]);
  });

  it("перший відгук — у базу неопублікованим, з позначкою Google для gmail", async () => {
    m.user = USER;
    expect(await submit(GOOD)).toEqual({ ok: true });

    const [q] = fake.writes();
    expect(q.sql).toMatch(/^insert into "reviews"/);
    // published не передаємо — лишається default (false, на модерації)
    const [cols, vals] = [...q.sql.matchAll(/\(([^)]*)\)/g)].map((x) => x[1].split(", "));
    expect(vals[cols.indexOf('"published"')]).toBe("default");
    expect(q.params).toEqual(expect.arrayContaining(["user_1", "Олег", "iPhone 13", 5, true]));
  });

  it("ініціали Clerk не видаються за фото", async () => {
    m.user = USER;
    await submit(GOOD);
    expect(fake.writes()[0].params).not.toContain(USER.imageUrl);
  });

  const photo = () => new File(["x"], "photo.jpg", { type: "image/jpeg" });
  const DONE_LEAD = "22222222-2222-2222-2222-222222222222";

  it("фото до і після йдуть у сховище, виданий ремонт привʼязується — це умова знижки", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ id: DONE_LEAD, status: "done", createdAt: new Date() }]);
    expect(await submitReview(null, form({ ...GOOD, before: photo(), after: photo() }))).toEqual({ ok: true });

    expect(m.uploaded).toHaveLength(2);
    expect(m.uploaded.every((p) => p.startsWith("reviews/"))).toBe(true);
    expect(fake.writes()[0].params).toEqual(expect.arrayContaining([...m.uploaded, DONE_LEAD]));
  });

  it("без виданого ремонту відгук приймаємо, але без привʼязки до заявки", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ id: DONE_LEAD, status: "in_progress", createdAt: new Date() }]);
    expect(await submitReview(null, form({ ...GOOD, before: photo(), after: photo() }))).toEqual({ ok: true });
    expect(fake.writes()[0].params).not.toContain(DONE_LEAD);
  });

  const NEXT_LEAD = "44444444-4444-4444-4444-444444444444";
  const written = (leadId: string | null) => ({ id: "r1", clerkUserId: "user_1", leadId, authorName: "Олег", rating: 5, text: "x", createdAt: new Date() });

  it("новий виданий ремонт — можна ще один відгук, про нього", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [
      { id: NEXT_LEAD, status: "done", createdAt: new Date() },
      { id: DONE_LEAD, status: "done", createdAt: new Date() },
    ]);
    fake.onSelect(reviews, () => [written(DONE_LEAD)]);
    expect(await submit(GOOD)).toEqual({ ok: true });
    expect(fake.writes()[0].params).toContain(NEXT_LEAD);
    expect(fake.writes()[0].params).not.toContain(DONE_LEAD);
  });

  it("про ремонт, на який уже є відгук, другого не приймаємо", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ id: DONE_LEAD, status: "done", createdAt: new Date() }]);
    fake.onSelect(reviews, () => [written(DONE_LEAD)]);
    expect(await submit({ ...GOOD, leadId: DONE_LEAD })).toEqual({ ok: false, error: "Ви вже лишали відгук. Дякуємо!" });
    expect(fake.writes()).toEqual([]);
  });

  it("відгук прив'язується саме до того ремонту, з якого його лишили", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [
      { id: NEXT_LEAD, status: "done", createdAt: new Date() },
      { id: DONE_LEAD, status: "done", createdAt: new Date() },
    ]);
    expect(await submit({ ...GOOD, leadId: DONE_LEAD })).toEqual({ ok: true });
    expect(fake.writes()[0].params).toContain(DONE_LEAD);
    expect(fake.writes()[0].params).not.toContain(NEXT_LEAD);
  });

  it("відмова — відгуку про цей ремонт немає, навіть якщо клієнт натиснув «Я отримав гаджет»", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ id: DONE_LEAD, status: "rejected", receivedAt: new Date(), createdAt: new Date() }]);
    fake.onSelect(reviews, () => [written(null)]);
    expect(await submit({ ...GOOD, leadId: DONE_LEAD })).toEqual({ ok: false, error: "Ви вже лишали відгук. Дякуємо!" });
    expect(fake.writes()).toEqual([]);
  });

  it("чужа заявка в leadId не дає обійти правило", async () => {
    m.user = USER;
    fake.onSelect(leads, () => []);
    fake.onSelect(reviews, () => [written(null)]);
    expect(await submit({ ...GOOD, leadId: NEXT_LEAD })).toEqual({ ok: false, error: "Ви вже лишали відгук. Дякуємо!" });
    expect(fake.writes()).toEqual([]);
  });

  it("не фото — помилка, у сховище й базу нічого не йде", async () => {
    m.user = USER;
    const svg = new File(["<svg/>"], "x.svg", { type: "image/svg+xml" });
    expect(await submitReview(null, form({ ...GOOD, before: svg }))).toEqual({ ok: false, error: "Можна додавати лише фото." });
    expect(m.uploaded).toEqual([]);
    expect(fake.writes()).toEqual([]);
  });
});

describe("confirmReceived", () => {
  const LEAD = { id: "l1", orderNo: 1054, name: "Олег", status: "ready", clerkUserId: "user_1", email: null, receivedAt: null, createdAt: new Date() };
  const eventWrites = () => fake.writes().filter((q) => q.sql.startsWith('insert into "lead_events"'));

  it("без входу — нічого не пишемо", async () => {
    expect((await confirmReceived("l1")).ok).toBe(false);
    expect(fake.queries).toEqual([]);
  });

  it("чужа заявка — помилка", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ ...LEAD, id: "l2" }]);
    expect(await confirmReceived("l1")).toEqual({ ok: false, error: expect.stringMatching(/Не знайшли/) });
    expect(fake.writes()).toEqual([]);
  });

  it("пристрій ще в роботі або заявка закрита — підтвердити не можна", async () => {
    m.user = USER;
    for (const status of ["new", "in_progress", "done", "rejected"]) {
      fake.reset();
      fake.onSelect(leads, () => [{ ...LEAD, status }]);
      expect((await confirmReceived("l1")).ok, status).toBe(false);
      expect(fake.writes(), status).toEqual([]);
    }
  });

  it("готовий пристрій: відмітка, запис у хроніці й сигнал майстрам — заявку не закриваємо", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [LEAD]);
    fake.onSelect(leadEvents, () => []);
    expect(await confirmReceived("l1")).toEqual({ ok: true });

    const [update] = fake.writes();
    expect(update.sql).toMatch(/^update "leads" set "received_at" = \$1, "updated_at" = \$2 where \("leads"\."id" = \$3 and "leads"\."received_at" is null\)/);
    expect(update.sql).not.toMatch(/"status"/);
    expect(eventWrites()).toHaveLength(1);
    expect(m.pushed).toEqual([expect.objectContaining({ title: "№1054 · клієнт отримав пристрій" })]);
  });

  it("повторне натискання чи друга вкладка — без дублів у хроніці й сповіщеннях", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ ...LEAD, receivedAt: new Date() }]);
    expect(await confirmReceived("l1")).toEqual({ ok: true });
    expect(fake.writes()).toEqual([]);

    fake.reset();
    claims.rows = [];
    fake.onSelect(leads, () => [LEAD]);
    expect(await confirmReceived("l1")).toEqual({ ok: true });
    expect(eventWrites()).toEqual([]);
    expect(m.pushed).toEqual([]);
  });

  it("підтверджене отримання зараховується для знижки за відгук", async () => {
    m.user = USER;
    fake.onSelect(leads, () => [{ ...LEAD, id: "33333333-3333-3333-3333-333333333333", receivedAt: new Date() }]);
    const f = form({ text: "Замінили екран за годину, все працює.", rating: "5" });
    expect(await submitReview(null, f)).toEqual({ ok: true });
    expect(fake.writes()[0].params).toContain("33333333-3333-3333-3333-333333333333");
  });
});
