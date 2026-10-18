import "server-only";

import { clerkClient, type User } from "@clerk/nextjs/server";
import { and, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { getDevices } from "@/db/events";
import { getClientLeads } from "@/db/leads";
import { getReviewsByUser } from "@/db/reviews";
import { leads, reviews, type Device, type Lead, type Review } from "@/db/schema";

/**
 * Зареєстровані клієнти для адмінки. Самі акаунти живуть у Clerk, а заявки,
 * відгуки й гарантія — у нашій базі: звʼязок — clerkUserId, а для заявок, лишених
 * до реєстрації, ще й пошта (так само, як у кабінеті клієнта).
 */
export type Account = {
  id: string;
  name: string;
  email: string | null;
  createdAt: Date;
  lastSignInAt: Date | null;
  /** Як входить: Google або пошта з паролем */
  via: "google" | "password" | "code";
  repairs: number;
  paid: number;
  /** Остання дія: заявка або вхід — що пізніше */
  lastActiveAt: Date;
  hasDiscount: boolean;
};

export type AccountHistory = {
  account: Account;
  leads: Lead[];
  reviews: Review[];
  devices: Device[];
};

function nameOf(u: User): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return full || u.primaryEmailAddress?.emailAddress?.split("@")[0] || "Без імені";
}

function viaOf(u: User): Account["via"] {
  if (u.externalAccounts.some((a) => a.provider.includes("google"))) return "google";
  return u.passwordEnabled ? "password" : "code";
}

function toAccount(u: User, own: Lead[], discount: boolean): Account {
  const email = u.primaryEmailAddress?.emailAddress ?? null;
  const lastLead = own.reduce((t, l) => Math.max(t, l.createdAt.getTime()), 0);
  return {
    id: u.id,
    name: nameOf(u),
    email,
    createdAt: new Date(u.createdAt),
    lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt) : null,
    via: viaOf(u),
    repairs: own.length,
    paid: own.reduce((sum, l) => sum + (l.paidAt && l.price ? l.price : 0), 0),
    lastActiveAt: new Date(Math.max(lastLead, u.lastSignInAt ?? 0, u.createdAt)),
    hasDiscount: discount,
  };
}

/** Усі акаунти Clerk — сторінками по 100, щоб не загубити нікого за лімітом */
async function allUsers(): Promise<User[]> {
  const clerk = await clerkClient();
  const users: User[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await clerk.users.getUserList({ limit: 100, offset, orderBy: "-created_at" });
    users.push(...page.data);
    if (page.data.length < 100) return users;
  }
}

/** Список для вкладки «Зареєстровані»: свіжа активність — угорі */
export async function getAccounts(): Promise<Account[]> {
  const users = await allUsers();
  if (users.length === 0) return [];

  const ids = users.map((u) => u.id);
  const emails = users.map((u) => u.primaryEmailAddress?.emailAddress).filter((e): e is string => Boolean(e));

  // Одним запитом — заявки всіх акаунтів, і за акаунтом, і за поштою
  const [rows, discounts] = await Promise.all([
    getDb()
      .select()
      .from(leads)
      .where(emails.length ? or(inArray(leads.clerkUserId, ids), inArray(leads.email, emails)) : inArray(leads.clerkUserId, ids)),
    getDb()
      .select({ clerkUserId: reviews.clerkUserId })
      .from(reviews)
      .where(and(inArray(reviews.clerkUserId, ids), isNotNull(reviews.discountAt), isNull(reviews.discountLeadId))),
  ]);
  const withDiscount = new Set(discounts.map((d) => d.clerkUserId));

  return users
    .map((u) => {
      const email = u.primaryEmailAddress?.emailAddress;
      const own = rows.filter((l) => l.clerkUserId === u.id || (email && l.email === email));
      return toAccount(u, own, withDiscount.has(u.id));
    })
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
}

/** Історія одного клієнта. undefined — такого акаунта в Clerk немає */
export async function getAccountHistory(id: string): Promise<AccountHistory | undefined> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(id).catch(() => null);
  if (!user) return undefined;

  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const [own, myReviews, myDevices] = await Promise.all([
    getClientLeads(user.id, email),
    getReviewsByUser(user.id),
    getDevices(user.id),
  ]);
  const discount = myReviews.some((r) => r.discountAt && !r.discountLeadId);

  return { account: toAccount(user, own, discount), leads: own, reviews: myReviews, devices: myDevices };
}
