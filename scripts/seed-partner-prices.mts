// Стартовий прайс магазину «Онлайн» з docs/admin-handoff/HANDOFF.md (лише якщо прайс порожній).
// Запуск: npx dotenv -e .env.local -- tsx scripts/seed-partner-prices.mts
import { neon } from "@neondatabase/serverless";

const START: [model: string, work: string, price: number][] = [
  ["Redmi Note 8 Pro", "екран", 800],
  ["Redmi 13C", "АКБ", 400],
  ["iPhone 13 Pro Max", "кришка", 500],
  ["iPhone 13 Pro", "не заряджається", 500],
  ["Samsung A36", "дисплей", 1100],
];

const sql = neon(process.env.DATABASE_URL!);
const [{ n }] = (await sql`select count(*)::int as n from partner_prices`) as { n: number }[];
if (n > 0) {
  console.log(`Прайс уже має ${n} позицій — нічого не додаю.`);
} else {
  for (const [model, work, price] of START) {
    await sql`insert into partner_prices (model, work, price) values (${model}, ${work}, ${price})`;
  }
  console.log(`Додано ${START.length} позицій.`);
}
