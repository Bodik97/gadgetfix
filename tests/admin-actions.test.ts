import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { claims } from "./helpers/claimingDb";
import { devices, leadEvents, leadMessages, leads, reviews, works } from "@/db/schema";

/**
 * Дії адмінки — ними змінюються заявки, гроші, відгуки й склад. Server action
 * — це публічна POST-точка, викликати її може будь-хто, хто знає її id. Тож
 * кожна має сама перевіряти, що перед нею майстер, і не пускати сміття в базу.
 */

const m = vi.hoisted(() => ({
  admin: true,
  limits: {} as Record<string, { ok: true } | { ok: false; retryAfter: number }>,
  released: [] as string[],
  credentials: null as number | null | "throw",
  sessions: [] as number[],
  uploaded: [] as string[],
  deleted: [] as string[],
  delFails: false,
  told: [] as string[],
  offered: [] as (number | null)[],
  watched: [] as unknown[][],
}));

vi.mock("@/db", async () => {
  const { claimingDb } = await import("./helpers/claimingDb");
  return { getDb: () => claimingDb };
});

// Повідомлення клієнту й стеження за посилкою — назовні; тут важливо лише, чи їх викликали
vi.mock("@/lib/clientBot", () => ({
  notifyClientStatus: async (lead: { status: string }) => {
    m.told.push(lead.status);
    return true;
  },
  offerPrice: async (lead: { price: number | null }) => {
    m.offered.push(lead.price);
    return true;
  },
}));
vi.mock("workflow/api", () => ({
  start: async (_workflow: unknown, args: unknown[]) => {
    m.watched.push(args);
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@vercel/blob", () => ({
  put: async (path: string) => {
    m.uploaded.push(path);
    return { pathname: path };
  },
  del: async (path: string) => {
    if (m.delFails) throw new Error("blob down");
    m.deleted.push(path);
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async (subject: string) => m.limits[subject] ?? { ok: true },
  release: async (subject: string) => {
    m.released.push(subject);
  },
}));

vi.mock("@/lib/admin", () => ({
  isAdmin: async () => m.admin,
  currentAdmin: async () => (m.admin ? { name: "Богдан", email: "b@gadgetfix.ua" } : null),
  checkCredentials: () => {
    if (m.credentials === "throw") throw new Error("no env");
    return m.credentials;
  },
  createSession: async (i: number) => {
    m.sessions.push(i);
  },
  destroySession: async () => {},
}));

import * as actions from "@/app/admin/actions";

const form = (fields: Record<string, string | File> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

const LEAD = {
  id: "11111111-1111-1111-1111-111111111111",
  orderNo: 1001,
  name: "Олег",
  phone: "0733150238",
  model: "iPhone 13",
  clerkUserId: "user_1",
  deliveryRequested: false,
  source: "landing",
  status: "ready",
  price: null,
  prepayment: null,
  prepaidAt: null,
  paidAt: null,
  createdAt: new Date("2026-05-01T10:00:00Z"),
  updatedAt: new Date("2026-05-01T10:00:00Z"),
};

/** Текст запиту з параметрами — щоб перевіряти, що саме пішло в базу */
const writesText = () => fake.writes().map((q) => `${q.sql} ${JSON.stringify(q.params)}`);

beforeEach(() => {
  fake.reset();
  m.admin = true;
  m.limits = {};
  m.released = [];
  m.credentials = null;
  m.sessions = [];
  m.uploaded = [];
  m.deleted = [];
  m.delFails = false;
  m.told = [];
  m.offered = [];
  m.watched = [];
  claims.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("без входу майстра жодна дія не змінює базу", () => {
  const guarded = Object.entries(actions).filter(([name]) => !["signIn", "signOut"].includes(name));

  it("перевірені всі дії адмінки", () => {
    // Нова дія без перевірки має потрапити сюди, а не прослизнути повз
    expect(guarded.map(([n]) => n).sort()).toEqual(
      [
        "addNote", "addReview", "addWork", "applyReviewDiscount", "createExpense", "createLead", "createPart",
        "deleteExpense", "deleteLead", "deletePart", "deleteReview", "deleteWork", "removePushSubscription", "savePushSubscription", "sendTestPush",
        "setAssignee", "setMoney", "setReviewDiscount", "setReviewPublished", "setStatus", "setTtn", "setWarranty",
        "shiftPart",
      ].sort(),
    );
  });

  for (const [name, action] of guarded) {
    it(name, async () => {
      m.admin = false;
      const f = form({
        id: LEAD.id, status: "done", text: "Довгий текст відгуку", ttn: "204500", publish: "1",
        price: "100", authorName: "Олег", amount: "100", name: "Екран", delta: "1",
      });
      await expect((action as (f: FormData) => Promise<unknown>)(f)).rejects.toThrow("REDIRECT:/admin/vhid");
      expect(fake.queries).toEqual([]);
    });
  }
});

describe("signIn", () => {
  const signIn = (email: string, password: string) =>
    actions.signIn(null, form({ email, password }));

  it("ліміт на пошту перевіряється до пароля", async () => {
    m.limits["login:email:a@b.cc:9.9.9.9"] = { ok: false, retryAfter: 600 };
    m.credentials = 0;
    expect(await signIn(" A@B.cc ", "x")).toBe("Забагато спроб входу. Спробуйте за 10 хв.");
    expect(m.sessions).toEqual([]);
  });

  it("ліміт рахується за першою адресою з x-forwarded-for", async () => {
    m.limits["login:ip:9.9.9.9"] = { ok: false, retryAfter: 30 };
    expect(await signIn("a@b.cc", "x")).toBe("Забагато спроб входу. Спробуйте за хвилину.");
  });

  it("неправильний пароль — повідомлення, без сесії й без зняття лічильника", async () => {
    vi.useFakeTimers();
    const pending = signIn("a@b.cc", "bad");
    await vi.advanceTimersByTimeAsync(700);
    expect(await pending).toBe("Пошта або пароль не підходять.");
    vi.useRealTimers();
    expect(m.sessions).toEqual([]);
    expect(m.released).toEqual([]);
  });

  it("правильний — сесія саме цього майстра, лічильник знято, переходимо в адмінку", async () => {
    m.credentials = 1;
    await expect(signIn("a@b.cc", "ok")).rejects.toThrow("REDIRECT:/admin");
    expect(m.sessions).toEqual([1]);
    expect(m.released).toEqual(["login:email:a@b.cc:9.9.9.9"]);
  });

  it("чужі спроби на пошту майстра з іншої адреси не зачиняють його самого", async () => {
    // Хтось, знаючи пошту, вичерпав спроби зі свого компʼютера
    m.limits["login:email:a@b.cc:6.6.6.6"] = { ok: false, retryAfter: 600 };
    // Старий спільний лічильник «на пошту» більше ні на що не впливає
    m.limits["login:email:a@b.cc"] = { ok: false, retryAfter: 600 };
    m.credentials = 0;
    await expect(signIn("a@b.cc", "ok")).rejects.toThrow("REDIRECT:/admin");
    expect(m.sessions).toEqual([0]);
  });

  it("адмінка не налаштована — зрозуміле повідомлення, а не падіння", async () => {
    m.credentials = "throw";
    expect(await signIn("a@b.cc", "x")).toMatch(/Адмінка не налаштована/);
  });
});

describe("setStatus", () => {
  it("невідомий статус — нічого не пишемо", async () => {
    await actions.setStatus(form({ id: LEAD.id, status: "hacked" }));
    expect(fake.writes()).toEqual([]);
  });

  it("новий статус — оновлення заявки й подія в хроніці", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setStatus(form({ id: LEAD.id, status: "in_progress" }));
    const w = writesText();
    expect(w[0]).toMatch(/^update "leads" set "status" = \$1/);
    expect(w[0]).toContain('"in_progress"');
    expect(w[1]).toMatch(/^insert into "lead_events"/);
    expect(w).toHaveLength(2);
  });

  it("заявку вже видалили — нічого не пишемо й не падаємо на події без заявки", async () => {
    await actions.setStatus(form({ id: LEAD.id, status: "in_progress" }));
    expect(fake.writes()).toEqual([]);
    expect(m.told).toEqual([]);
  });

  it("«Відправлено» без ТТН не ставиться — статус дає лише збереження накладної", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setStatus(form({ id: LEAD.id, status: "shipped" }));
    expect(fake.writes()).toEqual([]);
  });

  it("«Відправлено» з уже вписаною ТТН ставиться", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, ttn: "20450000000000" }]);
    await actions.setStatus(form({ id: LEAD.id, status: "shipped" }));
    expect(writesText()[0]).toContain('"shipped"');
  });

  it("«Завершено» — пристрій клієнта потрапляє в гарантійний список", async () => {
    fake.onSelect(leads, () => [LEAD]);
    fake.onSelect(devices, () => []);
    await actions.setStatus(form({ id: LEAD.id, status: "done" }));
    const device = fake.writes().find((q) => q.sql.startsWith('insert into "devices"'));
    expect(device?.params).toEqual(expect.arrayContaining(["user_1", LEAD.id, "iPhone 13"]));
  });

  it("«Завершено» — закриває умовний UPDATE: лише заявку, яка ще не закрита", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setStatus(form({ id: LEAD.id, status: "done" }));
    const [update, event] = fake.writes();
    expect(update.sql).toMatch(/^update "leads" set .* where \("leads"\."id" = \$\d+ and "leads"\."status" <> \$\d+\) returning "id"$/);
    expect(event.sql).toMatch(/^insert into "lead_events"/);
    expect(m.told).toEqual(["done"]);
  });

  it("двоє закривають одночасно — другий не пише другої події й не шле друге «Завершено»", async () => {
    claims.rows = []; // умова в UPDATE не спрацювала: заявку щойно закрив інший
    const done = { ...LEAD, status: "done", warrantyUntil: new Date("2027-01-01T10:00:00Z") };
    fake.onSelect(leads, () => [done]);
    fake.onSelect(leadEvents, () => [{ at: new Date("2026-10-03T10:00:00Z") }]);
    fake.onSelect(devices, () => [{ id: "d1" }]);

    await actions.setStatus(form({ id: LEAD.id, status: "done" }));

    expect(fake.writes().map((q) => q.sql.split(" ").slice(0, 3).join(" "))).toEqual(['update "leads" set']);
    expect(m.told).toEqual([]);
  });

  it("закриття обірвалось після статусу — повтор доробляє подію, пристрій і повідомлення", async () => {
    claims.rows = [];
    const until = new Date("2027-01-01T10:00:00Z");
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", warrantyUntil: until }]);
    // Події «done» в хроніці немає, пристрою в кабінеті теж
    fake.onSelect(devices, () => []);

    await actions.setStatus(form({ id: LEAD.id, status: "done" }));

    const w = fake.writes();
    expect(w.some((q) => q.sql.startsWith('insert into "lead_events"'))).toBe(true);
    const device = w.find((q) => q.sql.startsWith('insert into "devices"'))!;
    expect(device.params).toContain(until.toISOString());
    expect(m.told).toEqual(["done"]);
  });

  it("«Завершено» вдруге — пристрій не дублюється", async () => {
    fake.onSelect(leads, () => [LEAD]);
    fake.onSelect(devices, () => [{ id: "d1", clerkUserId: "user_1", leadId: LEAD.id, name: "x", warrantyUntil: new Date(), createdAt: new Date() }]);
    await actions.setStatus(form({ id: LEAD.id, status: "done" }));
    expect(fake.writes().some((q) => q.sql.startsWith('insert into "devices"'))).toBe(false);
  });
});

