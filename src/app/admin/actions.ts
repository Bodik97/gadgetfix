"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { del, put } from "@vercel/blob";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { devices, leadMessages, leads, pushSubscriptions, reviews, works, type Lead } from "@/db/schema";
import { STATUS_OPTIONS } from "@/db/leads";
import { guessWarrantyDays, isWarrantyTerm, warrantyEnd } from "@/data/warranty";
import { addEvent, getHandoverDate, getLeadById, registerDevice } from "@/db/events";
import { addExpense, EXPENSE_CATEGORIES, removeExpense } from "@/db/expenses";
import { addPart, removePart, shiftPartQty } from "@/db/parts";
import { rateLimit, release } from "@/lib/rateLimit";
import { sendPush } from "@/lib/push";
import { notifyClientStatus, offerPrice } from "@/lib/clientBot";
import { closeOrder } from "@/lib/handover";
import { normalizeUaPhone } from "@/lib/phone";
import { dropPhotos, readPair, savePhoto } from "@/lib/photoPair";
import { LIMITS, plainText, validName } from "@/lib/validate";
import { start } from "workflow/api";
import { watchParcel } from "@/workflows/watch-parcel";
import { checkCredentials, createSession, currentAdmin, destroySession, isAdmin } from "@/lib/admin";

