import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { addMessage, getMessages, markRead, MAX_MESSAGE } from "@/db/messages";
import { getLeadBrief } from "@/db/leads";
import { canUseChat, type ChatSide } from "@/lib/chatAccess";
import { esc } from "@/lib/telegram";
import { alertMasters } from "@/lib/notify";
import { leadLink } from "@/lib/adminLinks";
import { siteUrl } from "@/lib/siteUrl";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { forwardMasterMessage } from "@/lib/clientBot";

export const dynamic = "force-dynamic";

/** id у базі — UUID: будь-що інше Postgres відкинув би помилкою, а це просто «не знайдено» */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Фото стискається на клієнті, тож більше сюди приходити не має */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export type ChatMessage = {
  id: string;
  author: "client" | "master";
  text: string;
  at: string;
  image: { url: string; width: number | null; height: number | null } | null;
};

/** Бік приходить від сторінки; невідоме значення вважаємо клієнтським */
function sideFrom(value: string | null): ChatSide {
  return value === "master" ? "master" : "client";
}

export async function GET(request: Request, { params }: { params: Promise<{ lead: string }> }) {
  const { lead } = await params;
  if (!UUID.test(lead)) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });
  const role = sideFrom(new URL(request.url).searchParams.get("side"));

  if (!(await canUseChat(lead, role))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const messages = await getMessages(lead);
  // Відкрили чат — усе від іншого боку вважаємо прочитаним
  await markRead(lead, role);

  return NextResponse.json({
    role,
    messages: messages.map(
      (m): ChatMessage => ({
        id: m.id,
        author: m.author,
        text: m.text,
        at: m.createdAt.toISOString(),
        // Приватний файл віддаємо своїм маршрутом — там та сама перевірка прав
        image: m.imagePath
          ? { url: `/api/chat/${lead}/image/${m.id}`, width: m.imageWidth, height: m.imageHeight }
          : null,
      }),
    ),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ lead: string }> }) {
  const { lead } = await params;
  if (!UUID.test(lead)) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  const limit = await rateLimit(`chat:ip:${clientIp(request)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Забагато повідомлень. Трохи зачекайте." }, { status: 429 });
  }

  const role = sideFrom(new URL(request.url).searchParams.get("side"));
  if (!(await canUseChat(lead, role))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });

  const text = String(form.get("text") ?? "").trim();
  const file = form.get("image");

  if (text.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Задовге повідомлення — максимум ${MAX_MESSAGE} символів.` },
      { status: 400 },
    );
  }

  let imagePath: string | null = null;
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Можна надсилати лише фото." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Фото завелике — спробуйте інше." }, { status: 400 });
    }

    // Приватне сховище: файл не відкривається за прямим посиланням
    const blob = await put(`chat/${lead}/${crypto.randomUUID()}`, file, {
      access: "private",
      contentType: file.type,
    });

    imagePath = blob.pathname;
    imageWidth = Number(form.get("width")) || null;
    imageHeight = Number(form.get("height")) || null;
  }

  if (!text && !imagePath) {
    return NextResponse.json({ error: "Повідомлення порожнє" }, { status: 400 });
  }

  await addMessage(lead, role, { text, imagePath, imageWidth, imageHeight });

  // Пише клієнт — майстер має дізнатись одразу. Свої ж повідомлення
  // сповіщати назад не потрібно.
  if (role === "client") {
    const brief = await getLeadBrief(lead);
    const who = brief ? `№${brief.orderNo} · ${esc(brief.name)}` : "заявка";
    const body = text ? esc(text) : "надіслав фото";

    await alertMasters(
      {
        title: brief ? `№${brief.orderNo} · ${brief.name} пише` : "Повідомлення від клієнта",
        body: text ? text.slice(0, 160) : "Надіслав фото",
        url: brief ? leadLink(brief.orderNo, lead) : "/admin",
        tag: `chat-${lead}`,
      },
      `<b>Повідомлення від клієнта</b>\n${who}\n\n${body}\n\n${siteUrl()}/admin/zayavky`,
    );
  }

  // Пише майстер — клієнт із підключеним ботом отримує відповідь у Telegram
  if (role === "master") await forwardMasterMessage(lead, text, imagePath && file instanceof File ? file : null);

  return NextResponse.json({ ok: true });
}
