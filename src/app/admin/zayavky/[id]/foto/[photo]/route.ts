import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leadPhotos, leadSignatures } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { servePhoto } from "@/lib/photoPair";

/**
 * Фото пристрою й підпис клієнта — з приватного сховища, лише майстру.
 * `photo` — id фото, або «sign-intake» / «sign-handover» для підпису.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; photo: string }> }) {
  if (!(await isAdmin())) return new Response("Немає доступу", { status: 403 });

  const { id, photo } = await ctx.params;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(id)) return new Response("Не знайдено", { status: 404 });

  if (photo === "sign-intake" || photo === "sign-handover") {
    const kind = photo === "sign-intake" ? "intake" : "handover";
    const [row] = await getDb()
      .select({ path: leadSignatures.path })
      .from(leadSignatures)
      .where(and(eq(leadSignatures.leadId, id), eq(leadSignatures.kind, kind)))
      .limit(1);
    return servePhoto(row?.path ?? null, false);
  }

  if (!uuid.test(photo)) return new Response("Не знайдено", { status: 404 });
  const [row] = await getDb()
    .select({ path: leadPhotos.path })
    .from(leadPhotos)
    .where(and(eq(leadPhotos.id, photo), eq(leadPhotos.leadId, id)))
    .limit(1);
  return servePhoto(row?.path ?? null, false);
}