describe("гарантія", () => {
  const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
  const untilIn = (sqlStart: string) => {
    const q = fake.writes().find((w) => w.sql.startsWith(sqlStart) && w.sql.includes('"warranty_until"'))!;
    return new Date(q.params.find((p) => typeof p === "string" && /^\d{4}-\d\d-\d\dT/.test(p)) as string);
  };

  it("видача запускає гарантію на строк, який обрав майстер", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, warrantyDays: 120 }]);
    fake.onSelect(devices, () => []);
    await actions.setStatus(form({ id: LEAD.id, status: "done" }));
    expect(daysBetween(new Date(), untilIn('update "leads"'))).toBe(120);
    // У кабінеті клієнта — та сама дата, що й у заявці, а не порахована вдруге
    expect(untilIn('insert into "devices"').toISOString()).toBe(untilIn('update "leads"').toISOString());
  });

  it("майстер не обирав — строк за видом роботи: після води 30 днів", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, service: "Відновлення після води" }]);
    fake.onSelect(devices, () => []);
    await actions.setStatus(form({ id: LEAD.id, status: "done" }));
    expect(daysBetween(new Date(), untilIn('update "leads"'))).toBe(30);
  });

  it("діагностика — без гарантії: дати немає, пристрій у гарантійний список не потрапляє", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, service: "Діагностика" }]);
    await actions.setStatus(form({ id: LEAD.id, status: "done" }));
    expect(fake.writes().some((q) => q.sql.startsWith('insert into "devices"'))).toBe(false);
  });

  it("повторне «Видано» не зсуває дату гарантії", async () => {
    const until = new Date("2026-12-01T10:00:00Z");
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", warrantyUntil: until }]);
    fake.onSelect(devices, () => [{ id: "d1" }]);
    await actions.setStatus(form({ id: LEAD.id, status: "done" }));
    expect(untilIn('update "leads"').toISOString()).toBe(until.toISOString());
  });

  it("строк, змінений після видачі, рахується від того самого дня видачі", async () => {
    const handedOver = new Date("2026-10-01T10:00:00Z");
    const until = new Date(handedOver);
    until.setDate(until.getDate() + 60);
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", warrantyDays: 60, warrantyUntil: until }]);

    await actions.setWarranty(form({ id: LEAD.id, days: "120" }));
    expect(daysBetween(handedOver, untilIn('update "leads"'))).toBe(120);
  });

  const HANDED = new Date("2026-06-01T09:00:00Z");
  const doneEvent = () => fake.onSelect(leadEvents, () => [{ at: HANDED }]);

  it("день видачі береться з хроніки, а не з updatedAt, який зсуває кожна правка", async () => {
    // Закрили «без гарантії», потім ще правили заявку — updatedAt уже не день видачі
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", warrantyDays: 0, warrantyUntil: null, updatedAt: new Date("2026-09-20T09:00:00Z") }]);
    doneEvent();

    await actions.setWarranty(form({ id: LEAD.id, days: "60" }));
    expect(daysBetween(HANDED, untilIn('update "leads"'))).toBe(60);
  });

  it("заявку закривали без гарантії — зі строком пристрій зʼявляється в кабінеті", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", warrantyDays: 0, warrantyUntil: null }]);
    fake.onSelect(devices, () => []);
    doneEvent();

    await actions.setWarranty(form({ id: LEAD.id, days: "30" }));
    const device = fake.writes().find((q) => q.sql.startsWith('insert into "devices"'))!;
    expect(device.params).toEqual(expect.arrayContaining(["user_1", LEAD.id]));
    expect(daysBetween(HANDED, untilIn('insert into "devices"'))).toBe(30);
  });

  it("пристрій уже в кабінеті — дата оновлюється, другий не додається", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", warrantyDays: 60, warrantyUntil: new Date("2026-08-30T09:00:00Z") }]);
    fake.onSelect(devices, () => [{ id: "d1" }]);
    doneEvent();

    await actions.setWarranty(form({ id: LEAD.id, days: "120" }));
    expect(daysBetween(HANDED, untilIn('update "devices"'))).toBe(120);
    expect(fake.writes().some((q) => q.sql.startsWith('insert into "devices"'))).toBe(false);
  });

  it("«без гарантії» після видачі — дата стирається, пристрій зникає з кабінету", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", warrantyDays: 90, warrantyUntil: new Date("2026-08-30T09:00:00Z") }]);
    doneEvent();

    await actions.setWarranty(form({ id: LEAD.id, days: "0" }));
    const w = writesText();
    expect(w[0]).toMatch(/^update "leads" set "warranty_days" = \$1, "warranty_until" = \$2/);
    expect(fake.writes()[0].params.slice(0, 2)).toEqual([0, null]);
    expect(w[1]).toMatch(/^delete from "devices" where "devices"\."lead_id" = \$1/);
  });

  it("до видачі строк лише запамʼятовується — пристроїв не чіпаємо", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setWarranty(form({ id: LEAD.id, days: "30" }));
    expect(fake.writes().map((q) => q.sql.split(" ").slice(0, 2).join(" "))).toEqual(['update "leads"']);
  });

  it("строк не зі списку не зберігається", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setWarranty(form({ id: LEAD.id, days: "999" }));
    expect(fake.writes()).toEqual([]);
  });
});

