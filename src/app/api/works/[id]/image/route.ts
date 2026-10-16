import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { works } from "@/db/schema";
import { servePhoto } from "@/lib/photoPair";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Фото з блоку «Результати робіт»: ?v=before або ?v=after. Роботи публічні. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Не знайдено", { status: 404 });

  const [work] = await getDb().select().from(works).where(eq(works.id, id)).limit(1);
  if (!work) return new NextResponse("Не знайдено", { status: 404 });

  const v = new URL(req.url).searchParams.get("v");
  return servePhoto(v === "after" ? work.afterPath : work.beforePath);
}
