import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Звідки прийшла заявка — відповідає полю `source` у формах */
// manual — заявку завів сам майстер: клієнт подзвонив чи прийшов без запису
export const leadSource = pgEnum("lead_source", ["landing", "model", "services", "mail-in", "manual"]);

/**
 * Стадії обробки заявки майстром.
 * Порядок = шлях ремонту: прийняли → робимо → готово → (за потреби) відправили → закрили.
 */
export const leadStatus = pgEnum("lead_status", [
  "new",
  "in_progress",
  "ready",
  "shipped",
  "done",
  "rejected",
]);

/**
 * Знижка, закріплена за заявкою в момент замовлення: signup — 5% на перший
 * ремонт за реєстрацію, review — 10% за схвалений відгук, birthday — 10% біля
 * дня народження. Одна на заявку.
 */
export const leadDiscount = pgEnum("lead_discount", ["signup", "review", "birthday"]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * Короткий номер для клієнта: його диктують по телефону, пишуть у квитанції
     * і вводять у перевірку статусу на сайті. UUID для цього не годиться.
     */
    orderNo: integer("order_no").notNull().generatedByDefaultAsIdentity({
      name: "leads_order_no_seq",
      startWith: 1001,
    }),

    // Контакти клієнта
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),

    // Що саме треба
    model: text("model"),
    service: text("service"),
    problem: text("problem"),

    // Ремонт поштою
    city: text("city"),
    branch: text("branch"),

    /** ID клієнта в Clerk, якщо заявку лишив залогінений. NULL = анонімна заявка. */
    clerkUserId: text("clerk_user_id"),

    /** Клієнт попросив надіслати готовий пристрій Новою Поштою */
    deliveryRequested: boolean("delivery_requested").notNull().default(false),
    /** Куди слати — місто й відділення, які вказав клієнт */
    deliveryAddress: text("delivery_address"),
    /** Накладна Нової Пошти, коли майстер відправив */
    ttn: text("ttn"),

    /**
     * Гроші, у гривнях.
     * price клієнт бачить у кабінеті — це та сама «фіксована ціна», яку ми
     * обіцяємо не змінювати. partsCost і прибуток лишаються тільки в адмінці.
     */
    price: integer("price"),
    partsCost: integer("parts_cost"),

    /**
     * Передоплата за деталь — сума, яку клієнт вносить після погодження ціни,
     * до початку робіт. Окреме поле, а не partsCost: собівартість клієнт
     * бачити не повинен, а передоплату бачить.
     */
    prepayment: integer("prepayment"),
    /** Коли передоплата надійшла. NULL = ще чекаємо. */
    prepaidAt: timestamp("prepaid_at", { withTimezone: true }),

    /** Коли клієнт розрахувався повністю. NULL = ще не оплачено. */
    paidAt: timestamp("paid_at", { withTimezone: true }),

    /**
     * Коли клієнт сам натиснув у кабінеті «Я отримав гаджет». Заявку це не
     * закриває — видачу, оплату й гарантію й далі відмічає майстер, — але для
     * знижки за відгук такий ремонт уже вважається виданим.
     */
    receivedAt: timestamp("received_at", { withTimezone: true }),

    /**
     * Хто з майстрів узяв заявку — його пошта з ADMIN_EMAIL / ADMIN_EMAIL_2.
     * Пошта, а не імʼя чи номер у списку: вона не міняється, коли міняють
     * ADMIN_NAME або порядок акаунтів. NULL = ще ніхто не взяв.
     */
    assignee: text("assignee"),

    /**
     * Строк гарантії в днях, який обрав майстер (див. src/data/warranty.ts).
     * NULL — ще не обирав: строк береться за видом роботи.
     */
    warrantyDays: integer("warranty_days"),
    /** До якої дати діє гарантія. Ставиться при видачі; NULL — ще не видано або без гарантії. */
    warrantyUntil: timestamp("warranty_until", { withTimezone: true }),

    /** Яку знижку майстер має врахувати в ціні. NULL — без знижки. */
    discount: leadDiscount("discount"),

    /** Коли клієнт і майстер востаннє друкували в чаті — для «друкує…» */
    clientTypingAt: timestamp("client_typing_at", { withTimezone: true }),
    masterTypingAt: timestamp("master_typing_at", { withTimezone: true }),

    source: leadSource("source").notNull(),
    status: leadStatus("status").notNull().default("new"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Адмінка сортує за датою й фільтрує за статусом
    index("leads_created_at_idx").on(t.createdAt),
    index("leads_status_idx").on(t.status),
    // Кабінет вибирає заявки свого клієнта
    index("leads_clerk_user_idx").on(t.clerkUserId),
    index("leads_email_idx").on(t.email),
    // Перевірка статусу шукає заявку саме за цим номером
    uniqueIndex("leads_order_no_idx").on(t.orderNo),
  ],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

