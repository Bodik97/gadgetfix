import { NextResponse } from "next/server";
import { setTyping } from "@/db/messages";
import { canUseChat } from "@/lib/chatAccess";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** «Я друкую» — поле вводу шле це не частіше ніж раз на кілька секунд */
export async function POST(request: Request, { params }: { params: Promise<{ lead: string }> }) {
  const { lead } = await params;
  if (!UUID.test(lead)) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  // Сигнал не важливий: забагато — просто ігноруємо, без помилки в інтерфейсі
  const limit = await rateLimit(`typing:ip:${clientIp(request)}`, 40, 60_000);
  if (!limit.ok) return NextResponse.json({ ok: false });

  const side = new URL(request.url).searchParams.get("side") === "master" ? "master" : "client";
  if (!(await canUseChat(lead, side))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  await setTyping(lead, side);
  return NextResponse.json({ ok: true });
}
