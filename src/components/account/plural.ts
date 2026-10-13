const rules = new Intl.PluralRules("uk");

/** 1 день, 2 дні, 5 днів, 21 день, 22 дні — форму обирає Intl, а не умова «менше п'яти» */
export function plural(n: number, one: string, few: string, many: string): string {
  const rule = rules.select(n);
  return rule === "one" ? one : rule === "few" ? few : many;
}
