"use client";

import { useEffect, useRef } from "react";
import { site } from "@/data/site";
import { createSparkLayer } from "./lightning";
import styles from "./HeroStatus.module.css";

/**
 * Рядок над заголовком головної: графік і обіцянка передзвонити. Блискавка
 * б'є, як справжня: кілька коротких спалахів, з іконки вистрілюють
 * мініблискавки, потім пауза випадкової довжини. Ритм задає GSAP (він
 * довантажується окремо, вже після появи сторінки), розряди малює
 * lightning.ts — ті самі, що спалахують у точці дотику.
 */

/** Сторона полотна з розрядами, px: розряди виходять далеко за іконку */
const SPARKS_SIZE = 112;

export default function HeroStatus() {
  const bolt = useRef<SVGSVGElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const sparks = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let stop = () => {};
    let cancelled = false;

    import("gsap").then(({ gsap }) => {
      if (cancelled || !bolt.current || !glow.current || !sparks.current) return;

      const arcs = createSparkLayer(sparks.current);
      const center = SPARKS_SIZE / 2;

      const ctx = gsap.context(() => {
        const strike = () => {
          gsap
            .timeline({ onComplete: () => void gsap.delayedCall(gsap.utils.random(1.2, 3.6), strike) })
            // Два «передспалахи» — блискавка ніби шукає шлях
            .call(() => arcs.burst(center, center, { from: 8, reach: [24, 42] }))
            .to(bolt.current, { opacity: 0.25, duration: 0.05 })
            .to(bolt.current, { opacity: 1, duration: 0.04 })
            .to(bolt.current, { opacity: 0.35, duration: 0.06 })
            // Головний удар: блискавка яскравішає, навколо спалахує світіння
            .to(bolt.current, { opacity: 1, scale: 1.22, duration: 0.07, ease: "power4.out" })
            .to(glow.current, { opacity: 1, scale: 1.7, duration: 0.07, ease: "power4.out" }, "<")
            // Згасання
            .to(bolt.current, { scale: 1, duration: 0.5, ease: "power2.out" })
            .to(glow.current, { opacity: 0, scale: 1, duration: 0.6, ease: "power2.out" }, "<");
        };
        gsap.delayedCall(0.9, strike);
      });
      stop = () => {
        ctx.revert();
        arcs.dispose();
      };
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <p className={`${styles.status} nUp`}>
      <span className={styles.mark} aria-hidden="true">
        <span className={styles.glow} ref={glow} />
        <canvas className={styles.sparks} ref={sparks} />
        <svg ref={bolt} className={styles.bolt} width="20" height="20" viewBox="0 0 24 24">
          <path d="M13.5 2L4.5 13.5H11L9.5 22L19.5 9.5H13L13.5 2Z" />
        </svg>
      </span>
      <span className={styles.text}>
        <strong className={styles.hours}>{site.hours}</strong>
        <span className={styles.note}>передзвонимо за 25 хвилин</span>
      </span>
    </p>
  );
}