describe("createLead — заявка, яку заводить майстер", () => {
  const create = (fields: Record<string, string>) => actions.createLead(null, form(fields));

  it("без імені чи телефону — підказка, без запису", async () => {
    expect(await create({ name: "О", phone: "0733150238" })).toMatch(/імʼя клієнта/);
    expect(await create({ name: "Олег2", phone: "0733150238" })).toMatch(/лише літери/);
    expect(await create({ name: "Олег", phone: "123" })).toMatch(/телефон/);
    expect(fake.writes()).toEqual([]);
  });

  it("джерело «вручну», заявка за тим, хто створив, далі — відкрити її розгорнутою", async () => {
    fake.onInsert(leads, () => [{ id: "new-id", orderNo: 1077 }]);
    await expect(create({ name: " Олег ", phone: "073 315 02 38", model: "iPhone 13" })).rejects.toThrow(
      "REDIRECT:/admin/zayavky?q=1077&open=new-id",
    );
    const [q] = fake.writes();
    expect(q.sql).toMatch(/^insert into "leads"/);
    expect(q.params).toEqual(expect.arrayContaining(["Олег", "+380733150238", "iPhone 13", "b@gadgetfix.ua", "manual", "new"]));
  });

  it("пристрій уже в сервісі — одразу «У роботі»", async () => {
    fake.onInsert(leads, () => [{ id: "new-id", orderNo: 1078 }]);
    await expect(create({ name: "Олег", phone: "0733150238", handedOver: "on" })).rejects.toThrow(/REDIRECT/);
    expect(fake.writes()[0].params).toContain("in_progress");
  });
});

