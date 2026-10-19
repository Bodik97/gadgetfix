import { describe, expect, it } from "vitest";
import { inBirthdayWindow } from "@/data/discounts";
import { discountOffer } from "@/db/discounts";
import type { Lead, Review } from "@/db/schema";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const lead = (over: Partial<Lead>) => ({ status: "done", discount: null, createdAt: at("2026-01-10"), ...over }) as Lead;
const review = (over: Partial<Review>) => ({ id: "r1", discountAt: null, discountLeadId: null, ...over }) as Review;

describe("знижка до дня народження: тиждень до і після", () => {
  it("у межах 7 днів — діє, далі — ні", () => {
    expect(inBirthdayWindow("1990-03-15", at("2026-03-15"))).toBe(true);
    expect(inBirthdayWindow("1990-03-15", at("2026-03-08"))).toBe(true);
    expect(inBirthdayWindow("1990-03-15", at("2026-03-22"))).toBe(true);
    expect(inBirthdayWindow("1990-03-15", at("2026-03-23"))).toBe(false);
    expect(inBirthdayWindow("1990-03-15", at("2026-03-07"))).toBe(false);
  });

  it("через Новий рік — теж", () => {
    expect(inBirthdayWindow("1990-01-02", at("2026-12-28"))).toBe(true);
    expect(inBirthdayWindow("1990-12-30", at("2027-01-04"))).toBe(true);
  });

  it("без дати чи з кривою датою — не діє", () => {
    expect(inBirthdayWindow(null, at("2026-03-15"))).toBe(false);
    expect(inBirthdayWindow("15.03.1990", at("2026-03-15"))).toBe(false);
  });
});

describe("яка знижка на нове замовлення", () => {
  const now = at("2026-03-15");

  it("новачок — 5% за реєстрацію", () => {
    expect(discountOffer([], [], null, now)).toEqual({ kind: "signup" });
  });

  it("день народження важливіший за відгук: відгук почекає", () => {
    const written = [review({ discountAt: at("2026-02-01") })];
    expect(discountOffer([lead({})], written, "1990-03-15", now)).toEqual({ kind: "birthday" });
    expect(discountOffer([lead({})], written, "1990-06-15", now)).toEqual({ kind: "review", reviewId: "r1" });
  });

  it("знижку до дня народження дають раз — друга заявка того ж тижня без неї", () => {
    const used = [lead({ discount: "birthday", status: "new", createdAt: at("2026-03-12") })];
    expect(discountOffer(used, [], "1990-03-15", now)).toBeNull();
  });

  it("відхилена заявка знижку до дня народження не забирає", () => {
    const rejected = [lead({ discount: "birthday", status: "rejected", createdAt: at("2026-03-12") })];
    expect(discountOffer(rejected, [], "1990-03-15", now)).toEqual({ kind: "birthday" });
  });

  it("уже ремонтувався, відгуку й свята немає — знижки немає", () => {
    expect(discountOffer([lead({})], [], null, now)).toBeNull();
  });
});
