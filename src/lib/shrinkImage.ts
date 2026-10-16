/** Довша сторона після стиснення — деталь поломки на цьому видно добре */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export type Shrunk = { file: File; width: number; height: number; preview: string };

/**
 * Стискає фото просто в браузері перед надсиланням.
 *
 * Знімок із телефона — це 3–5 МБ, і з мобільного інтернету він їхав би довго.
 * Після стиснення виходить 200–400 КБ, а деталь поломки видно так само.
 */
export async function shrinkImage(file: File, maxSide = MAX_SIDE): Promise<Shrunk> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas недоступний");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("не вдалося стиснути");

  return {
    file: new File([blob], "photo.jpg", { type: "image/jpeg" }),
    width,
    height,
    preview: URL.createObjectURL(blob),
  };
}
