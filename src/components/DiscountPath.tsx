"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { myJourney, type Journey } from "@/app/actions/account";
import { DISCOUNT_PERCENT, BIRTHDAY_WINDOW_DAYS } from "@/data/discounts";
import { openSignUp, prepareSignIn, useAuthState } from "./auth/authStore";
import { useBooking } from "./BookingModal";
import CountUp from "./CountUp";
import DiscountScene from "./DiscountScene";
import styles from "./DiscountPath.module.css";

/** Глибина карток у 3D-сцені, px: що вище в стосі, то ближче до глядача */
const DEPTH: Record<Card["key"], number> = { birthday: 10, signup: 30, repair: 50, review: 70, military: 90 };

/** Знижка військовим — її дає майстер у сервісі за посвідченням, у заявці її немає */
const MILITARY_PERCENT = 10;

type IconName = "userPlus" | "star" | "shield" | "wrench" | "gift";

type Card = {
  key: "signup" | "repair" | "review" | "military" | "birthday";
  /** Номер кроку на шляху до −10%; без номера — додаткова знижка */
  step?: 1 | 2 | 3;
  tone: "dark" | "lime" | "light";
  icon: IconName;
  chip?: string;
  label: string;
  /** Велике число на картці; у кроку «Ремонт» замість нього — коротка фраза */
  big: string;
  text: string;
};

const CARDS: Card[] = [
  {
    key: "signup",
    step: 1,
    tone: "dark",
    icon: "userPlus",
    chip: "30 секунд",
    label: "Реєстрація",
    big: `−${DISCOUNT_PERCENT.signup}%`,
    text: "на ремонт одразу після створення акаунта",
  },
  {
    key: "repair",
    step: 2,
    tone: "light",
    icon: "wrench",
    label: "Ремонт",
    big: "Фіксована ціна",
    text: "Діагностика безкоштовна, якщо ремонтуємо в нас. Кожен етап — у кабінеті.",
  },
  {
    key: "review",
    step: 3,
    tone: "lime",
    icon: "star",
    chip: "найвигідніше",
    label: "Відгук про ремонт",
    big: `−${DISCOUNT_PERCENT.review}%`,
    text: "на наступний ремонт — за чесний відгук після першого",
  },
  {
    key: "military",
    tone: "light",
    icon: "shield",
    chip: "з посвідченням",
    label: "Військовим",
    big: `−${MILITARY_PERCENT}%`,
    text: "на будь-який ремонт — покажіть посвідчення майстру. Дякуємо, що захищаєте",
  },
  {
    key: "birthday",
    tone: "dark",
    icon: "gift",
    chip: "щороку",
    label: "У день народження",
    big: `−${DISCOUNT_PERCENT.birthday}%`,
    text: `${BIRTHDAY_WINDOW_DAYS} днів до і після свята — діє сама`,
  },
];

/**
 * «Бонуси GadgetFix» на головній: шлях до −10% у три кроки й додаткові знижки.
 * На широкому екрані картки розкладені, як на столі, у порядку кроків; на
 * телефоні — покроковий слайдер: одна знижка на екран, простими словами, зі
 * своєю кнопкою. Головна статична, тож про вхід і прогрес дізнаємось уже в
 * браузері; поки не знаємо — показуємо гостю.
 */
