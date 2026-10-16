import "server-only";

import { del, get, put } from "@vercel/blob";
import { NextResponse } from "next/server";

/** Ті самі формати, що й у чаті: SVG та інше «image/*» у сховище не пускаємо */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 6 * 1024 * 1024;

/** Файл, якщо його справді вклали в форму. Порожнє поле — null. */
function fileOf(form: FormData, key: string): File | null {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * Пара фото «до» і «після» з форми. Повертає файли або текст помилки.
 * required — обидва фото обовʼязкові.
 */
export function readPair(
  form: FormData,
  required: boolean,
): { before: File | null; after: File | null } | string {
  const before = fileOf(form, "before");
  const after = fileOf(form, "after");

  if (required && (!before || !after)) return "Додайте обидва фото — до і після ремонту.";
  for (const file of [before, after]) {
    if (file && !PHOTO_TYPES.includes(file.type)) return "Можна додавати лише фото.";
    if (file && file.size > MAX_BYTES) return "Фото завелике.";
  }
  return { before, after };
}

/** Кладе фото в приватне сховище й повертає шлях до нього */
export async function savePhoto(folder: string, file: File): Promise<string> {
  const blob = await put(`${folder}/${crypto.randomUUID()}`, file, {
    access: "private",
    contentType: file.type,
  });
  return blob.pathname;
}

/** Прибирає фото зі сховища. Збій тут не має зупиняти видалення запису з бази. */
export async function dropPhotos(paths: (string | null)[]): Promise<void> {
  for (const path of paths) {
    if (path) await del(path).catch((e) => console.error("[dropPhotos] фото не прибралось:", path, e));
  }
}

/**
 * Віддає фото з приватного сховища — сайт показує його своїм маршрутом.
 * shared=false — фото ще не публічне (бачить лише майстер), кешувати не можна.
 */
export async function servePhoto(path: string | null, shared = true): Promise<NextResponse> {
  const file = path ? await get(path, { access: "private" }).catch(() => null) : null;
  if (!file || file.statusCode !== 200 || !file.stream) {
    return new NextResponse("Не знайдено", { status: 404 });
  }

  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.blob.contentType ?? "image/jpeg",
      "Cache-Control": shared ? "public, max-age=86400" : "private, no-store",
    },
  });
}
