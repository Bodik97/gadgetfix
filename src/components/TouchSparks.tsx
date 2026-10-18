"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createSparkLayer } from "./lightning";
import styles from "./TouchSparks.module.css";

/** Де спалахів немає: робочі сторінки, на яких натискають багато й по ділу */
const QUIET = ["/admin", "/kabinet", "/moi-remonty", "/moi-znyzhky", "/vhid"];

/** Довший або «з'їхавший» дотик — це прокрутка чи затискання, а не натискання */
const TAP_MS = 400;
const TAP_SHIFT = 10;

/**
 * Мініблискавки в точці дотику. Полотно лежить поверх сторінки, але дотиків
 * не перехоплює: кнопки, посилання й прокрутка працюють як завжди.
 */
export default function TouchSparks() {
  const pathname = usePathname();
  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const layer = createSparkLayer(canvas);
    let start: { x: number; y: number; at: number } | null = null;

    const down = (e: PointerEvent) => {
      start = e.isPrimary ? { x: e.clientX, y: e.clientY, at: e.timeStamp } : null;
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const tap = e.timeStamp - start.at < TAP_MS && Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_SHIFT;
      start = null;
      if (tap) layer.burst(e.clientX, e.clientY, { reach: [20, 46] });
    };
    // Почалась прокрутка — браузер скасовує дотик, спалаху не буде
    const cancel = () => {
      start = null;
    };

    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", cancel, { passive: true });
    window.addEventListener("resize", layer.fit);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("resize", layer.fit);
      layer.dispose();
    };
  }, [quiet]);

  if (quiet) return null;

  return <canvas ref={ref} className={styles.layer} aria-hidden="true" />;
}
