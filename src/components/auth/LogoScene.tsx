"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LogoScene.module.css";

/**
 * Знак «G» у 3D для екрана входу. Лаймові частинки злітаються з усіх боків
 * і складаються в знак, той проявляється обʼємним, далі легко дихає й
 * повертається за курсором.
 *
 * Геометрія — з фірмового SVG (public/brand/gadgetfix-mark-lime.svg): дуга
 * радіусом 38 з центром (60, 60) від 25° до 315° і риска від (56, 60) до (104, 60),
 * товщина лінії 12 із круглими кінцями.
 *
 * Three.js підвантажується лише тут — у вікні й на сторінці входу, а не на всьому сайті.
 * Немає WebGL — показуємо звичайний SVG; просять менше руху — одразу готовий знак.
 */
export default function LogoScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stopped = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (stopped) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        setFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 1, 1000);
      camera.position.set(0, 0, 230);

      // ---------- Знак: дуга й риска як трубки, круглі кінці — сфери ----------
      const R = 38;
      const T = 6;
      const deg = (d: number) => (d * Math.PI) / 180;
      // SVG рахує y донизу — перевертаємо, і центр знака в нуль
      const at = (a: number) => new THREE.Vector3(R * Math.cos(a), -R * Math.sin(a), 0);

      class Arc extends THREE.Curve<import("three").Vector3> {
        // Конструктор Curve у типах захищений — підклас відкриває свій
        constructor() {
          super();
        }

        getPoint(t: number, target = new THREE.Vector3()) {
          return target.copy(at(deg(25 + 290 * t)));
        }
      }
      const arc = new Arc();
      const bar = new THREE.LineCurve3(new THREE.Vector3(-4, 0, 0), new THREE.Vector3(44, 0, 0));

      const material = new THREE.MeshStandardMaterial({
        color: 0xdcf35a,
        emissive: 0x9fb71f,
        emissiveIntensity: 0.35,
        metalness: 0.35,
        roughness: 0.3,
        transparent: true,
        opacity: 0,
      });

      const mark = new THREE.Group();
      mark.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 160, T, 24, false), material));
      mark.add(new THREE.Mesh(new THREE.TubeGeometry(bar, 8, T, 24, false), material));
      const cap = new THREE.SphereGeometry(T, 24, 16);
      for (const p of [at(deg(25)), at(deg(315)), new THREE.Vector3(-4, 0, 0), new THREE.Vector3(44, 0, 0)]) {
        const s = new THREE.Mesh(cap, material);
        s.position.copy(p);
        mark.add(s);
      }
      // Риска сидить правіше центру — зсуваємо знак, щоб він був по центру кадру
      mark.position.x = -4;
      scene.add(mark);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(60, 90, 140);
      scene.add(key);
      const rim = new THREE.PointLight(0xdcf35a, 2.2, 0, 0);
      rim.position.set(-120, -60, 80);
      scene.add(rim);

      // ---------- Частинки: стартують хмарою, летять на поверхню знака ----------
      const COUNT = 1400;
      const from = new Float32Array(COUNT * 3);
      const to = new Float32Array(COUNT * 3);
      const delay = new Float32Array(COUNT);
      const tmp = new THREE.Vector3();
      for (let i = 0; i < COUNT; i++) {
        // Точка на осі знака (дуга довша — їй більше частинок) плюс зсув у межах товщини
        const onArc = Math.random() < 0.82;
        if (onArc) arc.getPoint(Math.random(), tmp);
        else bar.getPoint(Math.random(), tmp);
        const a = Math.random() * Math.PI * 2;
        const r = T * Math.sqrt(Math.random());
        to[i * 3] = tmp.x + Math.cos(a) * r - 4;
        to[i * 3 + 1] = tmp.y + Math.sin(a) * r;
        to[i * 3 + 2] = (Math.random() - 0.5) * T * 2;

        const dir = new THREE.Vector3().randomDirection().multiplyScalar(160 + Math.random() * 140);
        from.set([dir.x, dir.y, dir.z], i * 3);
        delay[i] = Math.random() * 0.35;
      }
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(from);
      geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const dots = new THREE.PointsMaterial({
        color: 0xdcf35a,
        size: 1.8,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloud = new THREE.Points(geom, dots);
      scene.add(cloud);

      // ---------- Розмір, курсор, видимість ----------
      const resize = () => {
        const { clientWidth: w, clientHeight: h } = canvas;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // На вузькому полотні відсуваємо камеру, щоб знак не обрізався
        camera.position.z = w / h < 1 ? 230 / (w / h) : 230;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      resize();

      const pointer = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
      const ASSEMBLE = 1.9;
      const start = performance.now();
      let frame = 0;
      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !frame) frame = requestAnimationFrame(tick);
      });
      io.observe(canvas);

      function tick(now: number) {
        frame = 0;
        const t = calm ? 99 : (now - start) / 1000;

        // Зліт частинок
        for (let i = 0; i < COUNT; i++) {
          const k = ease((t - delay[i]) / (ASSEMBLE - 0.35));
          for (let j = 0; j < 3; j++) pos[i * 3 + j] = from[i * 3 + j] + (to[i * 3 + j] - from[i * 3 + j]) * k;
        }
        geom.attributes.position.needsUpdate = true;

        // Знак проявляється наприкінці зльоту, частинки тануть до ледь помітного пилу
        const reveal = ease((t - ASSEMBLE * 0.7) / 0.7);
        material.opacity = reveal;
        dots.opacity = 0.95 - reveal * 0.8;
        mark.scale.setScalar(0.92 + reveal * 0.08);

        // Дихання й поворот за курсором
        const idle = calm ? 0 : t;
        const targetY = Math.sin(idle * 0.6) * 0.22 + pointer.x * 0.35;
        const targetX = Math.cos(idle * 0.5) * 0.08 + pointer.y * 0.25;
        mark.rotation.y += (targetY - mark.rotation.y) * 0.06;
        mark.rotation.x += (targetX - mark.rotation.x) * 0.06;
        cloud.rotation.copy(mark.rotation);

        renderer.render(scene, camera);
        // Без руху — одного кадру досить
        if (!calm && visible && !document.hidden) frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);

      const onVisibility = () => {
        if (!document.hidden && visible && !frame && !calm) frame = requestAnimationFrame(tick);
      };
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVisibility);
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose();
        });
        material.dispose();
        dots.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      stopped = true;
      cleanup();
    };
  }, []);

  if (failed) {
    // eslint-disable-next-line @next/next/no-img-element -- запасний варіант без WebGL, векторний SVG
    return <img src="/brand/gadgetfix-mark-lime.svg" alt="" className={styles.fallback} />;
  }

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