describe("savePushSubscription", () => {
  const KEYS = { endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } };

  it("підписка — за майстром, який увімкнув; повторне ввімкнення оновлює, а не дублює", async () => {
    await actions.savePushSubscription(KEYS, "iPhone");
    const [q] = fake.writes();
    expect(q.sql).toMatch(/^insert into "push_subscriptions"/);
    expect(q.sql).toMatch(/on conflict \("endpoint"\) do update/);
    expect(q.params).toEqual(expect.arrayContaining(["b@gadgetfix.ua", "https://push.example/abc", "p", "a", "iPhone"]));
  });

  it("не https-адреса чи без ключів — нічого не пишемо", async () => {
    await actions.savePushSubscription({ endpoint: "javascript:alert(1)", keys: { p256dh: "p", auth: "a" } }, "x");
    await actions.savePushSubscription({ endpoint: "https://push.example/abc", keys: { p256dh: "", auth: "a" } }, "x");
    expect(fake.writes()).toEqual([]);
  });
});

describe("setAssignee", () => {
  it("«Взяти собі» — заявка на пошту того, хто зайшов, без події в хроніці", async () => {
    await actions.setAssignee(form({ id: LEAD.id, take: "1" }));
    const w = fake.writes();
    expect(w).toHaveLength(1);
    expect(w[0].sql).toMatch(/^update "leads" set "assignee" = \$1/);
    expect(w[0].params[0]).toBe("b@gadgetfix.ua");
  });

  it("«Відпустити» — поле очищається", async () => {
    await actions.setAssignee(form({ id: LEAD.id, take: "0" }));
    expect(fake.writes()[0].params[0]).toBeNull();
  });

  it("без id — нічого не пишемо", async () => {
    await actions.setAssignee(form({ take: "1" }));
    expect(fake.writes()).toEqual([]);
  });
});

