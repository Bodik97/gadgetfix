import { DISCOUNT_PERCENT } from "@/data/discounts";
import styles from "./ClaimedBanner.module.css";

/** Щойно прив'язали заявку, лишену без входу: показуємо, що знижка вже в ній */
export default function ClaimedBanner({ orderNo, discount }: { orderNo: number; discount: string | null }) {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.icon} aria-hidden="true">
        🎉
      </span>
      <span>
        <strong>Заявку №{orderNo} тепер видно в кабінеті</strong>
        {discount === "signup"
          ? ` — і до неї вже застосовано знижку ${DISCOUNT_PERCENT.signup}% за реєстрацію. Майстер назве ціну з нею.`
          : " — тут видно кожен етап ремонту."}
      </span>
    </div>
  );
}
