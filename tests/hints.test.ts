import { describe, expect, it } from "vitest";
import { HINTS } from "@/data/hints";

/** Підказка для кожного кроку картки існує — інакше «?» відкрив би порожнечу */
describe("HINTS", () => {
  it("є підказка для кожного кроку, і для «Онлайн» теж", () => {
    for (const k of ["step_new", "step_diagnostics", "step_approval", "step_in_progress", "step_ready", "step_new_online", "step_ready_online"]) {
      expect(HINTS[k as keyof typeof HINTS], k).toBeTruthy();
    }
  });

  it("підказки короткі — читаються з телефона за кілька секунд", () => {
    for (const [k, v] of Object.entries(HINTS)) expect(v.length, k).toBeLessThanOrEqual(260);
  });
});