describe("addNote і setTtn", () => {
  it("закоротка нотатка не пишеться", async () => {
    await actions.addNote(form({ id: LEAD.id, text: " ok " }));
    expect(fake.writes()).toEqual([]);
  });

  const TTN = "20450012345678";
  const kinds = () => fake.writes().map((q) => q.sql.split(" ").slice(0, 3).join(" "));

  it("накладна — статус «Відправлено», подія з номером, повідомлення клієнту й стеження за посилкою", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setTtn(form({ id: LEAD.id, ttn: ` ${TTN} ` }));
    const w = writesText();
    // «Відправлено» стає лише незакрита заявка — умова в самому запиті
    expect(w[0]).toMatch(/^update "leads" set "ttn" = \$1, "status" = case when "leads"\."status" in \(\$2, \$3, \$4\) then 'shipped' else "leads"\."status" end/);
    expect(fake.writes()[0].params.slice(0, 4)).toEqual([TTN, "new", "in_progress", "ready"]);
    expect(w[1]).toContain(`накладна ${TTN}`);
    expect(m.told).toEqual(["shipped"]);
    expect(m.watched).toEqual([[LEAD.id, TTN]]);
  });

  it("та сама накладна вдруге (Enter у полі) — нічого: ні запису, ні події, ні повідомлення, ні стеження", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, status: "shipped", ttn: TTN }]);
    await actions.setTtn(form({ id: LEAD.id, ttn: TTN }));
    expect(fake.writes()).toEqual([]);
    expect(m.told).toEqual([]);
    expect(m.watched).toEqual([]);
  });

  it("виправлення номера у відправленій заявці — лише номер і нове стеження, без другого «Відправлено»", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, status: "shipped", ttn: "20450000000000" }]);
    await actions.setTtn(form({ id: LEAD.id, ttn: TTN }));
    expect(kinds()).toEqual(['update "leads" set']);
    expect(m.told).toEqual([]);
    expect(m.watched).toEqual([[LEAD.id, TTN]]);
  });

  it("накладна в закритій заявці — номер зберігається, статус лишається, клієнта не турбуємо", async () => {
    for (const status of ["done", "rejected"]) {
      fake.reset();
      fake.onSelect(leads, () => [{ ...LEAD, status }]);
      await actions.setTtn(form({ id: LEAD.id, ttn: TTN }));
      expect(kinds()).toEqual(['update "leads" set']);
      // Закритих статусів серед тих, з яких переводимо у «Відправлено», немає
      expect(fake.writes()[0].params).not.toContain(status);
    }
    expect(m.told).toEqual([]);
    expect(m.watched).toEqual([]);
  });

  it("стерли накладну у відправленій заявці — вона повертається в «Готово», а не лишається «Відправлено» без ТТН", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, status: "shipped", ttn: TTN }]);
    await actions.setTtn(form({ id: LEAD.id, ttn: "" }));
    const w = writesText();
    expect(w[0]).toMatch(/^update "leads" set "ttn" = \$1, "status" = case when "leads"\."status" = 'shipped' then 'ready' else "leads"\."status" end/);
    expect(fake.writes()[0].params[0]).toBeNull();
    expect(w[1]).toMatch(/^insert into "lead_events"/);
    expect(w[1]).toContain('"ready"');
    expect(m.told).toEqual([]);
    expect(m.watched).toEqual([]);
  });

  it("стерли накладну в закритій заявці — лише поле, без події", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, status: "done", ttn: TTN }]);
    await actions.setTtn(form({ id: LEAD.id, ttn: "" }));
    expect(kinds()).toEqual(['update "leads" set']);
  });

  it("порожнє поле без накладної або невідома заявка — нічого не пишемо", async () => {
    await actions.setTtn(form({ id: LEAD.id, ttn: TTN }));
    fake.onSelect(leads, () => [LEAD]);
    await actions.setTtn(form({ id: LEAD.id, ttn: "  " }));
    expect(fake.writes()).toEqual([]);
  });
});

