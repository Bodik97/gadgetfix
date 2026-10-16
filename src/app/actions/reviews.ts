"use server";

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { getReviewByUser } from "@/db/reviews";
import { getClientLeads } from "@/db/leads";
import { readPair, savePhoto } from "@/lib/photoPair";
import { alertMasters } from "@/lib/notify";
import { esc } from "@/lib/telegram";

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Чи лишав уже відгук клієнт, який зараз увійшов. Форма питає це після входу —
 * так головна не читає сесію на сервері й лишається статичною.
 */
export async function hasLeftReview(): Promise<boolean> {
  const { userId } = await auth();
  return userId ? Boolean(await getReviewByUser(userId)) : false;
}

/** Відгук лишає лише авторизований клієнт і лише один раз */
export async function submitReview(_prev: ReviewResult | null, formData: FormData): Promise<ReviewResult> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "Щоб лишити відгук, увійдіть у свій акаунт." };
  }

  const text = String(formData.get("text") ?? "").trim();
  const device = String(formData.get("device") ?? "").trim();
  const rating = Number(formData.get("rating") ?? 0);

  if (text.length < 20) {
    return { ok: false, error: "Напишіть хоча б кілька слів — так відгук буде корисним іншим." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Оберіть оцінку від 1 до 5." };
  }

  // Фото необовʼязкові: без них відгук приймаємо, лише знижки за нього не буде
  const pair = readPair(formData, false);
  if (typeof pair === "string") return { ok: false, error: pair };

  const existing = await getReviewByUser(user.id);
  if (existing) {
    return { ok: false, error: "Ви вже лишали відгук. Дякуємо!" };
  }

  const email = user.primaryEmailAddress;
  const verified = email?.verification?.status === "verified";
  const isGmail = /@(gmail\.com|googlemail\.com)$/i.test(email?.emailAddress ?? "");

  // Відгук лишають лише з підтвердженою поштою — інакше це не «живий» клієнт
  if (!verified) {
    return { ok: false, error: "Спершу підтвердіть пошту — це захищає відгуки від накруток." };
  }

  // Знижка — лише тим, хто справді ремонтувався через сайт: майстер видав пристрій
  // або клієнт сам підтвердив у кабінеті, що отримав його
  const repairs = await getClientLeads(user.id, email?.emailAddress);
  const repair = repairs.find((l) => l.status === "done" || l.receivedAt);

  const [beforePath, afterPath] = await Promise.all([
    pair.before ? savePhoto("reviews", pair.before) : null,
    pair.after ? savePhoto("reviews", pair.after) : null,
  ]);

  await getDb().insert(reviews).values({
    clerkUserId: user.id,
    authorName: user.firstName?.trim() || "Клієнт",
    device: device ? device.slice(0, 60) : null,
    rating,
    text: text.slice(0, 1000),
    viaGoogle: isGmail,
    // hasImage відрізняє справжнє фото від згенерованих Clerk ініціалів
    avatarUrl: user.hasImage ? user.imageUrl : null,
    beforePath,
    afterPath,
    leadId: repair?.id ?? null,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/moi-remonty");

  // Новий відгук чекає модерації — без сигналу він пролежав би непоміченим
  const author = user.firstName?.trim() || "Клієнт";
  await alertMasters(
    {
      title: `Новий відгук ${"★".repeat(rating)}`,
      body: `${author}: ${text.slice(0, 140)}`,
      url: "/admin/vidhuky",
      tag: "review",
    },
    `<b>Новий відгук ${"★".repeat(rating)}</b>\n${esc(author)}: ${esc(text.slice(0, 300))}`,
  );

  return { ok: true };
}
