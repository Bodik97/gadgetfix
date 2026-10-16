import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { getLeadById } from "@/db/events";
import { describeStatus } from "@/db/leads";
import { isAdmin } from "@/lib/admin";
import { discountNote, discountState } from "../../ReviewList";
import ReviewActions from "../../ReviewActions";
import styles from "../../page.module.css";

export const metadata: Metadata = {
  title: "Відгук — адміністрування",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateFormat = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});

/** Відгук для перевірки: фото на весь розмір, повний текст, ремонт і контакти клієнта */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/vhid");

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [r] = await getDb().select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!r) notFound();

  const lead = r.leadId ? await getLeadById(r.leadId) : undefined;
  const photos = [
    { v: "before", label: "До ремонту", path: r.beforePath },
    { v: "after", label: "Після", path: r.afterPath },
  ].filter((p) => p.path);

  return (
    <section className={styles.wrap}>
      <Link href="/admin/vidhuky" className={styles.backLink}>
        ← Усі відгуки
      </Link>

      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Відгук: {r.authorName}</h1>
          <div className={styles.cardTop}>
            {r.device && <span className={styles.source}>{r.device}</span>}
            <span className={styles.stars} role="img" aria-label={`${r.rating} з 5`}>
              {"★".repeat(r.rating)}
              <span className={styles.starsOff} aria-hidden="true">{"★".repeat(5 - r.rating)}</span>
            </span>
            <span className={styles.when}>{dateFormat.format(r.createdAt)}</span>
            {r.published ? (
              <span className={styles.tagAccount}>на сайті</span>
            ) : (
              <span className={styles.tagAnon}>чекає</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.reviewDetail}>
        {photos.length > 0 ? (
          <div className={styles.reviewBig}>
            {photos.map((p) => (
              <a key={p.v} href={`/api/reviews/${r.id}/image?v=${p.v}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/reviews/${r.id}/image?v=${p.v}`} alt={p.label} />
                <span>{p.label}</span>
              </a>
            ))}
          </div>
        ) : (
          r.imagePath && (
            <div className={styles.reviewBig}>
              <a href={`/api/reviews/${r.id}/image`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/reviews/${r.id}/image`} alt="Фото роботи" />
              </a>
            </div>
          )
        )}

        <p className={styles.reviewText}>{r.text}</p>

        <dl className={styles.reviewFacts}>
          <dt>Знижка</dt>
          <dd>{r.byMaster ? "Відгук додав майстер — без знижки." : discountNote(r)}</dd>

          <dt>Ремонт</dt>
          <dd>
            {lead ? (
              <Link href={`/admin/zayavky?q=${lead.orderNo}&open=${lead.id}`} className={styles.link}>
                №&#8202;{lead.orderNo} · {lead.model ?? lead.service ?? "Ремонт"} · {describeStatus(lead.status).label}
              </Link>
            ) : (
              "Не привʼязаний — виданого ремонту через сайт не знайшли."
            )}
            {lead?.problem && <div className={styles.hint}>{lead.problem}</div>}
          </dd>

          <dt>Контакти</dt>
          <dd>
            {lead?.phone || lead?.email ? (
              <div className={styles.contacts}>
                {lead.name}
                {lead.phone && (
                  <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className={styles.link}>
                    {lead.phone}
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className={styles.link}>
                    {lead.email}
                  </a>
                )}
              </div>
            ) : (
              "Немає — у відгуку лише імʼя з акаунта."
            )}
          </dd>
        </dl>

        <ReviewActions id={r.id} published={r.published} discount={discountState(r)} showOpen={false} />
      </div>
    </section>
  );
}
