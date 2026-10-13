import type { Device } from "@/db/schema";
import { plural } from "./plural";
import styles from "./Devices.module.css";

const dateFmt = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Kyiv" });

function daysLeft(until: Date): number {
  return Math.ceil((until.getTime() - Date.now()) / 86_400_000);
}

export default function Devices({ devices }: { devices: Device[] }) {
  if (devices.length === 0) return null;

  return (
    <div className={styles.card}>
      <p className={styles.lead}>Гарантія рахується від дати видачі пристрою.</p>

      <div className={styles.list}>
        {devices.map((d) => {
          const left = daysLeft(d.warrantyUntil);
          const active = left > 0;

          return (
            <div key={d.id} className={styles.device}>
              <div className={styles.info}>
                <div className={styles.name}>{d.name}</div>
                {d.work && <div className={styles.work}>{d.work}</div>}
              </div>

              <div className={active ? styles.warrantyOn : styles.warrantyOff}>
                {active ? (
                  <>
                    <span className={styles.warrantyMain}>
                      {left} {plural(left, "день", "дні", "днів")} гарантії
                    </span>
                    <span className={styles.warrantyDate}>до {dateFmt.format(d.warrantyUntil)}</span>
                  </>
                ) : (
                  <>
                    <span className={styles.warrantyMain}>гарантія завершена</span>
                    <span className={styles.warrantyDate}>{dateFmt.format(d.warrantyUntil)}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