/** Адреса, з якої прийшов запит — за нею теж рахуємо спроби входу */
async function clientAddress(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Межі входу. Спроби на пошту рахуємо окремо для кожної адреси: якби лічильник
 * був один на пошту, будь-хто, знаючи її, пʼятьма хибними паролями зачиняв би
 * майстра з його власного телефона. Загальна межа на адресу лишається —
 * вона може бути спільна у двох майстрів, тому вища.
 */
const LOGIN_WINDOW = 15 * 60_000;
const BY_EMAIL = 5;
const BY_IP = 15;

/**
 * Стеля на пошту з усіх адрес разом: без неї перебір з багатьох IP не мав межі.
 * Висока й на годину — щоб чужий не зачинив майстра кількома хибними паролями,
 * а розподілений перебір упирався в 60 спроб на годину.
 */
const EMAIL_WINDOW = 60 * 60_000;
const BY_EMAIL_TOTAL = 60;

/** 900 → «15 хв», 90 → «2 хв»: точні секунди тут нікому не потрібні */
function waitLabel(sec: number): string {
  const min = Math.ceil(sec / 60);
  return min <= 1 ? "хвилину" : `${min} хв`;
}

export async function signIn(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = await clientAddress();

  // Межу перевіряємо ДО пароля: інакше сама перевірка стає тим, що перебирають
  const emailKey = `login:email:${email}:${ip}`;
  const byEmail = await rateLimit(emailKey, BY_EMAIL, LOGIN_WINDOW);
  if (!byEmail.ok) return `Забагато спроб входу. Спробуйте за ${waitLabel(byEmail.retryAfter)}.`;

  const byIp = await rateLimit(`login:ip:${ip}`, BY_IP, LOGIN_WINDOW);
  if (!byIp.ok) return `Забагато спроб входу. Спробуйте за ${waitLabel(byIp.retryAfter)}.`;

  const byEmailTotal = await rateLimit(`login:email:${email}`, BY_EMAIL_TOTAL, EMAIL_WINDOW);
  if (!byEmailTotal.ok) return `Забагато спроб входу. Спробуйте за ${waitLabel(byEmailTotal.retryAfter)}.`;

  let master: number | null = null;
  try {
    master = checkCredentials(email, password);
  } catch {
    return "Адмінка не налаштована: немає ADMIN_EMAIL, ADMIN_PASSWORD або ADMIN_SESSION_SECRET.";
  }

  if (master === null) {
    // Спробу вже списано в rateLimit — окремо записувати нічого.
    // Затримка лишається: вона нічого не варта проти паралельних спроб,
    // але робить послідовний перебір ще повільнішим
    await new Promise((r) => setTimeout(r, 700));
    return "Пошта або пароль не підходять.";
  }

  // Успіх знімає лічильник, щоб майстер не лишався заблокованим
  // через власні помилки перед вдалим входом
  await release(emailKey);
  await createSession(master);
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/admin/vhid");
}

export async function setStatus(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  const allowed = STATUS_OPTIONS.map((o) => o.value);
  if (!allowed.includes(status as (typeof allowed)[number])) return;

  const next = status as (typeof allowed)[number];

  const before = await getLeadById(id);
  // Заявку видалили, поки картка була відкрита, — міняти нічого
  if (!before) return;

  // «Відправлено» ставить лише збереження ТТН: без накладної клієнту нема що відстежувати
  if (next === "shipped" && !before.ttn) return;

  if (next === "done") {
    // Пристрій у клієнта — заявка закривається, і з цього дня рахується гарантія
    await closeOrder(before);
  } else {
    await getDb().update(leads).set({ status: next, updatedAt: new Date() }).where(eq(leads.id, id));

    // Хроніка: клієнт бачить, що саме сталося, а не лише підсвічену стадію
    await addEvent(id, { status: next });

    // Клієнт із підключеним ботом дізнається про новий етап одразу, у Telegram
    await notifyClientStatus({ ...before, status: next });
  }

  revalidatePath("/admin");
  revalidatePath("/moi-remonty");
}

/**
 * Строк гарантії для заявки. До видачі — просто запамʼятовуємо вибір;
 * після — перераховуємо дату від того самого дня видачі, щоб майстер міг
 * виправити помилку, не подарувавши й не забравши клієнту дні.
 *
 * День видачі беремо з хроніки (подія «done»): updatedAt зсуває кожна
 * пізніша правка, а дати кінця гарантії в заявки «без гарантії» немає.
 */
export async function setWarranty(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const days = Number(formData.get("days"));
  if (!id || !isWarrantyTerm(days)) return;

  const lead = await getLeadById(id);
  if (!lead) return;

  const handedOver = lead.status === "done";

  let warrantyUntil = lead.warrantyUntil;
  if (handedOver) {
    let from = await getHandoverDate(id);
    if (!from) {
      // Стара заявка без події в хроніці: кінець гарантії мінус попередній строк, а без дати — остання зміна
      const previous = lead.warrantyDays ?? guessWarrantyDays(lead.service ?? lead.problem);
      from = lead.warrantyUntil ? new Date(lead.warrantyUntil) : new Date(lead.updatedAt);
      if (lead.warrantyUntil) from.setDate(from.getDate() - previous);
    }

    warrantyUntil = warrantyEnd(from, days);
  }

  await getDb().update(leads).set({ warrantyDays: days, warrantyUntil, updatedAt: new Date() }).where(eq(leads.id, id));

  if (handedOver) {
    // Клієнт з акаунтом бачить гарантію в кабінеті з таблиці пристроїв — тримаємо її в лад
    if (warrantyUntil) {
      await getDb().update(devices).set({ warrantyUntil }).where(eq(devices.leadId, id));
      // Заявку закривали «без гарантії» — пристрою в списку ще не було
      await registerDevice({ ...lead, warrantyUntil });
    } else {
      // «Без гарантії»: у кабінеті не має лишатися стара дата
      await getDb().delete(devices).where(eq(devices.leadId, id));
    }
  }

  revalidatePath("/admin");
  revalidatePath("/moi-remonty");
}

/**
 * Майстер бере заявку собі — або відпускає її. Другий майстер бачить, хто
 * чим займається, і не дзвонить тому самому клієнту вдруге.
 *
 * У хроніку не пишемо: її бачить клієнт, а розподіл робіт — внутрішня справа.
 */
export async function setAssignee(formData: FormData): Promise<void> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const take = String(formData.get("take") ?? "") === "1";

  await getDb()
    .update(leads)
    .set({ assignee: take ? me.email : null, updatedAt: new Date() })
    .where(eq(leads.id, id));

  revalidatePath("/admin");
}

/**
 * Заявка, яку майстер заводить сам: клієнт подзвонив або приніс пристрій без
 * запису. Інакше такий ремонт не потрапляє ні в касу, ні в гарантію.
 *
 * Заявка одразу за тим, хто її створив. Якщо пристрій уже в сервісі — вона
 * «У роботі», інакше «Нова». Після збереження відкриваємо її розгорнутою,
 * щоб одразу надрукувати квитанцію.
 */