/** Відгук клієнта про роботу майстерні. Публікується лише після схвалення майстром. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * Акаунт автора. NULL — коли відгук додав майстер із адмінки:
     * людина лишила його усно, в месенджері або на Google-картці.
     */
    clerkUserId: text("clerk_user_id"),
    authorName: text("author_name").notNull(),
    /** Модель пристрою, якщо клієнт вказав — «iPhone 13» під відгуком */
    device: text("device"),
    /** Місто — «Оксана · Львів · iPhone 13» */
    city: text("city"),

    /** Відгук завів майстер вручну, а не сам клієнт через сайт */
    byMaster: boolean("by_master").notNull().default(false),

    /** Фото роботи у приватному сховищі — те саме, що й у чаті */
    imagePath: text("image_path"),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),

    /** Фото пристрою до і після ремонту, які додав сам клієнт — умова знижки */
    beforePath: text("before_path"),
    afterPath: text("after_path"),

    /** Виданий ремонт клієнта на момент відгуку. NULL — ремонту через сайт не було, знижки немає. */
    leadId: uuid("lead_id"),
    /** Коли нарахували знижку 10% — при схваленні відгуку з обома фото й виданим ремонтом */
    discountAt: timestamp("discount_at", { withTimezone: true }),
    /** Заявка, на яку майстер застосував знижку. NULL — знижка ще чекає. */
    discountLeadId: uuid("discount_lead_id"),

    rating: integer("rating").notNull(),
    text: text("text").notNull(),

    /** Автор увійшов поштою Gmail — показуємо значок «підтверджено Google» */
    viaGoogle: boolean("via_google").notNull().default(false),

    /**
     * Аватар з акаунта, якщо клієнт його ставив. Зберігаємо адресу на момент
     * відгуку: жива людина з обличчям переконує більше за літеру в кружечку.
     */
    avatarUrl: text("avatar_url"),

    /** Показувати на сайті. Нові відгуки чекають на схвалення. */
    published: boolean("published").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_published_idx").on(t.published),
    index("reviews_created_at_idx").on(t.createdAt),
  ],
);

export type Review = typeof reviews.$inferSelect;

/** Результат роботи для головної: фото до і після та короткий опис. Додає майстер. */
export const works = pgTable(
  "works",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** «iPhone 13 Pro» — заголовок картки */
    device: text("device").notNull(),
    /** Що зробили — пара речень під фото */
    text: text("text").notNull(),
    beforePath: text("before_path").notNull(),
    afterPath: text("after_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("works_created_at_idx").on(t.createdAt)],
);

export type Work = typeof works.$inferSelect;

/** Подія в хроніці ремонту — те, що клієнт бачить у кабінеті як стрічку подій */
export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),

    /** Текст для клієнта: «Погодили ціну», «Замінили модуль» */
    text: text("text").notNull(),

    /** Статус, у який перевели заявку разом із цією подією (якщо переводили) */
    status: leadStatus("status"),

    /** Подію створив майстер вручну, чи вона з'явилась автоматично при зміні статусу */
    byMaster: boolean("by_master").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_events_lead_idx").on(t.leadId, t.createdAt)],
);

