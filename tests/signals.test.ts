import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";
import { leadMessages, leads, reviews } from "@/db/schema";

/**
 * Сигнали головної адмінки. Тут важливо, щоб чати складались правильно:
 * одна заявка — один сигнал, з кількістю, останнім текстом і часом, що рахується
 * від найстарішого непрочитаного — бо саме стільки клієнт чекає відповіді.
 */

vi.mock("@/db", async () => {
  const { fake } = await import("./helpers/fakeDb");
  return { getDb: () => fake.db };
});

import { getSignals } from "@/db/signals";

const t = (min: number) => new Date(Date.UTC(2026, 9, 4, 10, min));

beforeEach(() => fake.reset());

describe("getSignals", () => {
  it("нові заявки, ТТН і відгуки — вибираються своїми умовами", async () => {
    fake.onSelect(leads, (q) =>
      q.params.includes("new")
        ? [{ id: "l1", orderNo: 1001, name: "Олег", phone: "0733150238", model: null, service: "Екран", assignee: "b@x.ua", at: t(0) }]
        : [{ id: "l2", orderNo: 1002, name: "Іра", address: "Київ, 5", at: t(1) }],
    );
    fake.onSelect(reviews, () => [{ id: "r1", author: "Андрій", rating: 4, text: "Добре", at: t(2) }]);

    const s = await getSignals();

    expect(s.fresh).toEqual([
      { leadId: "l1", orderNo: 1001, name: "Олег", phone: "0733150238", what: "Екран", assignee: "b@x.ua", at: t(0) },
    ]);
    expect(s.ship).toEqual([{ leadId: "l2", orderNo: 1002, name: "Іра", address: "Київ, 5", at: t(1) }]);
    expect(s.reviews).toHaveLength(1);

    const sql = fake.queries.map((q) => q.sql).join("\n");
    // Закриті (видано в руки, відмова) відправки вже не чекають
    expect(sql).toMatch(/"leads"\."delivery_requested" = \$\d+ and "leads"\."ttn" is null and "leads"\."status" not in \(\$\d+, \$\d+\)/);
    const ship = fake.queries.find((q) => q.sql.includes('"delivery_requested"'))!;
    expect(ship.params).toEqual(expect.arrayContaining(["done", "rejected"]));
    expect(sql).toMatch(/from "reviews" where "reviews"\."published" = \$\d+/);
    expect(sql).toMatch(/"lead_messages"\."author" = \$\d+ and "lead_messages"\."read_at" is null/);
  });

  it("чати: одна заявка — один сигнал з кількістю, останнім текстом і часом найстарішого", async () => {
    // База віддає від нових до старих
    fake.onSelect(leadMessages, () => [
      { leadId: "a", text: "Ну що там?", image: null, at: t(30), orderNo: 1, name: "Олег" },
      { leadId: "b", text: "", image: "chat/b/x", at: t(20), orderNo: 2, name: "Іра" },
      { leadId: "a", text: "Добрий день", image: null, at: t(5), orderNo: 1, name: "Олег" },
    ]);

    const { chats } = await getSignals();

    expect(chats).toEqual([
      // Олег чекає з 10:05 — він перший
      { leadId: "a", orderNo: 1, name: "Олег", count: 2, lastText: "Ну що там?", at: t(5) },
      // Повідомлення без тексту — це фото
      { leadId: "b", orderNo: 2, name: "Іра", count: 1, lastText: "Фото", at: t(20) },
    ]);
  });

  it("порожньо — усі списки порожні", async () => {
    expect(await getSignals()).toEqual({ fresh: [], chats: [], ship: [], reviews: [] });
  });
});
