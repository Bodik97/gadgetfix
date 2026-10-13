import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";

/**
 * Мініблискавки навколо іконки: ламані розряди, що вистрілюють із центру
 * назовні й щокадру міняють форму — як справжній електричний пробій.
 *
 * Малює three.js на маленькому прозорому полотні. Кадри рендеряться лише під
 * час спалаху: між спалахами полотно порожнє й нічого не рахується.
 */

type Point = [number, number];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Ламаний шлях розряду під кутом angle: від radius from до radius to */
function boltPath(angle: number, from: number, to: number, jitter: number, steps: number): Point[] {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = from + (to - from) * t;
    // Найбільше розряд «гуляє» посередині, кінці тримаються напрямку
    const off = i === 0 ? 0 : rand(-1, 1) * jitter * Math.sin(Math.PI * Math.min(t + 0.15, 1));
    points.push([dx * r - dy * off, dy * r + dx * off]);
  }
  return points;
}

/** Смужка трикутників уздовж ламаної: до кінця розряд тоншає */
function pushStrip(out: number[], points: Point[], width: number) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const wa = (width * (1 - (i / points.length) * 0.75)) / 2;
    const wb = (width * (1 - ((i + 1) / points.length) * 0.75)) / 2;
    out.push(
      ax + nx * wa, ay + ny * wa, 0, ax - nx * wa, ay - ny * wa, 0, bx + nx * wb, by + ny * wb, 0,
      bx + nx * wb, by + ny * wb, 0, ax - nx * wa, ay - ny * wa, 0, bx - nx * wb, by - ny * wb, 0,
    );
  }
}

export function createSparks(canvas: HTMLCanvasElement, size: number, color: string) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size, false);

  const half = size / 2;
  const camera = new OrthographicCamera(-half, half, half, -half, 0, 10);
  camera.position.z = 1;
  const scene = new Scene();

  // Два шари: широке кольорове світіння і тонка розпечена серцевина
  const glowGeometry = new BufferGeometry();
  const coreGeometry = new BufferGeometry();
  const glowMaterial = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthTest: false });
  const coreMaterial = new MeshBasicMaterial({ color: new Color(color).lerp(new Color("#ffffff"), 0.7), transparent: true, blending: AdditiveBlending, depthTest: false });
  scene.add(new Mesh(glowGeometry, glowMaterial), new Mesh(coreGeometry, coreMaterial));

  let timer = 0;

  const draw = (angles: number[]) => {
    const glow: number[] = [];
    const core: number[] = [];
    for (const base of angles) {
      const angle = base + rand(-0.12, 0.12);
      const reach = rand(half * 0.5, half - 3);
      const path = boltPath(angle, 9, reach, 4.5, 7);
      pushStrip(glow, path, 3.4);
      pushStrip(core, path, 1.2);

      // Відгалуження від середини розряду
      if (Math.random() < 0.6) {
        const at = path[Math.floor(rand(2, 5))];
        const start = Math.hypot(at[0], at[1]);
        const branch = boltPath(angle + rand(0.35, 0.8) * (Math.random() < 0.5 ? -1 : 1), start, start + rand(8, 16), 2.4, 4);
        // Гілка росте з точки на основному розряді, а не з центру
        const shiftX = at[0] - branch[0][0];
        const shiftY = at[1] - branch[0][1];
        const moved = branch.map(([x, y]) => [x + shiftX, y + shiftY] as Point);
        pushStrip(glow, moved, 2.2);
        pushStrip(core, moved, 0.8);
      }
    }
    glowGeometry.setAttribute("position", new BufferAttribute(new Float32Array(glow), 3));
    coreGeometry.setAttribute("position", new BufferAttribute(new Float32Array(core), 3));
    renderer.render(scene, camera);
  };

  const clear = () => {
    glowGeometry.setAttribute("position", new BufferAttribute(new Float32Array(0), 3));
    coreGeometry.setAttribute("position", new BufferAttribute(new Float32Array(0), 3));
    renderer.render(scene, camera);
  };

  return {
    /** Один спалах: кілька розрядів, що 5–8 кадрів поспіль міняють форму */
    burst() {
      window.clearTimeout(timer);
      const angles = Array.from({ length: Math.floor(rand(2, 5)) }, () => rand(0, Math.PI * 2));
      let frames = Math.floor(rand(5, 9));
      const tick = () => {
        if (frames-- <= 0) return clear();
        // Зрідка розряд на кадр зникає — від цього він і «тріщить»
        if (Math.random() < 0.18) clear();
        else draw(angles);
        timer = window.setTimeout(tick, rand(32, 60));
      };
      tick();
    },
    dispose() {
      window.clearTimeout(timer);
      glowGeometry.dispose();
      coreGeometry.dispose();
      glowMaterial.dispose();
      coreMaterial.dispose();
      renderer.dispose();
    },
  };
}
