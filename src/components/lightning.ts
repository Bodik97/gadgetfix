/**
 * Мініблискавки: ламані розряди, що вистрілюють із точки назовні й кілька
 * кадрів поспіль міняють форму — як справжній електричний пробій.
 *
 * Малюються на звичайному canvas, без бібліотек. Кадри рахуються лише поки
 * триває хоч один спалах: між спалахами полотно порожнє й цикл зупинений.
 */

type Point = [number, number];

/** Гілка розряду: ламана й те, наскільки вона тонша за головний канал */
type Branch = { points: Point[]; weight: number };

type BurstOptions = {
  /** Радіус, з якого розряд починається: 0 — з точки, більше — довкола іконки */
  from?: number;
  /** Довжина розрядів від центру, px: від і до */
  reach: [number, number];
};

type Burst = {
  x: number;
  y: number;
  options: BurstOptions;
  angles: number[];
  /** Скільки форм розряд змінить загалом і скільки ще лишилось */
  total: number;
  frames: number;
  /** Коли малювати наступну форму */
  nextAt: number;
  /** Поточна форма; порожня — розряд на мить «згас» */
  branches: Branch[];
};

const LIME = "#DCF35A";
const CORE = "#FBFFE9";
/** Темний край розряду: без нього салатове не видно на світлому тлі */
const EDGE = "rgb(34 40 8 / .5)";

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Ламана від a до b «дробленням навпіл»: середину відрізка зсуваємо вбік і
 * повторюємо для обох половин. Так ламається справжня блискавка — великі
 * злами з дрібним тремтінням усередині.
 */
function fracture(a: Point, b: Point, sway: number, depth: number): Point[] {
  if (depth === 0) return [a, b];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const shift = rand(-1, 1) * sway;
  const mid: Point = [(a[0] + b[0]) / 2 - dy * shift, (a[1] + b[1]) / 2 + dx * shift];
  const left = fracture(a, mid, sway * 0.62, depth - 1);
  return [...left, ...fracture(mid, b, sway * 0.62, depth - 1).slice(1)];
}

/** Канал із точки start під кутом angle довжиною length, з відгалуженнями */
function grow(out: Branch[], start: Point, angle: number, length: number, weight: number, depth: number) {
  const end: Point = [start[0] + Math.cos(angle) * length, start[1] + Math.sin(angle) * length];
  const points = fracture(start, end, 0.24, depth);
  out.push({ points, weight });
  if (weight < 0.35) return;

  // Гілки відходять під гострим кутом у той самий бік, куди б'є канал
  const forks = Math.floor(rand(1, 3.4));
  for (let i = 0; i < forks; i++) {
    const at = points[Math.floor(rand(points.length * 0.2, points.length * 0.8))];
    const side = Math.random() < 0.5 ? -1 : 1;
    grow(out, at, angle + rand(0.3, 0.75) * side, length * rand(0.28, 0.5), weight * 0.55, Math.max(depth - 1, 2));
  }
}

/** Нова форма спалаху */
function shape(burst: Burst): Branch[] {
  const { x, y, options } = burst;
  const from = options.from ?? 0;
  const branches: Branch[] = [];
  for (const base of burst.angles) {
    const angle = base + rand(-0.1, 0.1);
    const start: Point = [x + Math.cos(angle) * from, y + Math.sin(angle) * from];
    grow(branches, start, angle, rand(options.reach[0], options.reach[1]) - from, 1, 4);
  }
  return branches;
}

function trace(ctx: CanvasRenderingContext2D, points: Point[], width: number, style: string) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

export function createSparkLayer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  let bursts: Burst[] = [];
  let frame = 0;
  let width = 0;
  let height = 0;

  /** Полотно під розмір елемента й щільність екрана — інакше розряди мильні */
  const fit = () => {
    const ratio = Math.min(window.devicePixelRatio, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const tick = (now: number) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    bursts = bursts.filter((burst) => {
      if (now >= burst.nextAt) {
        if (burst.frames-- <= 0) return false;
        // Зрідка розряд на кадр зникає — від цього він і «тріщить»
        burst.branches = Math.random() < 0.2 ? [] : shape(burst);
        burst.nextAt = now + rand(28, 55);
      }

      // Перші кадри найяскравіші, далі розряд блякне
      ctx.globalAlpha = 0.35 + 0.65 * (burst.frames / burst.total);
      for (const { points, weight } of burst.branches) {
        ctx.shadowBlur = 0;
        trace(ctx, points, 2.4 * weight + 0.6, EDGE);
        // Тонке салатове світіння і біла розпечена серцевина
        ctx.shadowColor = LIME;
        ctx.shadowBlur = 5;
        trace(ctx, points, 1.3 * weight + 0.3, LIME);
        ctx.shadowBlur = 0;
        trace(ctx, points, 0.7 * weight + 0.15, CORE);
      }
      ctx.globalAlpha = 1;
      return true;
    });

    frame = bursts.length ? requestAnimationFrame(tick) : 0;
  };

  fit();

  return {
    fit,
    /** Спалах у точці (x, y) полотна: 1–3 розряди з гілками на 4–7 кадрів */
    burst(x: number, y: number, options: BurstOptions) {
      const total = Math.floor(rand(4, 8));
      bursts.push({
        x,
        y,
        options,
        angles: Array.from({ length: Math.floor(rand(1, 3.6)) }, () => rand(0, Math.PI * 2)),
        total,
        frames: total,
        nextAt: 0,
        branches: [],
      });
      if (!frame) frame = requestAnimationFrame(tick);
    },
    dispose() {
      cancelAnimationFrame(frame);
      bursts = [];
    },
  };
}
