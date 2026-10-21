import type { Metadata } from "next";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { site } from "@/data/site";
import { WARRANTY_MAX } from "@/data/warranty";
import { owner, ownerName } from "@/data/owner";
import styles from "./page.module.css";

/** Дата цієї редакції — міняти разом із суттєвими змінами тексту */
const REVISION = "22 жовтня 2026";

export const metadata: Metadata = {
  title: "Персональні дані — що збираємо і навіщо",
  description:
    "Які дані GadgetFix отримує при записі на ремонт, скільки їх зберігає, кому передає і як їх забрати.",
  alternates: { canonical: "/personalni-dani" },
};

/** Лінійні значки 24×24 — тим самим штрихом, що й на решті сайту */
const ICONS = {
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cake: '<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 12V9M12 6.5a1.2 1.2 0 0 0 0-2.5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cookie: '<path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-5-4 4 4 0 0 1-4-5z"/><path d="M8.5 11.5h.01M12 16h.01M15.5 13.5h.01M9 15.5h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4"/>',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span className={styles.icon}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ICONS[name] }}
      />
    </span>
  );
}

const SECTIONS = [
  { id: "khto", label: "Хто обробляє" },
  { id: "shcho", label: "Що збираємо" },
  { id: "navishcho", label: "Навіщо" },
  { id: "pidstavy", label: "Підстави" },
  { id: "komu", label: "Кому доступні" },
  { id: "skilky", label: "Скільки зберігаємо" },
  { id: "cookie", label: "Cookie" },
  { id: "statystyka", label: "Статистика" },
  { id: "prava", label: "Ваші права" },
  { id: "zminy", label: "Зміни" },
] as const;

const COLLECTED: { icon: keyof typeof ICONS; title: string; body: string }[] = [
  {
    icon: "wrench",
    title: "Запис на ремонт",
    body: "Імʼя, телефон, за бажанням пошта. Модель, послуга й ваш опис несправності. Місто й відділення пошти — якщо надсилаєте пристрій. Телефонні розмови не записуємо.",
  },
  {
    icon: "user",
    title: "Акаунт",
    body: "Пошта, імʼя й фото з профілю. Пароль і сам вхід ми не бачимо — цим займається Clerk.",
  },
  {
    icon: "cake",
    title: "Профіль",
    body: "Телефон і день народження — якщо вкажете самі. Дата потрібна лише для знижки. Самостійно змінити її не можна, щоб знижку не брали двічі, — але якщо помилились, напишіть нам, і ми виправимо.",
  },
  {
    icon: "chat",
    title: "Листування з майстром",
    body: "Текст повідомлень, реакції й фото, які надсилаєте. Фото лежать у закритому сховищі — за прямим посиланням їх не відкрити.",
  },
  {
    icon: "bell",
    title: "Сповіщення",
    body: "Якщо підключите Telegram — номер чату, а коли поділитесь номером — і телефон. Якщо ввімкнете push — технічну адресу вашого браузера для сповіщень.",
  },
  {
    icon: "tag",
    title: "Знижки",
    body: "Яка знижка застосована до заявки: за реєстрацію, за відгук чи на день народження. Військову знижку майстер ставить на місці.",
  },
  {
    icon: "card",
    title: "Оплата",
    body: "Сума, дата оплати й завдаток. Реквізити картки до нас не потрапляють — ми їх не приймаємо й не зберігаємо.",
  },
  {
    icon: "star",
    title: "Відгук",
    body: "Імʼя, місто, модель і текст. Після нашого схвалення відгук публікується на сайті разом з імʼям і містом — приберемо його на ваше прохання.",
  },
];

const PARTNERS = [
  { name: "Vercel", what: "сайт і сховище фото" },
  { name: "Neon", what: "база даних із заявками" },
  { name: "Clerk", what: "акаунти, вхід і профіль" },
  { name: "Telegram", what: "сповіщення, якщо ви підключили бота; має власні правила щодо даних" },
  { name: "Apple / Google", what: "доставка push-сповіщень, якщо ви їх увімкнули" },
  { name: "Нова Пошта", what: "лише адреса відділення, коли надсилаєте пристрій" },
];

/**
 * Сторінка про обробку персональних даних.
 *
 * Написана з того, що система робить насправді: поля таблиць, сервіси,
 * до яких дані доходять, і механізми, які справді існують. Обіцянки без
 * механізму тут не місце — право на видалення працює, бо в адмінці є
 * кнопка, яка прибирає заявку разом із листуванням і фото.
 */