describe("setMoney", () => {
  it("ціна з пробілами й комою, подія про погоджену ціну", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setMoney(form({ id: LEAD.id, price: "3 499,6" }));
    const w = writesText();
    expect(w[0]).toMatch(/"price" = \$1/);
    expect(fake.writes()[0].params[0]).toBe(3500);
    expect(w[1]).toContain("Погодили ціну ремонту: 3500 ₴");
  });

  it("від'ємна чи нечислова сума поле не чіпає", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setMoney(form({ id: LEAD.id, price: "-5", partsCost: "abc" }));
    expect(fake.writes()).toEqual([]);
  });

  it("пишеться лише те поле, що прийшло: стара вкладка не затирає ціну й відмітки, які поставив інший майстер", async () => {
    // У базі вже ціна 3000 і «оплачено»; з давно відкритої картки міняють лише деталь
    fake.onSelect(leads, () => [{ ...LEAD, price: 3000, paidAt: new Date("2026-04-01T09:00:00Z") }]);
    expect(await actions.setMoney(form({ id: LEAD.id, partsCost: "900" }))).toBeNull();

    const w = fake.writes();
    expect(w).toHaveLength(1);
    expect(w[0].sql).toMatch(/^update "leads" set "parts_cost" = \$1, "updated_at" = \$2 where/);
    expect(w[0].params[0]).toBe(900);
    // Ціну не чіпали — клієнту її вдруге не пропонуємо
    expect(m.offered).toEqual([]);
  });

  it("нова ціна — клієнту з ботом пропонуємо її один раз; та сама вдруге — ні події, ні пропозиції", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setMoney(form({ id: LEAD.id, price: "3500" }));
    expect(m.offered).toEqual([3500]);

    fake.reset();
    fake.onSelect(leads, () => [{ ...LEAD, price: 3500 }]);
    await actions.setMoney(form({ id: LEAD.id, price: "3500" }));
    expect(m.offered).toEqual([3500]);
    expect(fake.writes()).toHaveLength(1);
  });

  it("передоплата більша за ціну — зрозуміла помилка, нічого не пишемо", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, price: 1000 }]);
    expect(await actions.setMoney(form({ id: LEAD.id, prepayment: "1500" }))).toBe(
      "Передоплата (1500 ₴) не може бути більшою за ціну (1000 ₴).",
    );

    // Так само, коли ціну опускають нижче вже вписаної передоплати
    fake.reset();
    fake.onSelect(leads, () => [{ ...LEAD, price: 2000, prepayment: 800 }]);
    expect(await actions.setMoney(form({ id: LEAD.id, price: "500" }))).toMatch(/Передоплата \(800 ₴\)/);
    expect(fake.writes()).toEqual([]);

    // Рівна ціні — можна
    fake.reset();
    fake.onSelect(leads, () => [{ ...LEAD, price: 1000 }]);
    expect(await actions.setMoney(form({ id: LEAD.id, prepayment: "1000" }))).toBeNull();
    expect(fake.writes()).toHaveLength(1);
  });

  it("повторне збереження не зсуває дату оплати", async () => {
    const paidAt = new Date("2026-04-01T09:00:00.000Z");
    fake.onSelect(leads, () => [{ ...LEAD, paidAt }]);
    await actions.setMoney(form({ id: LEAD.id, paid: "on" }));
    expect(fake.writes()[0].params).toContain(paidAt.toISOString());
    expect(fake.writes()[0].sql).not.toMatch(/"prepaid_at"|"price"/);
  });

  it("зняли відмітку «оплачено» — дата оплати стирається, передоплату не чіпаємо", async () => {
    fake.onSelect(leads, () => [{ ...LEAD, paidAt: new Date(), prepaidAt: new Date() }]);
    await actions.setMoney(form({ id: LEAD.id, paid: "off" }));
    expect(fake.writes()[0].sql).toMatch(/^update "leads" set "paid_at" = \$1, "updated_at" = \$2 where/);
    expect(fake.writes()[0].params[0]).toBeNull();
  });

  it("передоплата вперше — подія з сумою; повторно — без події", async () => {
    fake.onSelect(leads, () => [LEAD]);
    await actions.setMoney(form({ id: LEAD.id, prepaid: "on", prepayment: "800" }));
    expect(writesText()[1]).toContain("Отримали передоплату: 800 ₴");

    fake.reset();
    fake.onSelect(leads, () => [{ ...LEAD, prepaidAt: new Date(), prepayment: 800 }]);
    await actions.setMoney(form({ id: LEAD.id, prepaid: "on", prepayment: "800" }));
    expect(fake.writes()).toHaveLength(1);
  });

  it("неіснуюча заявка — нічого не пишемо", async () => {
    await actions.setMoney(form({ id: LEAD.id, price: "100" }));
    expect(fake.writes()).toEqual([]);
  });
});

