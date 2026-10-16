import { desc } from "drizzle-orm";
import { getDb } from "./index";
import { works, type Work } from "./schema";

/** Результати робіт — нові зверху */
export async function getWorks(limit?: number): Promise<Work[]> {
  const query = getDb().select().from(works).orderBy(desc(works.createdAt));
  return limit ? query.limit(limit) : query;
}