export default function PersonalDataPage() {
  const phone = site.phones[0];

  return (
    <>
      <section className={`band ${styles.hero}`} data-theme="dark">
        <div className={`container ${styles.heroInner}`}>
          <BackButton fallback="/" />
          <div className="kicker">Персональні дані</div>
          <h1 className={styles.title}>Що ми про вас знаємо</h1>
          <p className={styles.lede}>
            Коротко й без юридичної мови: які дані ви нам лишаєте, навіщо вони, скільки лежать
            і як їх забрати. Сторінка описує те, що система робить насправді.
          </p>
          <ul className={styles.promises}>
            <li>Не продаємо й не передаємо для реклами</li>
            <li>Без рекламних розсилок</li>
            <li>Телефонні розмови не записуємо</li>
          </ul>
          <p className={styles.revision}>Редакція від {REVISION}</p>
        </div>
      </section>

      <div className={`container ${styles.layout}`}>
        <nav className={styles.toc} aria-label="Розділи сторінки">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className={styles.content}>
          <section id="khto" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="building" />
              Хто обробляє дані
            </h2>
            <p>
              {ownerName(site.name)}
              {owner.registry && <> · {owner.registry}</>}
              {owner.address && <> · {owner.address}</>}
            </p>
            <p>
              Звʼязок: {site.phones.map((p) => p.label).join(", ")}
              {owner.email && <> · {owner.email}</>}
            </p>
          </section>

          <section id="shcho" className={styles.plain}>
            <h2 className={styles.h2}>
              <Icon name="pen" />
              Що збираємо
            </h2>
            <div className={styles.tiles}>
              {COLLECTED.map((c) => (
                <div key={c.title} className={`card ${styles.tile}`}>
                  <Icon name={c.icon} />
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="navishcho" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="target" />
              Навіщо
            </h2>
            <p>
              Щоб виконати ремонт, про який ви просите: передзвонити, назвати ціну, повідомити про
              готовність, надіслати пристрій і дотримати гарантію. Без телефону ми не можемо
              зробити нічого з цього.
            </p>
            <p>
              Пошту, профіль і сповіщення — щоб ви бачили хід ремонту в кабінеті, отримували
              знижки й не пропускали повідомлень майстра.
            </p>
            <p>
              Ми не надсилаємо рекламних розсилок, не продаємо й не передаємо дані нікому для
              реклами.
            </p>
          </section>

          <section id="pidstavy" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="pen" />
              На якій підставі
            </h2>
            <ul className={styles.facts}>
              <li>
                <b>Ремонт.</b> Дані із заявки потрібні, щоб виконати домовленість з вами: без них
                ремонт неможливий.
              </li>
              <li>
                <b>Акаунт, профіль, сповіщення й відгук.</b> За вашою згодою — ви вмикаєте їх
                самі й можете будь-коли вимкнути чи видалити.
              </li>
              <li>
                <b>Облік оплат.</b> Цього вимагає закон про податковий облік.
              </li>
              <li>
                <b>Захист від спаму й зламу.</b> Наш законний інтерес — щоб форми й вхід не
                заваливали автоматичними запитами.
              </li>
            </ul>
          </section>

          <section id="komu" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="share" />
              Кому дані стають доступні
            </h2>
            <p className={styles.note}>
              Сайт працює на чужій інфраструктурі, і ці компанії технічно мають доступ до того,
              що на ній зберігається. Кожна з них зобовʼязана захищати ці дані.
            </p>
            <ul className={styles.partners}>
              {PARTNERS.map((p) => (
                <li key={p.name}>
                  <span className={styles.letter} aria-hidden="true">
                    {p.name[0]}
                  </span>
                  <span>
                    <b>{p.name}</b>
                    <span>{p.what}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.after}>
              Сервери Vercel, Neon і Clerk розташовані за межами України — в ЄС і США. Дані
              потрапляють туди, бо без цього не працюють ні сайт, ні запис, ні кабінет: для
              ремонту — щоб виконати домовленість з вами, для акаунта й сповіщень — за вашою
              згодою.
            </p>
          </section>

          <section id="skilky" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="clock" />
              Скільки зберігаємо
            </h2>
            <ul className={styles.facts}>
              <li>
                <b>Заявка з ремонтом</b> — поки триває гарантія ({WARRANTY_MAX}) і ще рік після
                неї.
              </li>
              <li>
                <b>Заявка без ремонту</b> — рік від дня запису.
              </li>
              <li>
                <b>Дані про оплату</b> — 3 роки: такий строк вимагає закон про облік.
              </li>
              <li>
                <b>Акаунт і профіль</b> — поки ви ними користуєтесь.
              </li>
              <li>
                <b>Telegram і push</b> — поки не вимкнете або сервіс не повідомить, що адреса
                вже не діє.
              </li>
              <li>
                <b>Записи для захисту від спаму</b> — до доби.
              </li>
            </ul>
            <p>Якщо просите видалити раніше — видаляємо, чекати кінця строку не треба.</p>
          </section>

          <section id="cookie" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="cookie" />
              Cookie і памʼять браузера
            </h2>
            <ul className={styles.facts}>
              <li>
                <b>Вхід в акаунт.</b> Clerk ставить cookie, щоб ви лишались у кабінеті між
                візитами.
              </li>
              <li>
                <b>Заявка без акаунта.</b> Після запису браузер на добу запамʼятовує номер заявки
                — щоб, створивши акаунт, ви одразу побачили її в кабінеті.
              </li>
              <li>
                <b>Тема й підказки.</b> Світла чи темна тема й закриті підказки лежать лише у
                вашому браузері й до нас не надходять.
              </li>
            </ul>
            <p className={styles.note}>Рекламних і сторонніх відстежувальних cookie немає.</p>
          </section>

          <section id="statystyka" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="chart" />
              Статистика й захист від спаму
            </h2>
            <p>
              Ми рахуємо, які сторінки відкривають і на які кнопки натискають, щоб робити сайт
              зручнішим. Без cookie й без імен. Відвідувача розрізняємо за зашифрованим кодом з
              адреси в мережі й браузера, який щодня змінюється, — тож простежити вас між днями
              чи повʼязати запис із заявкою не можна. Саму адресу в статистиці не зберігаємо.
            </p>
            <p>
              Окремо, щоб форми й вхід не заваливали автоматичними запитами, ми рахуємо спроби з
              однієї адреси в мережі. Ці записи містять адресу й видаляються протягом доби.
            </p>
          </section>

          <section id="prava" className={`card ${styles.section} ${styles.rights}`}>
            <h2 className={styles.h2}>
              <Icon name="shield" />
              Ваші права
            </h2>
            <ul className={styles.facts}>
              <li>знати, які дані ми зберігаємо, звідки вони, навіщо й кому стають доступні;</li>
              <li>отримати їх копію;</li>
              <li>виправити неточні дані;</li>
              <li>забрати згоду — для акаунта, сповіщень чи відгуку;</li>
              <li>попросити видалити дані або обмежити їх обробку;</li>
              <li>
                поскаржитися Уповноваженому Верховної Ради України з прав людини або до суду.
              </li>
            </ul>
            <p>
              Назвіть номер замовлення або пошту акаунта. Відповімо якнайшвидше — не пізніше
              30 днів, як вимагає закон.
            </p>
            <p className={styles.note}>
              Видалення означає видалення: заявка зникає разом із листуванням і фото, не
              ховається з очей. Лишаємо тільки те, що закон велить зберігати для обліку оплат.
            </p>
            <div className={styles.actions}>
              <a href={phone.href} className="btn btn-accent">
                Подзвонити {phone.label}
              </a>
              {owner.email && (
                <a href={`mailto:${owner.email}`} className="btn btn-ghost">
                  {owner.email}
                </a>
              )}
            </div>
          </section>

          <section className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="pen" />
              Коли лишаєте заявку
            </h2>
            <p>
              Надсилаючи форму, ви погоджуєтесь, що ми оброблятимемо ці дані так, як описано вище.
              Це потрібно, щоб виконати ремонт.
            </p>
            <p>
              Записуватись можуть повнолітні. За дитину заявку лишають батьки або інші законні
              представники.
            </p>
          </section>

          <section id="zminy" className={`card ${styles.section}`}>
            <h2 className={styles.h2}>
              <Icon name="clock" />
              Зміни цієї сторінки
            </h2>
            <p>
              Чинна редакція — від {REVISION}. Якщо зміниться щось суттєве — що збираємо, кому
              передаємо чи скільки зберігаємо, — оновимо дату вгорі сторінки й опишемо, що саме
              змінилось.
            </p>
          </section>

          <footer className={styles.foot}>
            <p>Питання, на які тут немає відповіді, ставте напряму — {phone.label}.</p>
            <Link href="/" className={styles.link}>
              На головну
            </Link>
          </footer>
        </div>
      </div>
    </>
  );
}
