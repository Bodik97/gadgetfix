import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorks } from "@/db/works";
import { isAdmin } from "@/lib/admin";
import AddWork from "../AddWork";
import { deleteWork } from "../actions";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Роботи — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorksPage() {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const works = await getWorks();

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Результати робіт</h1>
          <p className={styles.sectionNote}>
            Фото до і після з коротким описом. Показуються на головній одразу, нові — першими.
          </p>
        </div>
      </div>

      <AddWork />

      {works.length === 0 ? (
        <div className={styles.empty}>Робіт ще немає — блок на головній прихований, доки не додасте першу.</div>
      ) : (
        <div className={styles.cards}>
          {works.map((w) => (
            <article key={w.id} className={styles.card}>
              <div className={styles.cardMain}>
                <div className={styles.cardTop}>
                  <span className={styles.name}>{w.device}</span>
                </div>
                <p className={styles.problem}>{w.text}</p>
                <div className={styles.reviewPhotos}>
                  {(["before", "after"] as const).map((v) => (
                    <a key={v} href={`/api/works/${w.id}/image?v=${v}`} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/works/${w.id}/image?v=${v}`} alt={v === "before" ? "До" : "Після"} loading="lazy" />
                      <span>{v === "before" ? "до" : "після"}</span>
                    </a>
                  ))}
                </div>
              </div>

              <div className={styles.cardSide}>
                <form action={deleteWork}>
                  <input type="hidden" name="id" value={w.id} />
                  <button type="submit" className={styles.deleteBtn}>
                    Видалити
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
