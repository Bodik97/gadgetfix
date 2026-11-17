// Разове перенесення старих заявок у нову адмінку: етап, позначка, точка.
// Запускати ПІСЛЯ того, як нові колонки зʼявились у базі (npm run db:push).
//
// Перегляд без змін:  npx dotenv -e .env.local -- tsx scripts/migrate-stages.mts
// Записати в базу:    npx dotenv -e .env.local -- tsx scripts/migrate-stages.mts --apply
//
// Безпечно запускати повторно: чіпає лише заявки, які ще не переносили
// (етап «new» без позначки при старому статусі не «new», або без точки).
import { neon } from "@neondatabase/serverless";
import { guessLocation, statusToStage } from "../src/lib/stage";

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL!);
const emails = { novyiRozdil: process.env.ADMIN_EMAIL, lviv: process.env.ADMIN_EMAIL_2 };

type Row = {
  id: string;
  order_no: number;
  status: "new" | "in_progress" | "ready" | "shipped" | "done" | "rejected";
  stage: string;
  flag: string | null;
  location: string | null;
  source: "landing" | "model" | "services" | "mail-in" | "manual";
  delivery_requested: boolean;
  assignee: string | null;
};

const rows = (await sql`
  select id, order_no, status, stage, flag, location, source, delivery_requested, assignee
  from leads where channel = 'own' order by order_no
`) as Row[];

const changes = rows
  .map((r) => {
    const { stage, flag } = statusToStage(r.status);
    const location =
      r.location ??
guessLocation({ assignee: r.assignee }, emails);
    const same = r.stage === stage && r.flag === flag && r.location === location;
    return same ? null : { id: r.id, no: r.order_no, status: r.status, stage, flag, location };
  })
  .filter((c) => c !== null);

console.table(changes.map((c) => ({ no: c.no, status: c.status, stage: c.stage, flag: c.flag, location: c.location })));
console.log(`Заявок усього: ${rows.length}, до зміни: ${changes.length}`);

if (!apply) {
  console.log("Це перегляд. Щоб записати — додайте --apply.");
} else {
  for (const c of changes) {
    await sql`
      update leads set stage = ${c.stage}, flag = ${c.flag}, location = ${c.location}
      where id = ${c.id}
    `;
  }
  console.log(`Записано: ${changes.length}`);
}
