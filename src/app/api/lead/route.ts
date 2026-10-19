import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { start } from "workflow/api";
import { esc, notifyMaster } from "@/lib/telegram";
import { alertMasters } from "@/lib/notify";
import { leadLink } from "@/lib/adminLinks";
import { escalateLead } from "@/workflows/escalate-lead";
import { siteUrl } from "@/lib/siteUrl";
import { connectLink } from "@/lib/clientBot";
import { normalizeUaPhone } from "@/lib/phone";
import { LIMITS, plainText, validName } from "@/lib/validate";
import { verifiedEmail } from "@/lib/verifiedEmail";
import { getClientLeads } from "@/db/leads";
import { getReviewsByUser } from "@/db/reviews";
import { claimDiscount, discountOffer, type DiscountOffer } from "@/db/discounts";
import { DISCOUNT_PERCENT, DISCOUNT_REASON, type DiscountKind } from "@/data/discounts";

const SOURCES = ["landing", "model", "services", "mail-in"] as const;
type Source = (typeof SOURCES)[number];

export type Lead = {
  name: string;
  phone?: string;
  /** Заповнюється, коли заявку лишає авторизований клієнт із кабінету */
  email?: string;
  problem?: string;
  model?: string;
  service?: string;
  city?: string;
  branch?: string;
  source: Source;
  /** Клієнт натиснув «Скористатись знижкою 5%» — сервер ще перевірить, чи вона йому належить */
  useDiscount?: boolean;
};