describe("addReview", () => {
  it("закороткий текст чи без імені — помилка, без запису", async () => {
    expect(await actions.addReview(form({ authorName: "О", text: "Дуже добре все" }))).toBe("Впишіть імʼя автора.");
    expect(await actions.addReview(form({ authorName: "Олег", text: "ок" }))).toMatch(/закороткий/);
    expect(fake.writes()).toEqual([]);
  });

  it("оцінка поза 1–5 стає 5, відгук майстра публікується одразу", async () => {
    expect(await actions.addReview(form({ authorName: "Олег", text: "Швидко й чесно, раджу", rating: "9" }))).toBeNull();
    const [insert] = fake.writes();
    expect(insert.sql).toMatch(/^insert into "reviews"/);
    expect(insert.params).toEqual(expect.arrayContaining([5, true]));
  });

  it("не фото — помилка, у сховище нічого не йде", async () => {
    const file = new File(["<svg/>"], "x.svg", { type: "text/html" });
    expect(await actions.addReview(form({ authorName: "Олег", text: "Швидко й чесно, раджу", image: file }))).toBe("Можна додавати лише фото.");
    expect(m.uploaded).toEqual([]);
  });

  it("SVG — теж «image/*», але не фото: приймаємо лише ті формати, що й у чаті", async () => {
    const add = (type: string) =>
      actions.addReview(form({ authorName: "Олег", text: "Швидко й чесно, раджу", image: new File(["x"], "x", { type }) }));

    expect(await add("image/svg+xml")).toBe("Можна додавати лише фото.");
    expect(await add("image/gif")).toBe("Можна додавати лише фото.");
    expect(m.uploaded).toEqual([]);

    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"]) expect(await add(type)).toBeNull();
    expect(m.uploaded).toHaveLength(4);
  });
});

describe("deleteReview", () => {
  it("прибирає фото зі сховища, потім сам відгук", async () => {
    fake.onSelect(reviews, () => [{ imagePath: "reviews/abc", beforePath: "reviews/b", afterPath: "reviews/a" }]);
    await actions.deleteReview(form({ id: "r1" }));
    expect(m.deleted).toEqual(["reviews/abc", "reviews/b", "reviews/a"]);
    expect(fake.writes().map((q) => q.sql)).toEqual(['delete from "reviews" where "reviews"."id" = $1']);
  });

  it("видалення зі сторінки відгуку повертає до списку", async () => {
    fake.onSelect(reviews, () => [{ imagePath: null }]);
    await expect(actions.deleteReview(form({ id: "r1", back: "1" }))).rejects.toThrow("REDIRECT:/admin/vidhuky");
    expect(fake.writes().map((q) => q.sql)).toEqual(['delete from "reviews" where "reviews"."id" = $1']);
  });

  it("відгук без фото й збій сховища не заважають видаленню", async () => {
    fake.onSelect(reviews, () => [{ imagePath: null }]);
    await actions.deleteReview(form({ id: "r1" }));
    expect(m.deleted).toEqual([]);

    fake.reset();
    m.delFails = true;
    fake.onSelect(reviews, () => [{ imagePath: "reviews/abc" }]);
    await actions.deleteReview(form({ id: "r2" }));
    expect(fake.writes().map((q) => q.sql)).toEqual(['delete from "reviews" where "reviews"."id" = $1']);
  });
});

describe("знижка 10% за відгук", () => {
  const REVIEW = { id: "r1", leadId: LEAD.id, beforePath: "reviews/b", afterPath: "reviews/a", discountAt: null };
  const updateOf = () => fake.writes().find((q) => q.sql.startsWith('update "reviews"'))!;

  it("схвалення відгуку з обома фото й виданим ремонтом нараховує знижку", async () => {
    fake.onSelect(reviews, () => [REVIEW]);
    await actions.setReviewPublished(form({ id: "r1", publish: "1" }));
    expect(updateOf().sql).toMatch(/"discount_at" = \$\d/);
  });

  it("без одного з фото, без ремонту чи повторно — знижки немає", async () => {
    for (const r of [
      { ...REVIEW, afterPath: null },
      { ...REVIEW, leadId: null },
      { ...REVIEW, discountAt: new Date() },
    ]) {
      fake.reset();
      fake.onSelect(reviews, () => [r]);
      await actions.setReviewPublished(form({ id: "r1", publish: "1" }));
      expect(updateOf().sql).not.toMatch(/discount_at/);
    }
  });

  it("сховати відгук — знижку не нараховуємо", async () => {
    fake.onSelect(reviews, () => [REVIEW]);
    await actions.setReviewPublished(form({ id: "r1", publish: "0" }));
    expect(updateOf().sql).not.toMatch(/discount_at/);
  });

  it("майстер нараховує знижку вручну — лише клієнту з акаунтом і лише раз", async () => {
    await actions.setReviewDiscount(form({ id: "r1", grant: "1" }));
    expect(updateOf().sql).toMatch(/"discount_at" = \$1 where \("reviews"\."id" = \$2 and "reviews"\."clerk_user_id" is not null and "reviews"\."discount_at" is null\)/);
  });

  it("скасувати можна лише невикористану знижку", async () => {
    await actions.setReviewDiscount(form({ id: "r1", grant: "0" }));
    expect(updateOf().sql).toMatch(/"discount_at" = \$1 where \("reviews"\."id" = \$2 and "reviews"\."discount_lead_id" is null\)/);
    expect(updateOf().params[0]).toBeNull();
  });

  it("врахована знижка пишеться в хроніку заявки лише раз", async () => {
    await actions.applyReviewDiscount(form({ reviewId: "r1", leadId: LEAD.id }));
    expect(updateOf().sql).toMatch(/"discount_at" is not null and "reviews"\."discount_lead_id" is null/);
    expect(writesText().some((t) => t.startsWith('insert into "lead_events"') && t.includes("знижку 10%"))).toBe(true);

    fake.reset();
    claims.rows = [];
    await actions.applyReviewDiscount(form({ reviewId: "r1", leadId: LEAD.id }));
    expect(fake.writes().some((q) => q.sql.startsWith('insert into "lead_events"'))).toBe(false);
  });
});