export default function DiscountPath({ rating }: { rating: { average: number; count: number } | null }) {
  const { isSignedIn } = useAuthState();
  const [journey, setJourney] = useState<Journey | null>(null);
  // idle — як прийшло з сервера (видно все); wait — сховано до появи на екрані; in — анімація
  const [phase, setPhase] = useState<"idle" | "wait" | "in">("idle");
  const ref = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // Пунктирний маршрут 1 → 2 → 3 між кружками кроків — рахуємо з реальних місць карток
  const [route, setRoute] = useState("");

  useEffect(() => {
    const deck = boardRef.current;
    if (!deck) return;
    const measure = () => {
      const pts = [...deck.querySelectorAll<HTMLElement>("[data-step]")]
        .sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step))
        .map((no) => {
          const card = no.parentElement as HTMLElement;
          return [card.offsetLeft + no.offsetLeft + no.offsetWidth / 2, card.offsetTop + no.offsetTop + no.offsetHeight / 2];
        });
      if (pts.length < 2 || pts.every(([x, y]) => x === 0 && y === 0)) return setRoute("");
      // М'які вигини між кроками — маршрут, а не ламана
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const bend = i % 2 ? -90 : 90;
        d += ` C ${ax + bend} ${ay + (by - ay) * 0.6}, ${bx + bend} ${by - (by - ay) * 0.6}, ${bx} ${by}`;
      }
      setRoute(d);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(deck);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    let stale = false;
    myJourney()
      .catch(() => null)
      .then((j) => {
        if (!stale) setJourney(j);
      });
    return () => {
      stale = true;
    };
  }, [isSignedIn]);

  // Картки «падають на стіл», коли блок доходить до екрана. Видиме одразу — не ховаємо
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.8) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPhase("in");
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    const hide = requestAnimationFrame(() => setPhase((p) => (p === "idle" ? "wait" : p)));
    io.observe(el);
    return () => {
      cancelAnimationFrame(hide);
      io.disconnect();
    };
  }, []);

  const me = isSignedIn ? journey : null;
  const done = { signup: Boolean(me), repair: Boolean(me?.repaired), review: Boolean(me?.reviewed) };
  const count = Object.values(done).filter(Boolean).length;
  const next = !done.signup ? "signup" : !done.repair ? "repair" : !done.review ? "review" : null;

  // Кнопка веде саме до наступного кроку людини
  const cta = !me
    ? { label: `Забрати −${DISCOUNT_PERCENT.signup}% зараз`, href: null }
    : me.signupWaiting
      ? { label: `Скористатись −${DISCOUNT_PERCENT.signup}%`, href: "/moi-remonty?znyzhka=1" }
      : next === "repair"
        ? { label: "Мої ремонти", href: "/moi-remonty" }
        : next === "review"
          ? { label: `Залишити відгук за −${DISCOUNT_PERCENT.review}%`, href: "/moi-znyzhky" }
          : { label: "Мої знижки", href: "/moi-znyzhky" };

  return (
    <div ref={ref} className={`${styles.wrap} ${phase === "wait" ? styles.wait : ""} ${phase === "in" ? styles.in : ""}`}>
      <svg className={styles.decor} aria-hidden="true" viewBox="0 0 1280 760" preserveAspectRatio="xMidYMid slice">
        <path
          d="M760 210 C 880 140, 980 200, 1030 300 S 1060 520, 1090 560 S 900 700, 790 560"
          className={`${styles.dash} ${styles.track}`}
        />
        <circle cx="1110" cy="170" r="150" className={styles.sun} />
      </svg>

      <div className={styles.copy}>
        <span className={styles.pill}>
          <i aria-hidden="true" /> Бонуси GadgetFix
        </span>
        <h2 className={styles.title}>Кожен ваш крок — це знижка</h2>
        <p className={styles.lead}>
          Створіть акаунт, відремонтуйте телефон і розкажіть, як усе пройшло. Ми віддячимо знижкою на наступний ремонт.
        </p>

        <div className={styles.progress} aria-label={`Ваш шлях до −10%: ${count} з 3 кроків`}>
          <div className={styles.progressHead}>
            <strong>Ваш шлях до −{DISCOUNT_PERCENT.review}%</strong>
            <span>{count} з 3 кроків</span>
          </div>
          <div className={styles.barsWrap}>
            <div className={styles.bars}>
              {(["signup", "repair", "review"] as const).map((k, i) => (
                <span key={k} className={styles.bar}>
                  <i className={done[k] ? styles.fill : undefined} style={{ "--d": `${i * 180}ms` } as React.CSSProperties} />
                </span>
              ))}
            </div>
            {/* Айфончик проходить шлях Реєстрація → Ремонт → Відгук */}
            <svg className={styles.rider} width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
              <rect x="0.5" y="0.5" width="29" height="15" rx="4" className={styles.riderBody} />
              <rect x="2.5" y="2.5" width="25" height="11" rx="2.5" className={styles.riderScreen} />
              <rect x="24" y="6" width="1.6" height="4" rx="0.8" className={styles.riderBody} />
            </svg>
          </div>
          <div className={styles.barLabels}>
            <span>Реєстрація</span>
            <span>Ремонт</span>
            <span>Відгук</span>
          </div>
        </div>

        <div className={styles.actions}>
          {cta.href ? (
            <Link href={cta.href} className="btn btn-accent btn-lg" data-track="bonus-next">
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-accent btn-lg"
              onClick={openSignUp}
              onPointerEnter={prepareSignIn}
              onFocus={prepareSignIn}
              data-track="bonus-signup"
            >
              {cta.label}
            </button>
          )}
          <a href="#how" className="btn btn-ghost btn-lg">
            Як це працює
          </a>
        </div>
      </div>

      <div className={styles.side}>
        <DiscountScene board={boardRef} />
        {/* Комп'ютер: картки розкладені на столі; на телефоні замість них — слайдер нижче */}
        <div ref={boardRef} className={styles.board}>
          {route && (
            <svg className={styles.route} aria-hidden="true">
              <path d={route} className={`${styles.dash} ${styles.track}`} />
            </svg>
          )}
          {CARDS.map((c, i) => {
            const state = c.key === "signup" || c.key === "repair" || c.key === "review" ? (done[c.key] ? "done" : next === c.key ? "next" : null) : null;
            return (
              <article
                key={c.key}
                className={`${styles.card} ${styles[c.tone]} ${styles[c.key]} ${state === "next" ? styles.isNext : ""}`}
                style={{ "--i": i } as React.CSSProperties}
                data-key={c.key}
                data-depth={DEPTH[c.key]}
              >
                {c.step && (
                  <span className={styles.stepNo} aria-label={`Крок ${c.step}`} data-step={c.step}>
                    {c.step}
                  </span>
                )}
                <div className={styles.cardTop}>
                  <Icon name={c.icon} />
                  {state === "done" ? (
                    <span className={styles.doneChip}>✓ ваша</span>
                  ) : state === "next" ? (
                    <span className={styles.nextChip}>ваш наступний крок</span>
                  ) : (
                    c.chip && <span className={c.tone === "lime" ? styles.chipDark : styles.chip}>{c.chip}</span>
                  )}
                </div>
                <span className={styles.cardLabel}>{c.step ? `Крок ${c.step} · ${c.label}` : c.label}</span>
                <span className={c.key === "repair" ? styles.bigText : styles.pct}>
                  {c.key === "repair" ? c.big : <CountUp value={c.big} />}
                </span>
                <p className={styles.cardText}>{c.text}</p>
              </article>
            );
          })}
        </div>

        <Slides done={done} me={me} />

        {rating && rating.count > 0 && (
          <span className={styles.rating}>
            <span className={styles.stars} aria-hidden="true">
              ★★★★★
            </span>
            {rating.average.toFixed(1).replace(".", ",")} — оцінка клієнтів
          </span>
        )}
      </div>
    </div>
  );
}