export type LeadEvent = typeof leadEvents.$inferSelect;

/** Хто написав повідомлення в чаті ремонту */
export const messageAuthor = pgEnum("message_author", ["client", "master"]);

/**
 * Листування по конкретному ремонту. Прив'язка до заявки, а не до клієнта:
 * майстер одразу бачить, про який пристрій мова, і не питає зайвого.
 */
export const leadMessages = pgTable(
  "lead_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),

    author: messageAuthor("author").notNull(),
    text: text("text").notNull(),

    /**
     * Фото у приватному сховищі Vercel Blob. Зберігаємо шлях, а не готове
     * посилання: приватний файл усе одно віддається через наш API з перевіркою
     * прав, а підписані посилання протухають.
     */
    imagePath: text("image_path"),
    /** Розміри — щоб зарезервувати місце й стрічка не стрибала при завантаженні */
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),

    /** Коли другий бік прочитав. NULL = ще не бачив — з цього рахуємо лічильник. */
    readAt: timestamp("read_at", { withTimezone: true }),

    /** Реакції смайликом — по одній від кожного боку. NULL — не реагував. */
    clientReaction: text("client_reaction"),
    masterReaction: text("master_reaction"),

    /** Коли клієнту пішов лист, бо повідомлення майстра довго лишалось непрочитаним */
    emailedAt: timestamp("emailed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lead_messages_lead_idx").on(t.leadId, t.createdAt),
    // Лічильник непрочитаних питає саме за цією парою
    index("lead_messages_unread_idx").on(t.author, t.readAt),
  ],
);

export type LeadMessage = typeof leadMessages.$inferSelect;

/** Пристрій клієнта: зʼявляється, коли ремонт завершено, і несе дату кінця гарантії */
export const devices = pgTable(
  "devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    clerkUserId: text("clerk_user_id").notNull(),
    /** Заявка, після якої пристрій потрапив у список; без неї гарантії немає */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    /** Що саме робили — показуємо поруч із гарантією */
    work: text("work"),

    /** Кінець гарантії: від дати видачі, строк — за видом роботи */
    warrantyUntil: timestamp("warranty_until", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("devices_user_idx").on(t.clerkUserId, t.createdAt)],
);

export type Device = typeof devices.$inferSelect;

/**
 * Витрати сервісу, не привʼязані до конкретної роботи.
 *
 * Собівартість деталі живе в самій заявці (`partsCost`) — вона стосується
 * одного ремонту. Оренда, реклама чи інструмент стосуються місяця загалом,
 * і без них «чистими» в касі завищене.
 */
export const expenseCategory = pgEnum("expense_category", [
  "rent",
  "ads",
  "tools",
  "parts",
  "tax",
  "other",
]);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Дата витрати, а не запису: чек можна внести й наступного дня */
    spentAt: timestamp("spent_at", { withTimezone: true }).notNull().defaultNow(),

    amount: integer("amount").notNull(),
    category: expenseCategory("category").notNull().default("other"),
    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expenses_spent_at_idx").on(t.spentAt)],
);

export type Expense = typeof expenses.$inferSelect;

/**
 * Склад запчастин.
 *
 * Собівартість деталі майстер вписує в заявку з пам'яті, а скільки тих
 * деталей лишилось — не знає ніхто. Тут кожна позиція з кількістю й ціною
 * закупівлі: видно і залишок, і скільки грошей лежить на полиці.
 */
export const parts = pgTable(
  "parts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Що це: «Акумулятор», «Дисплей OLED» */
    name: text("name").notNull(),

    /** Під яку модель — окремо від назви, щоб шукати за моделлю */
    model: text("model"),

    qty: integer("qty").notNull().default(0),

    /** Скільки коштувала одна штука при закупівлі */
    unitCost: integer("unit_cost"),

    /** Нижче цього залишку позиція підсвічується як «час замовляти» */
    minQty: integer("min_qty").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("parts_name_idx").on(t.name)],
);

