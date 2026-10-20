import { NextResponse } from "next/server";
import { setReaction } from "@/db/messages";
import { canUseChat } from "@/lib/chatAccess";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Реакція смайликом на повідомлення іншого боку; emoji: null — зняти */
export async function POST(request: Request, { params }: { params: Promise<{ lead: string }> }) {
  const { lead } = await params;
  if (!UUID.test(lead)) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  const limit = await rateLimit(`react:ip:${clientIp(request)}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Забагато. Трохи зачекайте." }, { status: 429 });

  const side = new URL(request.url).searchParams.get("side") === "master" ? "master" : "client";
  if (!(await canUseChat(lead, side))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown; emoji?: unknown } | null;
  const message = typeof body?.message === "string" && UUID.test(body.message) ? body.message : null;
  const emoji = typeof body?.emoji === "string" ? body.emoji : null;
  if (!message) return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });

  const ok = await setReaction(lead, message, side, emoji);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
