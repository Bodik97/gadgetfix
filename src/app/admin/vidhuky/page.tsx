import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAllReviews } from "@/db/reviews";
import { isAdmin } from "@/lib/admin";
import AddReview from "../AddReview";
import ReviewList from "../ReviewList";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Відгуки — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const reviews = await getAllReviews();
  const pending = reviews.filter((r) => !r.published).length;

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Відгуки</h1>
          <p className={styles.sectionNote}>
            {pending > 0
              ? `${pending} ${pending === 1 ? "відгук чекає" : "відгуків чекають"} вашого схвалення. Опубліковані показуються на головній.`
              : "Усі відгуки перевірені. Опубліковані показуються на головній."}
          </p>
        </div>
      </div>

      <div className={styles.addRow}>
        <AddReview />
      </div>

      <ReviewList reviews={reviews} />
    </section>
  );
}
