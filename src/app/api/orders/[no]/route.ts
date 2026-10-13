import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getEvents } from "@/db/events";
import { describeStatus, STAGES } from "@/db/leads";
import { leads } from "@/db/schema";
import { clientIp, rateLimit, release } from "@/lib/rateLimit";
import { digits, lastFour } from "@/lib/phone";
import { connectLink } from "@/lib/clientBot";

export const dynamic = "force-dynamic";

export type Order = {
  no: string;
  device: string;
  work: string;
  stage: number;
  stages: string[];
  eta: string;
  log: { time: string; text: string }[];
  /** Посилання на бота зі статусами; null — бот не налаштований */
  telegram: string | null;
};

/** Одна відповідь на «не знайшли» і на «не той телефон» — щоб номери не можна було перебрати */
const NOT_FOUND = "Не знайшли замовлення з таким номером і телефоном.";

const formatTime = (d: Date) =>
  d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });

/** Найбільший номер, який уміщається в колонку order_no (int4) */
const MAX_ORDER_NO = 2147483647;

export async function GET(request: Request, { params }: { params: Promise<{ no: string }> }) {
  // Перебір номерів замовлень — теж форма атаки
  const limit = await rateLimit(`order:ip:${clientIp(request)}`, 20, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Забагато запитів. Спробуйте пізніше." }, { status: 429 });
  }

  const { no } = await params;
  const clean = no.trim();

  if (!/^\d{1,10}$/.test(clean)) {
    return NextResponse.json({ error: "Номер замовлення — лише цифри з квитанції" }, { status: 400 });
  }

  // Номер сам по собі не таємниця, тож без другого поля статус не віддаємо
  const check = digits(new URL(request.url).searchParams.get("phone") ?? "");
  if (check.length !== 4) {
    return NextResponse.json(
      { error: "Впишіть останні 4 цифри телефону, який лишали при зверненні." },
      { status: 400 },
    );
  }

  // Такого номера в базі бути не може, а Postgres на ньому впав би з помилкою
  const orderNo = Number(clean);
  if (orderNo > MAX_ORDER_NO) {
    return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
  }

  // 4 цифри — це 10 000 варіантів, і з різних адрес їх можна перебрати.
  // Тому рахуємо ще й спроби на саме замовлення: 10 невдалих за годину.
  // Місце займаємо до перевірки, інакше вгаданий код пройшов би й понад межу
  const tries = `order:no:${orderNo}`;
  if (!(await rateLimit(tries, 10, 60 * 60_000)).ok) {
    return NextResponse.json(
      { error: "Забагато спроб для цього замовлення. Спробуйте за годину або зателефонуйте нам." },
      { status: 429 },
    );
  }

  const [lead] = await getDb()
    .select()
    .from(leads)
    .where(eq(leads.orderNo, orderNo))
    .limit(1);

  if (!lead || lastFour(lead.phone) !== check) {
    return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
  }

  // Правильні цифри — це не спроба підбору: лічильник замовлення обнуляємо
  await release(tries);

  const info = describeStatus(lead.status);
  const events = await getEvents(lead.id);

  return NextResponse.json({
    no: String(lead.orderNo),
    device: lead.model || "Ваш пристрій",
    work: lead.service || lead.problem || "Ремонт",
    stage: info.stage,
    stages: [...STAGES],
    eta: info.hint,
    log: events.map((e) => ({ time: formatTime(e.createdAt), text: e.text })),
    telegram: connectLink(lead),
  } satisfies Order);
}