export async function createLead(_prev: string | null, formData: FormData): Promise<string | null> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");

  // Ті самі правила, що й у формах на сайті: майстер теж може помилитись клавішею
  const field = (key: string) => String(formData.get(key) ?? "");
  const name = field("name").trim();
  const phone = normalizeUaPhone(field("phone"));
  const model = plainText(field("model"), LIMITS.short).trim() || null;
  const problem = plainText(field("problem"), LIMITS.problem, true).trim() || null;
  const handedOver = formData.get("handedOver") === "on";

  if (!validName(name)) return "Впишіть імʼя клієнта — лише літери, від 2 до 50.";
  if (!phone) return "Впишіть телефон повністю: після +38 — десять цифр.";

  const [row] = await getDb()
    .insert(leads)
    .values({
      name,
      phone,
      model,
      problem,
      source: "manual",
      status: handedOver ? "in_progress" : "new",
      assignee: me.email,
    })
    .returning({ id: leads.id, orderNo: leads.orderNo });

  revalidatePath("/admin");
  redirect(`/admin/zayavky?q=${row.orderNo}&open=${row.id}`);
}

/** Підписка браузера на push — те, що віддає PushSubscription.toJSON() */
export type PushKeys = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * Майстер увімкнув сповіщення на цьому телефоні. Повторне ввімкнення на тому
 * ж пристрої оновлює запис (endpoint унікальний) — дублікатів немає.
 */
export async function savePushSubscription(sub: PushKeys, userAgent: string): Promise<void> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");

  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  // Endpoint видає браузер, і це завжди https-адреса push-сервісу
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return;

  await getDb()
    .insert(pushSubscriptions)
    .values({ adminEmail: me.email, endpoint, p256dh, auth, userAgent: String(userAgent ?? "").slice(0, 300) })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { adminEmail: me.email, p256dh, auth },
    });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");
  await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, String(endpoint ?? "")));
}

/** Перевірка з телефона: push лише на пристрої того, хто натиснув */
export async function sendTestPush(): Promise<number> {
  const me = await currentAdmin();
  if (!me) redirect("/admin/vhid");
  return sendPush({ title: "Сповіщення працюють", body: "Так виглядатиме нова заявка.", url: "/admin", tag: "test" }, [me.email]);
}

/** Майстер дописує подію в хроніку своїми словами */
export async function addNote(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!id || text.length < 3) return;

  await addEvent(id, { text, byMaster: true });

  revalidatePath("/admin");
  revalidatePath("/moi-remonty");
}

/** Статуси, з яких накладна переводить заявку у «Відправлено»; закрита заявка лишається закритою */
const SHIPPABLE: Lead["status"][] = ["new", "in_progress", "ready"];

/**
 * Майстер вписує накладну — незакрита заявка одразу стає «Відправлено».
 *
 * Та сама накладна вдруге (Enter у полі) нічого не робить. Виправлення номера
 * у вже відправленій заявці міняє лише номер: клієнту про відправку вже
 * писали. Стерта накладна повертає відправлену заявку в «Готово» —
 * «Відправлено» без ТТН не буває.
 */
