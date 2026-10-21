"use client";

import { useEffect, useRef } from "react";
import styles from "./DiscountPath.module.css";

/** Відстань «камери» до столу: та сама і для CSS-перспективи карток, і для Three.js */
const DEPTH = 1200;
/** Наскільки стіл нахиляється за курсором, градуси */
const TILT_X = 7;
const TILT_Y = 11;

/**
 * 3D для «Бонусів»: картки (живий HTML) рознесені по глибині й «дихають»,
 * стіл — разом із пунктирним маршрутом на ньому — нахиляється за курсором,
 * а позаду Three.js тримає салатовий пил на різній глибині.
 *
 * Камера Three.js і CSS-перспектива рахуються однаково (та сама відстань і
 * центр), тож пил нахиляється разом зі столом. Лише комп'ютер із мишкою й без
 * «менше руху»; Three.js вантажиться, коли блок доходить до екрана. Без нього
 * блок просто лишається пласким.
 */
export default function DiscountScene({ board }: { board: React.RefObject<HTMLDivElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const deck = board.current;
    const side = deck?.parentElement;
    if (!canvas || !deck || !side) return;

    const ok = window.matchMedia("(min-width: 960px) and (pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ok || calm) return;

    let stopped = false;
    let cleanup = () => {};

    // Three.js тягнемо лише тоді, коли блок підійшов до екрана
    const gate = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        gate.disconnect();
        start();
      },
      { rootMargin: "300px 0px" },
    );
    gate.observe(side);

    async function start() {
      const THREE = await import("three");
      if (stopped || !canvas || !deck || !side) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const cards = [...deck.querySelectorAll<HTMLElement>("[data-depth]")];

      // Стіл у 3D: перспектива на батьківському блоці, нахил — на самому столі
      side.style.perspective = `${DEPTH}px`;
      deck.style.transformStyle = "preserve-3d";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 1, DEPTH * 3);
      camera.position.set(0, 0, DEPTH);
      const table = new THREE.Group();
      scene.add(table);

      // Кругла крапка для пилу — квадратні точки WebGL виглядали б пікселями
      const dotTex = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d")!;
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.45, "rgba(255,255,255,1)");
        grad.addColorStop(0.55, "rgba(255,255,255,.35)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })();

      // Розмір точок — у пікселях екрана: на відстані камери світові одиниці дали б ~2px
      const dustMat = new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: dotTex, transparent: true, opacity: 0.55, depthWrite: false });

      // Пил — у межах столу, на різній глибині
      const DUST = 70;
      const dustBase = new Float32Array(DUST * 3);
      const dustGeom = new THREE.BufferGeometry();
      dustGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
      table.add(new THREE.Points(dustGeom, dustMat));

      // Колір — з токенів теми
      const paint = () => {
        const css = getComputedStyle(document.documentElement);
        dustMat.color.set(css.getPropertyValue("--accent").trim() || "#dcf35a");
      };
      paint();
      const themeWatch = new MutationObserver(paint);
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      const layout = () => {
        const W = side.clientWidth;
        const H = side.clientHeight;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.fov = (2 * Math.atan(H / 2 / DEPTH) * 180) / Math.PI;
        camera.updateProjectionMatrix();
        for (let i = 0; i < DUST; i++) {
          dustBase[i * 3] = (Math.random() - 0.5) * W;
          dustBase[i * 3 + 1] = (Math.random() - 0.5) * H;
          dustBase[i * 3 + 2] = Math.random() * 160 - 40;
        }
      };
      layout();
      const ro = new ResizeObserver(layout);
      ro.observe(side);

      // Курсор над усім блоком нахиляє стіл; без курсора — легке погойдування
      const wrap = side.parentElement ?? side;
      const pointer = { x: 0, y: 0, on: false };
      const onMove = (e: PointerEvent) => {
        const r = wrap.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
        pointer.on = true;
      };
      const onLeave = () => {
        pointer.on = false;
      };
      wrap.addEventListener("pointermove", onMove, { passive: true });
      wrap.addEventListener("pointerleave", onLeave);

      const startAt = performance.now();
      let rx = 0;
      let ry = 0;
      let frame = 0;
      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !frame) frame = requestAnimationFrame(tick);
      });
      io.observe(side);

      function tick(now: number) {
        frame = 0;
        const t = (now - startAt) / 1000;

        const tx = pointer.on ? -pointer.y * TILT_X : Math.sin(t * 0.35) * 1.2;
        const ty = pointer.on ? pointer.x * TILT_Y : Math.cos(t * 0.3) * 2;
        rx += (tx - rx) * 0.07;
        ry += (ty - ry) * 0.07;

        // Стіл у CSS і той самий нахил у Three.js (вісь Y у CSS дивиться вниз)
        deck!.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        table.rotation.set((-rx * Math.PI) / 180, (ry * Math.PI) / 180, 0);

        // Картки на своїй глибині й ледь «дихають», кожна у своєму ритмі
        cards.forEach((el, i) => {
          const bob = Math.sin(t * 0.9 + i * 1.3) * 5;
          el.style.transform = `translate3d(0, ${bob.toFixed(2)}px, calc(${el.dataset.depth}px + var(--lift, 0px)))`;
        });

        const p = dustGeom.attributes.position as import("three").BufferAttribute;
        for (let i = 0; i < DUST; i++) {
          p.setXYZ(
            i,
            dustBase[i * 3] + Math.sin(t * 0.3 + i) * 12,
            dustBase[i * 3 + 1] + Math.cos(t * 0.25 + i * 0.7) * 10,
            dustBase[i * 3 + 2],
          );
        }
        p.needsUpdate = true;

        renderer.render(scene, camera);
        if (visible && !document.hidden) frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);

      const onVisibility = () => {
        if (!document.hidden && visible && !frame) frame = requestAnimationFrame(tick);
      };
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        io.disconnect();
        themeWatch.disconnect();
        wrap.removeEventListener("pointermove", onMove);
        wrap.removeEventListener("pointerleave", onLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        // Повертаємо стіл пласким — без сцени картки мають лишатись на місцях
        side.style.perspective = "";
        deck.style.transform = "";
        deck.style.transformStyle = "";
        cards.forEach((el) => (el.style.transform = ""));
        dustGeom.dispose();
        dustMat.dispose();
        dotTex.dispose();
        renderer.dispose();
      };
    }

    return () => {
      stopped = true;
      gate.disconnect();
      cleanup();
    };
  }, [board]);

  return <canvas ref={canvasRef} className={styles.scene} aria-hidden="true" />;
}
