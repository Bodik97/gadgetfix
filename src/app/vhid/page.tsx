import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import SignInForm from "@/components/auth/SignInForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Вхід",
  description: "Вхід для клієнтів GadgetFix — статус ремонту, посилка та історія заявок.",
  robots: { index: false, follow: false },
};

const perks = [
  { text: "Статус ремонту в реальному часі — без дзвінків", icon: "clock" },
  { text: "Історія всіх ваших ремонтів і чеків", icon: "list" },
  { text: "Гарантія на кожен пристрій — видно, доки діє", icon: "shield" },
] as const;

const icons = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

export default async function SignInPage() {
  // Уже увійшли — форма тут ні до чого
  const { userId } = await auth();
  if (userId) redirect("/kabinet");

  return (
    <section className={styles.wrap}>
      <span aria-hidden="true" className={styles.bg}>
        <span className={`${styles.glow} anim-drift`} />
      </span>

      <div className={styles.inner}>
        <div className={styles.copy}>
          <div className="kicker">Мої ремонти</div>
          <h1 className={styles.title}>Вхід для клієнтів</h1>
          <p className={styles.lead}>
            Пошта й пароль. Заходите вперше — акаунт створимо автоматично.
          </p>

          <div className={styles.perks}>
            {perks.map((p) => (
              <div key={p.text} className={styles.perk}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-text)" }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {icons[p.icon]}
                </svg>
                <span>{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        <SignInForm />
      </div>
    </section>
  );
}