/** Що зробити, щоб отримати знижку, — одним-двома реченнями й своєю кнопкою */
const HOW: Record<Card["key"], { title: string; how: string }> = {
  signup: { title: "Зареєструйтесь на сайті", how: "Натисніть кнопку, вкажіть пошту — і знижка ваша. Займає 30 секунд." },
  repair: { title: "Відремонтуйте телефон", how: "Залиште заявку — майстер передзвонить і назве ціну. Вона вже не зміниться." },
  review: { title: "Розкажіть, як усе пройшло", how: "Після ремонту напишіть відгук і додайте 2 фото: до і після." },
  military: { title: "Знижка військовим", how: "Покажіть посвідчення майстру, коли приносите телефон." },
  birthday: { title: "Знижка до дня народження", how: "Вкажіть дату в кабінеті — тиждень до і після свята знижка діє сама." },
};

/**
 * Телефон: покроковий слайдер. Гортають пальцем (рідна прокрутка з
 * прилипанням), кнопками «←/→» або крапками. Кожен слайд, ставши активним,
 * програє свою анімацію; на першому — підказка «гортайте», доки не гортнули.
 */
function Slides({ done, me }: { done: Record<"signup" | "repair" | "review", boolean>; me: Journey | null }) {
  const openBooking = useBooking();
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [swiped, setSwiped] = useState(false);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const slide = el.firstElementChild as HTMLElement | null;
    const width = slide ? slide.offsetWidth + 12 : el.clientWidth;
    const i = Math.round(el.scrollLeft / width);
    if (i !== active) setActive(Math.min(CARDS.length - 1, Math.max(0, i)));
    if (el.scrollLeft > 8) setSwiped(true);
  };

  const go = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (el && slide) el.scrollTo({ left: slide.offsetLeft - el.offsetLeft - 16, behavior: "smooth" });
  };

  const action = (key: Card["key"]) => {
    if (key === "signup") {
      if (!me) return { label: "Зареєструватись", onClick: openSignUp };
      return me.signupWaiting
        ? { label: `Скористатись −${DISCOUNT_PERCENT.signup}%`, href: "/moi-remonty?znyzhka=1" }
        : { label: "Мої знижки", href: "/moi-znyzhky" };
    }
    if (key === "review") return { label: "Як залишити відгук", href: "/moi-znyzhky" };
    if (key === "birthday") return { label: "Вказати дату", href: "/profil" };
    return { label: "Записатись на ремонт", onClick: () => openBooking() };
  };

  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <span className={styles.sliderCount}>
          {CARDS[active].step ? `Крок ${CARDS[active].step} з 3` : "Бонус"} · {active + 1}/{CARDS.length}
        </span>
        <span className={styles.sliderArrows}>
          <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Попередня знижка">
            ←
          </button>
          <button type="button" onClick={() => go(active + 1)} disabled={active === CARDS.length - 1} aria-label="Наступна знижка">
            →
          </button>
        </span>
      </div>

      <div ref={track} className={styles.track2} onScroll={onScroll} aria-roledescription="слайдер" aria-label="Знижки GadgetFix">
        {CARDS.map((c, i) => {
          const a = action(c.key);
          const isDone = (c.key === "signup" || c.key === "repair" || c.key === "review") && done[c.key];
          return (
            <section
              key={c.key}
              className={`${styles.slide} ${styles[c.tone]} ${i === active ? styles.on : ""}`}
              aria-label={`${i + 1} з ${CARDS.length}: ${HOW[c.key].title}`}
              data-anim={c.key}
            >
              <div className={styles.slideTop}>
                <span className={styles.art} aria-hidden="true">
                  <Icon name={c.icon} />
                  <i />
                  <i />
                  <i />
                </span>
                {isDone ? <span className={styles.doneChip}>✓ ваша</span> : c.chip && <span className={c.tone === "lime" ? styles.chipDark : styles.chip}>{c.chip}</span>}
              </div>
              <span className={c.key === "repair" ? styles.slideBigText : styles.slidePct}>
                {c.key === "repair" ? c.big : i === active ? <CountUp value={c.big} /> : c.big}
              </span>
              <h3 className={styles.slideTitle}>{HOW[c.key].title}</h3>
              <p className={styles.slideHow}>
                <strong>Як отримати:</strong> {HOW[c.key].how}
              </p>
              {"href" in a && a.href ? (
                <Link href={a.href} className={`btn ${c.tone === "lime" ? styles.slideBtnDark : "btn-accent"} ${styles.slideBtn}`}>
                  {a.label}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`btn ${c.tone === "lime" ? styles.slideBtnDark : "btn-accent"} ${styles.slideBtn}`}
                  onClick={"onClick" in a ? a.onClick : undefined}
                  onPointerEnter={c.key === "signup" ? prepareSignIn : undefined}
                >
                  {a.label}
                </button>
              )}
            </section>
          );
        })}
      </div>

      <div className={styles.dots} role="tablist" aria-label="Знижки">
        {CARDS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={HOW[c.key].title}
            className={i === active ? styles.dotOn : styles.dot}
            onClick={() => go(i)}
          />
        ))}
      </div>

      {!swiped && (
        <span className={styles.swipeHint} aria-hidden="true">
          Гортайте, щоб побачити всі знижки <span className={styles.hand}>→</span>
        </span>
      )}
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    userPlus: (
      <>
        <circle cx="10" cy="8.5" r="3.6" />
        <path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6" />
      </>
    ),
    star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
    shield: (
      <>
        <path d="M12 3l8 3v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </>
    ),
    wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
    gift: (
      <>
        <rect x="3.5" y="9" width="17" height="11" rx="2" />
        <path d="M2.5 9h19M12 9v11M12 9c-1.5-3-5-3.5-5-1s5 1 5 1zM12 9c1.5-3 5-3.5 5-1s-5 1-5 1z" />
      </>
    ),
  };
  return (
    <svg className={styles.icon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
