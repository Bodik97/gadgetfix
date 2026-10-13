import styles from "./HeroArt.module.css";

/**
 * Лінійний малюнок тлом темного героя сторінки. Лише прикраса: лежить під
 * вмістом і схований від читалок екрана.
 */
export default function HeroArt({ name }: { name: "tools" | "devices" | "parts" | "route" }) {
  return <div className={`${styles.art} ${styles[name]}`} aria-hidden="true" />;
}
