import { iphones } from "./models";

/** Як клієнти пишуть кирилицею → як у каталозі */
const WORDS: Record<string, string> = {
  айфон: "iphone",
  айфона: "iphone",
  iphon: "iphone",
  про: "pro",
  макс: "max",
  плюс: "plus",
  міні: "mini",
  мини: "mini",
  се: "se",
  х: "x",
  ікс: "x",
  хс: "xs",
  хр: "xr",
};

/** Слова, з яких може складатися назва iPhone і без самого «iPhone» */
const KNOWN = /^(iphone|apple|\d{1,2}|6s|x|xs|xr|se|pro|max|plus|mini|20(20|22))$/;

/**
 * Фото iPhone з каталогу за моделлю, яку клієнт вписав сам: «Iphone 13»,
 * «айфон 13 про макс», «iPhone 7+», «13 pro». Не впізнали — null.
 */
export function iphoneImage(device: string | null): string | null {
  if (!device) return null;
  const words = device
    .toLowerCase()
    .replace(/\+/g, " plus ")
    // «13pro», «11промакс» — число окремо від слова; «6s» лишаємо цілим
    .replace(/(\d)(?!s\b)([a-zа-яіїє])/g, "$1 $2")
    .split(/[^a-zа-яіїє0-9]+/)
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w);

  // Без «iPhone» беремо лише назву з самих номерів і приставок — «Xiaomi 13» не наш
  if (!words.includes("iphone") && !words.every((w) => KNOWN.test(w))) return null;

  const has = (w: string) => words.includes(w);
  const base = words.find((w) => /^(\d{1,2}|6s|x|xs|xr|se)$/.test(w));
  if (!base) return null;

  const byName = (name: string) => iphones.find((m) => m.name.toLowerCase() === name)?.image || null;

  if (base === "6" || base === "6s") return byName(`iphone ${base} / ${base} plus`);
  if (base === "se") {
    if (has("3") || has("2022")) return byName("iphone se 3");
    if (has("2") || has("2020")) return byName("iphone se 2");
    return null;
  }
  if (base === "xs") return byName(has("max") ? "iphone xs max" : "iphone xs");

  const suffix =
    has("pro") || has("max") ? (has("max") ? " pro max" : " pro") : has("plus") ? " plus" : has("mini") ? " mini" : "";
  // Неіснуюча комбінація («14 mini») — хоча б базова модель
  return byName(`iphone ${base}${suffix}`) ?? byName(`iphone ${base}`);
}

/**
 * iPhone, який клієнт згадав у самому тексті відгуку: «міняли батарею на айфон
 * 15 про, зробили швидко» → «айфон 15 про». Беремо слово «iPhone» і до трьох
 * слів після нього — до коми чи крапки. Не згадав — null.
 */
function mentionedIphone(text: string): string | null {
  // «айфону», «айфона» — будь-який відмінок зводимо до «iphone»
  const tail = text.match(/(?:iphone|iphon|айфон)[а-яіїє]*((?:[ \t]*[^\s,.!?;:()]+){1,3})/i)?.[1];
  return tail ? `iphone ${tail}` : null;
}

/**
 * Модель для відгуку: що клієнт вписав у поле «Модель», а якщо порожньо —
 * що згадав у тексті. name — назва з каталогу, коли модель упізнали за текстом.
 */
export function reviewDevice(device: string | null, text: string): { name: string | null; image: string | null } {
  if (device) return { name: device, image: iphoneImage(device) };
  const image = iphoneImage(mentionedIphone(text));
  return { name: image ? (iphones.find((m) => m.image === image)?.name ?? null) : null, image };
}
