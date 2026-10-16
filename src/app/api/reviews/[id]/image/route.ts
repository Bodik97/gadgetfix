import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { servePhoto } from "@/lib/photoPair";

export const dynamic = "force-dynamic";

/** id у базі — UUID: будь-що інше Postgres відкинув би помилкою, а це просто «не знайдено» */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Фото з відгуку: ?v=before і ?v=after — пара від клієнта, без параметра —
 * фото роботи, яке доклав майстер.
 *
 * Сховище приватне, тож файл віддаємо самі. Перевірки прав тут немає
 * навмисно: відгук публічний, і фото — його частина. Але показуємо лише для
 * опублікованих відгуків, щоб чернетка не витекла разом із посиланням.
 * Майстер бачить фото й до схвалення — інакше не було б що перевіряти.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Не знайдено", { status: 404 });

  const [review] = await getDb().select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!review || (!review.published && !(await isAdmin()))) {
    return new NextResponse("Не знайдено", { status: 404 });
  }

  const v = new URL(req.url).searchParams.get("v");
  const path = v === "before" ? review.beforePath : v === "after" ? review.afterPath : review.imagePath;
  return servePhoto(path, review.published);
}