export type Part = typeof parts.$inferSelect;

/**
 * Лічильник звернень — для всього, що треба обмежувати за частотою:
 * спроби входу, заявки, пошук замовлень, повідомлення в чаті.
 *
 * Навмисно в базі, а не в памʼяті процесу: на Vercel інстансів кілька,
 * запити розкидає між ними, і памʼятний лічильник рахує з нуля на кожному.
 * Заміряно: з 30 спроб підбору проходило 15.
 *
 * Обсяг мізерний — кілька рядків на добу, рядки старші за вікно видаляються
 * одразу, — тож окреме сховище на кшталт Redis тут було б зайвим сервісом.
 */
export const rateHits = pgTable(
  "rate_hits",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Кого рахуємо: «login:email:…», «lead:ip:…», «order:ip:…» */
    subject: text("subject").notNull(),

    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_hits_subject_idx").on(t.subject, t.at)],
);

/**
 * Телефони майстрів, на які йдуть push-сповіщення.
 *
 * Один рядок — один пристрій одного майстра: браузер видає endpoint і ключі,
 * ми ними підписуємо повідомлення. Endpoint унікальний — повторне ввімкнення
 * на тому ж телефоні оновлює запис, а не плодить дублікати. Запис, на який
 * push-сервіс відповів «вже не існує», видаляється одразу при відправці.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Пошта майстра з ADMIN_EMAIL / ADMIN_EMAIL_2 */
    adminEmail: text("admin_email").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** Щоб у списку пристроїв було видно, що це за телефон */
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint)],
);

/**
 * Push-підписки клієнтів — окремо від майстерських: sendPush без адресата шле
 * на всі пристрої майстрів, і клієнти не мають отримувати їхні сповіщення.
 */
export const clientPushSubscriptions = pgTable(
  "client_push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_push_subscriptions_endpoint_idx").on(t.endpoint),
    index("client_push_subscriptions_user_idx").on(t.clerkUserId),
  ],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

/**
 * Чати клієнтів у Telegram, куди бот пише про зміну статусу.
 *
 * Клієнт натискає «Start» у боті за особистим посиланням — так зʼявляється
 * рядок. `subject` — за ким закріплений чат: телефон (тоді статуси приходять
 * і за наступними заявками з цього номера), акаунт або одна заявка, якщо
 * телефону немає. Формат — у src/lib/clientBot.ts.
 */
export const telegramChats = pgTable(
  "telegram_chats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subject: text("subject").notNull(),
    chatId: text("chat_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("telegram_chats_subject_idx").on(t.subject)],
);

/**
 * Анонімна статистика сайту: перегляди сторінок і кліки на головні кнопки.
 *
 * Без cookie й без персональних даних. Відвідувача розрізняємо за `visitor` —
 * хешем від адреси, браузера й дати з секретом: сама адреса не зберігається,
 * а наступного дня хеш уже інший, тож простежити людину між днями неможливо.
 * Через це «відвідувачі» за період — сума денних, а не унікальні люди.
 */
export const siteEvents = pgTable(
  "site_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** view — відкрили сторінку, click — натиснули кнопку з data-track */
    kind: text("kind").notNull(),
    path: text("path").notNull(),
    /** Назва кнопки з data-track; для переглядів порожньо */
    name: text("name"),
    visitor: text("visitor").notNull(),
    /** Чужий сайт, з якого прийшли (google.com); свій і прямий захід — NULL */
    referrer: text("referrer"),
    /** utm_source з адреси — для реклами й постів */
    utm: text("utm"),
    /** mobile | desktop */
    device: text("device").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("site_events_at_idx").on(t.at)],
);
