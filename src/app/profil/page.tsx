import type { Metadata } from "next";
import CabinetBack from "@/components/account/CabinetBack";
import SignOutButton from "@/components/account/SignOutButton";
import Profile from "@/components/account/Profile";
import { getProfileExtras } from "@/lib/profile";
import { getClientLeads } from "@/db/leads";
import { getCabinetUser } from "@/lib/cabinetUser";
import base from "../moi-remonty/page.module.css";
import styles from "../kabinet/page.module.css";

export const metadata: Metadata = {
  title: "Мій профіль",
  description: "Фото, контакти й день народження — для знижки та швидших замовлень.",
  robots: { index: false, follow: false },
};

// Дані профілю змінюються тут же — кешувати не можна
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  // Маршрут закритий у proxy — сюди потрапляє лише авторизований клієнт
  const user = await getCabinetUser();
  const [extras, leads] = await Promise.all([
    getProfileExtras(),
    user ? getClientLeads(user.id, user.email) : Promise.resolve([]),
  ]);

  return (
    <div className={base.page}>
      <header className={base.head}>
        <div className={base.headTop}>
          <CabinetBack href="/kabinet" label="Кабінет" />
        </div>
        <h1 className={base.h1}>Мій профіль</h1>
      </header>

      <Profile
        birthday={extras.birthday}
        phone={extras.phone}
        guessPhone={leads.find((l) => l.phone)?.phone ?? null}
      />

      <footer className={styles.foot}>
        <SignOutButton quiet />
      </footer>
    </div>
  );
}
