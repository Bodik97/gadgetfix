import { describe, expect, it, vi } from "vitest";
import { fake } from "./helpers/fakeDb";

vi.mock("@/db", () => ({ getDb: () => fake.db }));

import { getEvents } from "@/db/events";

/**
 * Хроніка в кабінеті клієнта: службові записи нової адмінки (діагностика,
 * пауза, нагадування) клієнт бачити не має — лише зміни статусу й нотатки для нього.
 */
describe("getEvents — що бачить клієнт", () => {
  it("відсікає внутрішнє: етап без статусу і записи майстра без статусу", async () => {
    await getEvents("l1");
    const q = fake.queries[0].sql;
    expect(q).toContain('"lead_events"."status" is not null');
    expect(q).toMatch(/"lead_events"\."stage" is null and "lead_events"\."actor" is null/);
  });
});