export async function setTtn(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const ttn = String(formData.get("ttn") ?? "").trim().slice(0, 40) || null;
  if (!id) return;

  const before = await getLeadById(id);
  if (!before || before.ttn === ttn) return;

  // Статус міняємо умовою в самому запиті: якщо заявку щойно закрили з іншого
  // телефона, вона лишиться закритою
  const status = ttn
    ? sql<Lead["status"]>`case when ${inArray(leads.status, SHIPPABLE)} then 'shipped' else ${leads.status} end`
    : sql<Lead["status"]>`case when ${leads.status} = 'shipped' then 'ready' else ${leads.status} end`;

  await getDb().update(leads).set({ ttn, status, updatedAt: new Date() }).where(eq(leads.id, id));

  if (!ttn) {
    if (before.status === "shipped") await addEvent(id, { text: "Накладну скасовано — пристрій ще в сервісі", status: "ready" });
  } else {
    if (SHIPPABLE.includes(before.status)) {
      await addEvent(id, { text: `Відправлено Новою Поштою, накладна ${ttn}`, status: "shipped" });
      await notifyClientStatus({ ...before, ttn, status: "shipped" });
    }

    // Стежимо за посилкою: клієнт забрав — заявка закриється, почнеться гарантія.
    // За виправленим номером стеження запускаємо нове; старе зупиниться саме,
    // щойно побачить, що накладна вже інша. Закритій заявці стеження не потрібне.
    // Збій тут не має зачіпати майстра: накладна вже збережена
    if (SHIPPABLE.includes(before.status) || before.status === "shipped") {
      try {
        await start(watchParcel, [id, ttn]);
      } catch (e) {
        console.error("[ttn] стеження за посилкою не запущено:", e);
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath("/moi-remonty");
}

/** Схвалити або сховати відгук */
export async function setReviewPublished(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const publish = String(formData.get("publish") ?? "") === "1";
  if (!id) return;

  const [review] = await getDb().select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!review) return;

  // Знижка 15% — за схвалений відгук з обома фото від клієнта, що ремонтувався через сайт.
  // Нараховуємо раз: якщо відгук потім сховати, знижка в людини лишається.
  const earned = publish && !review.discountAt && review.leadId && review.beforePath && review.afterPath;

  await getDb()
    .update(reviews)
    .set({ published: publish, ...(earned ? { discountAt: new Date() } : {}) })
    .where(eq(reviews.id, id));

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/moi-remonty");
}

/**
 * Знижку 15% нараховує або скасовує сам майстер, перевіривши відгук. Потрібен акаунт
 * клієнта — знижка живе в ньому. Скасувати можна, лише поки її не використали.
 */
export async function setReviewDiscount(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const grant = String(formData.get("grant") ?? "") === "1";
  if (!id) return;

  await getDb()
    .update(reviews)
    .set({ discountAt: grant ? new Date() : null })
    .where(
      grant
        ? and(eq(reviews.id, id), isNotNull(reviews.clerkUserId), isNull(reviews.discountAt))
        : and(eq(reviews.id, id), isNull(reviews.discountLeadId)),
    );

  revalidatePath("/admin");
  revalidatePath("/moi-remonty");
}

/** Майстер врахував знижку за відгук у ціні цієї заявки */
export async function applyReviewDiscount(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const reviewId = String(formData.get("reviewId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  if (!reviewId || !leadId) return;

  // Лише нарахована й ще не використана: подвійний клік не перепише заявку
  const applied = await getDb()
    .update(reviews)
    .set({ discountLeadId: leadId })
    .where(and(eq(reviews.id, reviewId), isNotNull(reviews.discountAt), isNull(reviews.discountLeadId)))
    .returning({ id: reviews.id });

  if (applied.length > 0) await addEvent(leadId, { text: "Врахували знижку 15% за відгук." });

  revalidatePath("/admin");
  revalidatePath("/moi-remonty");
}

/** Видалити відгук назовсім */
export async function deleteReview(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [review] = await getDb().select().from(reviews).where(eq(reviews.id, id)).limit(1);

  // Фото лежать у сховищі окремо від бази; збій там не має лишати відгук невидаленим
  if (review) await dropPhotos([review.imagePath, review.beforePath, review.afterPath]);

  await getDb().delete(reviews).where(eq(reviews.id, id));

  revalidatePath("/admin");
  revalidatePath("/");

  // Видалили зі сторінки відгуку — її вже немає, повертаємо до списку
  if (formData.get("back")) redirect("/admin/vidhuky");
}

/**
 * Гривні з того, що ввів майстер.
 * undefined = поля у формі не було, значення не чіпаємо;
 * null = майстер очистив поле.
 */
function parseUah(form: FormData, key: string): number | null | undefined {
  if (!form.has(key)) return undefined;

  const text = String(form.get(key) ?? "").replace(/\s/g, "").replace(",", ".");
  if (!text) return null;

  const n = Math.round(Number(text));
  // Не число або дурниця на кшталт від'ємної суми — поле не чіпаємо
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return undefined;
  return n;
}

/** Відмітка-прапорець: «on» — поставили, інше — зняли, поля немає — не чіпаємо */
function parseMark(form: FormData, key: string): boolean | undefined {
  return form.has(key) ? form.get(key) === "on" : undefined;
}

/**
 * Погоджена ціна, собівартість деталі та відмітки про оплату.
 *
 * Пишемо лише ті поля, що прийшли у формі, — а форма шле тільки змінене.
 * Так картка, що довго стояла відкритою, не затирає своїми старими
 * значеннями правку другого майстра. Повертає текст помилки або null.
 */
export async function setMoney(formData: FormData): Promise<string | null> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return null;

  const price = parseUah(formData, "price");
  const partsCost = parseUah(formData, "partsCost");
  const prepayment = parseUah(formData, "prepayment");
  const prepaid = parseMark(formData, "prepaid");
  const paid = parseMark(formData, "paid");

  if ([price, partsCost, prepayment, prepaid, paid].every((v) => v === undefined)) return null;

  const [before] = await getDb().select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!before) return null;

  // Передоплата більша за ціну дала б у журналі каси відʼємну доплату при видачі
  const nextPrice = price === undefined ? before.price : price;
  const nextPrepayment = prepayment === undefined ? before.prepayment : prepayment;
  if (nextPrice !== null && nextPrepayment !== null && nextPrepayment > nextPrice) {
    return `Передоплата (${nextPrepayment} ₴) не може бути більшою за ціну (${nextPrice} ₴).`;
  }

  await getDb()
    .update(leads)
    .set({
      ...(price === undefined ? {} : { price }),
      ...(partsCost === undefined ? {} : { partsCost }),
      ...(prepayment === undefined ? {} : { prepayment }),
      // Дату ставимо раз: повторне збереження не має її зсувати
      ...(prepaid === undefined ? {} : { prepaidAt: prepaid ? (before.prepaidAt ?? new Date()) : null }),
      // Відмітку ставимо раз: повторне збереження не має зсувати дату оплати
      ...(paid === undefined ? {} : { paidAt: paid ? (before.paidAt ?? new Date()) : null }),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id));

  // Клієнт бачить ціну в кабінеті, тож про її появу пишемо в хроніку
  if (price !== undefined && price !== null && price !== before.price) {
    await addEvent(id, { text: `Погодили ціну ремонту: ${price} ₴` });

    // Клієнт із ботом погоджує ціну кнопкою — без дзвінка
    await offerPrice({ ...before, price });
  }

  // Передоплата — умова початку робіт, тож її надходження теж подія
  if (prepaid && !before.prepaidAt) {
    const sum = prepayment ?? before.prepayment;
    await addEvent(id, {
      text: sum ? `Отримали передоплату: ${sum} ₴. Беремо пристрій у роботу.` : "Отримали передоплату. Беремо пристрій у роботу.",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/moi-remonty");
  return null;
}

/** Ті самі формати фото, що й у чаті: SVG та інше «image/*» у сховище не пускаємо */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/** Відгук, який майстер заводить сам: людина лишила його усно або в месенджері */
export async function addReview(formData: FormData): Promise<string | null> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const authorName = String(formData.get("authorName") ?? "").trim().slice(0, 60);
  const text = String(formData.get("text") ?? "").trim().slice(0, 600);
  const device = String(formData.get("device") ?? "").trim().slice(0, 60) || null;
  const city = String(formData.get("city") ?? "").trim().slice(0, 60) || null;

  const rating = Number(formData.get("rating"));
  const safeRating = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 5;

  if (authorName.length < 2) return "Впишіть імʼя автора.";
  if (text.length < 10) return "Відгук закороткий — щонайменше 10 символів.";

  let imagePath: string | null = null;
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (!PHOTO_TYPES.includes(file.type)) return "Можна додавати лише фото.";
    if (file.size > 6 * 1024 * 1024) return "Фото завелике.";

    const blob = await put(`reviews/${crypto.randomUUID()}`, file, {
      access: "private",
      contentType: file.type,
    });
    imagePath = blob.pathname;
    imageWidth = Number(formData.get("width")) || null;
    imageHeight = Number(formData.get("height")) || null;
  }

  await getDb().insert(reviews).values({
    clerkUserId: null,
    authorName,
    device,
    city,
    rating: safeRating,
    text,
    byMaster: true,
    // Свій відгук майстер публікує одразу — модерувати себе немає сенсу
    published: true,
    imagePath,
    imageWidth,
    imageHeight,
  });

  revalidatePath("/admin/vidhuky");
  revalidatePath("/");
  return null;
}

/** Результат роботи для головної: фото до і після та короткий опис */
export async function addWork(formData: FormData): Promise<string | null> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const device = String(formData.get("device") ?? "").trim().slice(0, 60);
  const text = String(formData.get("text") ?? "").trim().slice(0, 300);

  if (device.length < 2) return "Впишіть модель пристрою.";
  if (text.length < 10) return "Опишіть ремонт хоча б одним реченням.";

  const pair = readPair(formData, true);
  if (typeof pair === "string") return pair;

  const [beforePath, afterPath] = await Promise.all([
    savePhoto("works", pair.before!),
    savePhoto("works", pair.after!),
  ]);

  await getDb().insert(works).values({ device, text, beforePath, afterPath });

  revalidatePath("/admin/roboty");
  revalidatePath("/");
  return null;
}

/** Прибрати роботу з сайту разом із фото */
export async function deleteWork(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [work] = await getDb().select().from(works).where(eq(works.id, id)).limit(1);
  if (!work) return;

  await dropPhotos([work.beforePath, work.afterPath]);
  await getDb().delete(works).where(eq(works.id, id));

  revalidatePath("/admin/roboty");
  revalidatePath("/");
}

/** Записати витрату: оренду, рекламу, інструмент — усе, що не деталь конкретного ремонту */
export async function createExpense(formData: FormData): Promise<string | null> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const amount = Math.round(Number(String(formData.get("amount") ?? "").replace(/\s/g, "")));
  if (!Number.isFinite(amount) || amount <= 0) return "Вкажіть суму більшу за нуль.";

  const raw = String(formData.get("category") ?? "other");
  const category = EXPENSE_CATEGORIES.some((c) => c.value === raw)
    ? (raw as (typeof EXPENSE_CATEGORIES)[number]["value"])
    : "other";

  // Дата з поля типу date приходить як «2026-09-15»; порожню замінюємо на сьогодні
  const day = String(formData.get("spentAt") ?? "");
  const spentAt = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00`) : new Date();

  const note = String(formData.get("note") ?? "").trim().slice(0, 300);

  await addExpense({ amount, category, note: note || null, spentAt });

  revalidatePath("/admin/groshi");
  revalidatePath("/admin");
  return null;
}

export async function deleteExpense(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await removeExpense(id);

  revalidatePath("/admin/groshi");
  revalidatePath("/admin");
}

/** Нова позиція на складі */
export async function createPart(formData: FormData): Promise<string | null> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return "Вкажіть, що це за деталь.";

  const num = (key: string) => {
    const n = Math.round(Number(String(formData.get(key) ?? "").replace(/\s/g, "")));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  await addPart({
    name,
    model: String(formData.get("model") ?? "").trim().slice(0, 120) || null,
    qty: num("qty") ?? 0,
    unitCost: num("unitCost"),
    minQty: num("minQty") ?? 1,
  });

  revalidatePath("/admin/sklad");
  return null;
}

/** ±1 до залишку: поставили деталь у телефон або привезли партію */
export async function shiftPart(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  const delta = Number(formData.get("delta"));
  if (!id || !Number.isFinite(delta) || delta === 0) return;

  await shiftPartQty(id, Math.trunc(delta));

  revalidatePath("/admin/sklad");
}

export async function deletePart(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await removePart(id);

  revalidatePath("/admin/sklad");
}

/**
 * Видалити заявку назовсім — на вимогу клієнта.
 *
 * Закон дає людині право забрати свої дані, і без цієї дії обіцянка на
 * сторінці про персональні дані була б порожньою. Разом із заявкою
 * зникають листування (за звʼязком у базі) і фото зі сховища — їх треба
 * прибирати окремо, бо каскад до сховища не дотягується.
 */
export async function deleteLead(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const photos = await getDb()
    .select({ path: leadMessages.imagePath })
    .from(leadMessages)
    .where(eq(leadMessages.leadId, id));

  for (const { path } of photos) {
    if (!path) continue;
    // Одне невдале фото не має лишати заявку невидаленою
    await del(path).catch((e) => console.error("[deleteLead] фото не прибралось:", path, e));
  }

  await getDb().delete(leads).where(eq(leads.id, id));

  revalidatePath("/admin/zayavky");
  revalidatePath("/admin");
}
