import { describe, expect, it } from "vitest";
import { guessLocation, isOverdue, orderLabel, stageToStatus, statusToStage } from "@/lib/stage";

/**
 * Нова адмінка працює з етапами, а клієнт і далі бачить старий статус.
 * Якщо переклад зламається, клієнт у кабінеті побачить не той стан ремонту.
 */

describe("stageToStatus — що бачить клієнт", () => {
  it("діагностика й погодження для клієнта — ще «прийнято»", () => {
    expect(stageToStatus("new", null, null)).toBe("new");
    expect(stageToStatus("diagnostics", null, null)).toBe("new");
    expect(stageToStatus("approval", null, null)).toBe("new");
  });

  it("пауза не змінює статус — «у роботі»", () => {
    expect(stageToStatus("in_progress", "paused", null)).toBe("in_progress");
  });

  it("відмова на будь-якому етапі — rejected", () => {
    expect(stageToStatus("approval", "refused", null)).toBe("rejected");
    expect(stageToStatus("ready", "refused", null)).toBe("rejected");
  });

  it("видано з накладною — відправлено, без неї — завершено", () => {
    expect(stageToStatus("issued", null, "20450012345678")).toBe("shipped");
    expect(stageToStatus("issued", null, null)).toBe("done");
  });
});

describe("statusToStage — перенесення старих заявок", () => {
  it("кожен старий статус має етап, і назад перекладається так само", () => {
    for (const s of ["new", "in_progress", "ready", "done", "rejected"] as const) {
      const { stage, flag } = statusToStage(s);
      expect(stageToStatus(stage, flag, null)).toBe(s);
    }
    const shipped = statusToStage("shipped");
    expect(stageToStatus(shipped.stage, shipped.flag, "204500")).toBe("shipped");
  });
});

describe("guessLocation", () => {
  const emails = { novyiRozdil: "bohdan@x.ua", lviv: "andrian@x.ua" };

  it("за майстром: Богдан — Новий Розділ, Андріан — Львів", () => {
    expect(guessLocation({ assignee: "Bohdan@X.ua" }, emails)).toBe("novyi-rozdil");
    expect(guessLocation({ assignee: "andrian@x.ua" }, emails)).toBe("lviv");
  });

  it("ніхто не брав — невідомо, а не вигадана точка", () => {
    expect(guessLocation({ assignee: null }, emails)).toBeNull();
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const past = new Date("2026-11-16T12:00:00Z");

  it("термін минув і не видано — прострочено", () => {
    expect(isOverdue({ dueAt: past, stage: "in_progress", flag: null }, now)).toBe(true);
  });

  it("видано, відмова або без терміну — не прострочено", () => {
    expect(isOverdue({ dueAt: past, stage: "issued", flag: null }, now)).toBe(false);
    expect(isOverdue({ dueAt: past, stage: "approval", flag: "refused" }, now)).toBe(false);
    expect(isOverdue({ dueAt: null, stage: "new", flag: null }, now)).toBe(false);
  });
});

describe("orderLabel", () => {
  it("свої — №, «Онлайн» — О-", () => {
    expect(orderLabel({ channel: "own", orderNo: 1092, onlineNo: null })).toBe("№1092");
    expect(orderLabel({ channel: "online", orderNo: 1100, onlineNo: 218 })).toBe("О-218");
  });
});
