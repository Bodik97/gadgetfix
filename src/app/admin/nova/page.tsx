import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { LIMITS } from "@/lib/validate";
import NewLeadForm from "./NewLeadForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Нова заявка — адміністрування",
  robots: { index: false, follow: false },
};

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  if (!(await isAdmin())) redirect("/admin/vhid");
  // З пошуку «+ Нова заявка на iPhone 13 Pro» — модель уже вписана
  const { model } = await searchParams;

  return (
    <section className={styles.wrap}>
      <h1 className={styles.title}>Нова заявка</h1>
      <p className={styles.lead}>Клієнт подзвонив або прийшов без запису. Заявка буде за вами.</p>
      <NewLeadForm model={model?.slice(0, LIMITS.short)} />
    </section>
  );
}
