import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getMessage } from "@/db/messages";
import { canUseChat } from "@/lib/chatAccess";

export const dynamic = "force-dynamic";

/** id у базі — UUID: будь-що інше Postgres відкинув би помилкою, а це просто «не знайдено» */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Віддає фото з приватного сховища.
 *
 * Прямого посилання на приватний файл не існує — його не відкрити, навіть маючи
 * адресу. Тому кожен показ проходить через нас із тією самою перевіркою прав,
 * що й читання чату, а вміст читаємо через get({ access: "private" }).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lead: string; msg: string }> },
) {
  const { lead, msg } = await params;
  if (!UUID.test(lead) || !UUID.test(msg)) return new NextResponse("Не знайдено", { status: 404 });

  // Фото бачить будь-хто, хто має доступ до чату з одного з боків
  const allowed =
    (await canUseChat(lead, "client")) || (await canUseChat(lead, "master"));
  if (!allowed) return new NextResponse("Немає доступу", { status: 403 });

  const message = await getMessage(msg);
  // Звіряємо, що повідомлення саме з цієї заявки: інакше доступ до однієї
  // заявки відкривав би фото з будь-якої іншої за відомим id
  if (!message || message.leadId !== lead || !message.imagePath) {
    return new NextResponse("Не знайдено", { status: 404 });
  }

  const file = await get(message.imagePath, { access: "private" }).catch(() => null);
  if (!file || file.statusCode !== 200 || !file.stream) {
    return new NextResponse("Не знайдено", { status: 404 });
  }

  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.blob.contentType ?? "image/jpeg",
      // Приватне фото: кеш лише у браузері того, хто має доступ
      "Cache-Control": "private, max-age=3600",
    },
  });
}