describe("результати робіт", () => {
  const photo = () => new File(["x"], "p.jpg", { type: "image/jpeg" });
  const GOOD = { device: "iPhone 13 Pro", text: "Замінили розбитий дисплей на оригінальний" };

  it("без обох фото — помилка, нічого не зберігаємо", async () => {
    expect(await actions.addWork(form({ ...GOOD, before: photo() }))).toMatch(/обидва фото/);
    expect(m.uploaded).toEqual([]);
    expect(fake.writes()).toEqual([]);
  });

  it("з обома фото — два файли у сховищі й запис у базі", async () => {
    expect(await actions.addWork(form({ ...GOOD, before: photo(), after: photo() }))).toBeNull();
    expect(m.uploaded).toHaveLength(2);
    expect(m.uploaded.every((p) => p.startsWith("works/"))).toBe(true);
    const [insert] = fake.writes();
    expect(insert.sql).toMatch(/^insert into "works"/);
    expect(insert.params).toEqual(expect.arrayContaining([GOOD.device, GOOD.text, ...m.uploaded]));
  });

  it("видалення прибирає обидва фото", async () => {
    fake.onSelect(works, () => [{ id: "w1", beforePath: "works/b", afterPath: "works/a" }]);
    await actions.deleteWork(form({ id: "w1" }));
    expect(m.deleted).toEqual(["works/b", "works/a"]);
    expect(fake.writes().map((q) => q.sql)).toEqual(['delete from "works" where "works"."id" = $1']);
  });
});

describe("витрати й склад", () => {
  it("витрата без суми — помилка", async () => {
    expect(await actions.createExpense(form({ amount: "0" }))).toMatch(/більшу за нуль/);
    expect(await actions.createExpense(form({ amount: "abc" }))).toMatch(/більшу за нуль/);
    expect(fake.writes()).toEqual([]);
  });

  it("невідома категорія стає «other»", async () => {
    expect(await actions.createExpense(form({ amount: "1 200", category: "hack" }))).toBeNull();
    const [insert] = fake.writes();
    expect(insert.sql).toMatch(/^insert into "expenses"/);
    expect(insert.params).toEqual(expect.arrayContaining([1200, "other"]));
  });

  it("деталь без назви — помилка", async () => {
    expect(await actions.createPart(form({ name: "  " }))).toMatch(/що це за деталь/);
  });

  it("зсув залишку: дробне обрізається, нуль ігнорується", async () => {
    await actions.shiftPart(form({ id: "p1", delta: "0" }));
    expect(fake.writes()).toEqual([]);
    await actions.shiftPart(form({ id: "p1", delta: "-1.7" }));
    expect(fake.writes()[0].sql).toMatch(/greatest\(0, "parts"\."qty" \+ \$1\)/);
    expect(fake.writes()[0].params[0]).toBe(-1);
  });
});

describe("deleteLead", () => {
  it("прибирає фото зі сховища, потім заявку", async () => {
    fake.onSelect(leadMessages, () => [{ imagePath: "chat/l1/a" }, { imagePath: null }, { imagePath: "chat/l1/b" }]);
    await actions.deleteLead(form({ id: LEAD.id }));
    expect(m.deleted).toEqual(["chat/l1/a", "chat/l1/b"]);
    expect(fake.writes().map((q) => q.sql)).toEqual(['delete from "leads" where "leads"."id" = $1']);
  });

  it("збій сховища не лишає заявку невидаленою", async () => {
    m.delFails = true;
    fake.onSelect(leadMessages, () => [{ imagePath: "chat/l1/a" }]);
    await actions.deleteLead(form({ id: LEAD.id }));
    expect(fake.writes()[0].sql).toMatch(/^delete from "leads"/);
  });
});