function telegramText(lead: Lead, orderNo?: number, discount?: DiscountKind | null): string {
  const title = orderNo ? `<b>Нова заявка №${orderNo}</b>` : "<b>Нова заявка</b>";
  // Знижку — одразу під заголовком, щоб майстер назвав ціну вже з нею
  const head = discount
    ? `${title}\n🏷 <b>ЗНИЖКА −${DISCOUNT_PERCENT[discount]}% ${DISCOUNT_REASON[discount]}</b> — назвіть ціну вже зі знижкою`
    : title;

  const rows: [string, string | undefined][] = [
    ["Ім'я", lead.name],
    ["Телефон", lead.phone],
    ["Пошта", lead.email],
    ["Модель", lead.model],
    ["Послуга", lead.service],
    ["Місто", lead.city],
    ["Відділення", lead.branch],
    ["Проблема", lead.problem],
  ];

  const body = rows
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${esc(v)}`)
    .join("\n");

  return `${head}\n${body}\n\n${siteUrl()}/admin/zayavky`;
}

/**
 * Текстове поле з форми: без спецсимволів і не довше за ліміт. Порожній
 * рядок у базі не потрібен — краще NULL.
 */
const clean = (v: unknown, max: number = LIMITS.short, multiline = false) => {
  const s = typeof v === "string" ? plainText(v, max, multiline).trim() : "";
  return s.length > 0 ? s : null;
};

export async function POST(request: Request) {
  // Не більше 5 заявок за 10 хвилин з однієї адреси
  const limit = await rateLimit(`lead:ip:${clientIp(request)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Забагато заявок поспіль. Спробуйте за кілька хвилин або зателефонуйте нам." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let lead: Lead;
  try {
    lead = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
  }

  // Якщо клієнт залогінений — прив'язуємо заявку до його акаунта,
  // щоб вона з'явилась у кабінеті. Пошту в такому разі беремо з профілю.
  const { userId } = await auth();
  const profile = userId ? await currentUser() : null;
  const profileEmail = verifiedEmail(profile);

  // Потрібне ім'я і хоча б один спосіб зв'язку. З кабінету при email-вході
  // телефону може не бути взагалі — тоді вистачає пошти.
  // Пошта — лише з профілю: за нею заявка потрапляє в кабінет, тож пошту з
  // тіла запиту не беремо — інакше заявку можна підкинути в чужий кабінет
  // Тіло приходить ззовні — поле не рядком вважаємо відсутнім, а не падаємо в 500
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  // Телефон — лише справжній український номер; у базу йде в одному вигляді
  const phone = normalizeUaPhone(str(lead?.phone));
  const hasPhone = phone !== null;

  // Імʼя — лише літери. Із кабінету воно приходить із профілю, а не з поля
  // форми: якщо там не імʼя (скажімо, пошта), заявку не відхиляємо
  const name = validName(str(lead?.name)) ? str(lead?.name).trim() : userId ? "Клієнт" : null;

  if (!name) {
    return NextResponse.json({ error: "Імʼя — лише літери, від 2 до 50" }, { status: 422 });
  }
  if (!hasPhone && !profileEmail) {
    return NextResponse.json({ error: "Потрібен телефон у форматі +380… або пошта" }, { status: 422 });
  }

  const source: Source = SOURCES.includes(lead.source) ? lead.source : "landing";

  // Знижку рахуємо до вставки: інакше нова заявка вже «з'їла» б перший ремонт
  let offer: DiscountOffer = null;
  if (userId) {
    const [repairs, written] = await Promise.all([getClientLeads(userId, profileEmail), getReviewsByUser(userId)]);
    offer = discountOffer(repairs, written);
  }

  let orderNo: number | undefined;
  let leadId: string | undefined;
  let discount: DiscountKind | null = null;

  try {
    const [row] = await getDb()
      .insert(leads)
      .values({
        name,
        phone,
        email: profileEmail,
        model: clean(lead.model),
        service: clean(lead.service),
        problem: clean(lead.problem, LIMITS.problem, true),
        city: clean(lead.city, LIMITS.place.max),
        branch: clean(lead.branch, LIMITS.place.max),
        clerkUserId: userId ?? null,
        source,
      })
      .returning({ id: leads.id, orderNo: leads.orderNo });

    orderNo = row?.orderNo;
    leadId = row?.id;
  } catch (e) {
    // Заявку втрачати не можна: лишаємо слід у логах і пробуємо сповістити майстра
    console.error("[lead] не вдалося записати в базу:", e);
    try {
      await notifyMaster(telegramText({ ...lead, email: profileEmail ?? undefined }));
    } catch {}
    return NextResponse.json({ error: "Не вдалося зберегти заявку" }, { status: 500 });
  }

  // Заявка вже збережена — збій зі знижкою не має її губити, майстер побачить заявку без мітки
  if (leadId && offer) {
    try {
      discount = await claimDiscount(leadId, offer, lead.useDiscount === true);
    } catch (e) {
      console.error("[lead] знижку не закріплено:", e);
    }
  }

  // Сповіщаємо про кожну заявку, не лише анонімну: заявка о 21:00 інакше
  // пролежить до ранку, бо майстер не тримає адмінку відкритою.
  // Push на телефони; ніхто не прийняв — Telegram, як раніше.
  if (orderNo !== undefined && leadId) {
    const what = [lead.model, lead.service].map((v) => clean(v)).find(Boolean);
    await alertMasters(
      {
        title: discount ? `Нова заявка №${orderNo} · −${DISCOUNT_PERCENT[discount]}%` : `Нова заявка №${orderNo}`,
        body: [name, what, phone].filter(Boolean).join(" · "),
        url: leadLink(orderNo, leadId),
        tag: `lead-${leadId}`,
      },
      telegramText({ ...lead, name, phone: phone ?? undefined, email: profileEmail ?? undefined }, orderNo, discount),
    );

    // Нагадування, доки заявку не візьмуть. Збій тут не має зачіпати клієнта:
    // заявка вже збережена, майстри вже сповіщені.
    try {
      await start(escalateLead, [leadId]);
    } catch (e) {
      console.error("[lead] ескалацію не запущено:", e);
    }
  }

  // Посилання на бота — форма покаже кнопку «Отримувати статус у Telegram».
  // Воно закріплює чат лише за цією заявкою: телефон у формі міг вписати будь-хто
  const telegram = leadId
    ? connectLink({ id: leadId })
    : null;

  return NextResponse.json({ ok: true, telegram, orderNo: orderNo ?? null, discount });
}
