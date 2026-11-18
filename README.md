# GadgetFix — сайт сервісу ремонту Apple

Next.js 16 (App Router) + TypeScript. Реалізовано за `design/GadgetFix-Handoff.md` і макетами `design/*.dc.html`.

## Запуск

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # продакшн-збірка
npm run lint
```

## Сторінки

| URL | Файл | Тип |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | статична |
| `/poslugy` | `src/app/poslugy/page.tsx` | статична |
| `/modeli` | `src/app/modeli/page.tsx` | статична |
| `/modeli/{slug}` | `src/app/modeli/[slug]/page.tsx` | 42 статичні (SSG) |
| `/poshtoyu` | `src/app/poshtoyu/page.tsx` | статична |
| `/kabinet` | `src/app/kabinet/page.tsx` | динамічна, за авторизацією, `noindex` |
| `/vhid` | `src/app/vhid/page.tsx` | вхід клієнта за кодом на пошту, `noindex` |
| `/admin` | `src/app/admin/page.tsx` | заявки для майстра, `noindex` |
| `/admin/vhid` | `src/app/admin/vhid/page.tsx` | вхід майстра, `noindex` |

## Стилі

Дизайн-токени, типографіка й вісім keyframes зі специфікації — у `src/app/globals.css`
(CSS-змінні + спільні класи `.btn`, `.card`, `.chip`, `.field`, `.container`, `.kicker`).
Решта — CSS Modules поруч із компонентами. Tailwind не використовується: макети містять
точні CSS-значення, які переносяться один в один.

Підтримка `prefers-reduced-motion: reduce` глушить усі анімації й переходи глобально.

## Дані

- `src/data/models.ts` — 42 моделі. **Згенеровано** скриптом `scripts/extract-models.mjs` з макета каталогу.
- `src/data/services.ts` — 12 послуг з SVG-іконками. **Згенеровано** `scripts/extract-services.mjs`.
- Решта (`landing.ts`, `servicesPage.ts`, `mailIn.ts`, `account.ts`, `site.ts`) — редагується вручну.

Перегенерувати дані з макетів:

```bash
node scripts/extract-models.mjs
node scripts/extract-services.mjs
```

Контакти, телефони, години роботи, домен — у `src/data/site.ts`.

## API

| Роут | Метод | Стан |
| --- | --- | --- |
| `/api/lead` | POST | Пише заявку в Postgres, потім шле в Telegram (якщо задані токени). Якщо запис у базу впав — заявка все одно йде в Telegram, а помилка в лог: губити заявки не можна. |
| `/api/orders/{no}` | GET | **Заглушка**: повертає фіксоване замовлення. Структура відповіді фінальна. |

Форма заявки: `{ name, phone, email?, problem?, model?, service?, city?, branch?, source }`.
Валідація на сервері: ім'я + щонайменше один спосіб зв'язку (телефон ≥9 цифр **або** пошта),
інакше 422. Пошта потрібна, бо заявка з кабінету при email-вході приходить без телефону.

## База даних

Neon Postgres через Vercel Marketplace, ORM — Drizzle.

- `src/db/schema.ts` — таблиця `leads`. Enum `lead_source` (landing / model / services / mail-in)
  і `lead_status` (new / in_progress / done / rejected). Індекси на `created_at` і `status`.
- `src/db/index.ts` — лінива ініціалізація клієнта. **Без `Proxy`**: він ламає бібліотеки,
  що інспектують об'єкт клієнта.

```bash
npm run db:push     # накотити схему
npm run db:studio   # переглянути дані
```

`drizzle-kit` не читає `.env.local` сам — обидві команди йдуть через `dotenv-cli`.

## Як пов'язані заявка, адмінка й кабінет

Одна таблиця `leads` обслуговує обидві сторони:

- Клієнт лишає заявку. Якщо він **залогінений**, у рядок пишеться `clerk_user_id`
  і пошта з профілю — заявка стає видимою в його кабінеті.
- Якщо **не залогінений**, `clerk_user_id` лишається NULL, і заявка додатково
  йде в Telegram: ніде більше вона не «висить», тож майстер має дізнатись одразу.
  В адмінці такі рядки позначені `анонім`, решта — `кабінет`.
- Майстер міняє статус в адмінці → клієнт бачить нову стадію в себе. Проміжної
  синхронізації немає: кабінет читає ту саму таблицю (`dynamic = "force-dynamic"`).

Статуси мапляться на стадії, які бачить клієнт (`src/db/leads.ts`):

| Статус у базі | Клієнт бачить | Прогрес |
| --- | --- | --- |
| `new` | Прийнято | 25% |
| `in_progress` | У роботі | 65% |
| `done` | Готово | 100% |
| `rejected` | Закрито | — |

Кабінет шукає заявки і за `clerk_user_id`, і за поштою — щоб людина побачила те,
що лишала до реєстрації з тією самою адресою.

## Адмінка

`/admin` — одна сторінка: список заявок, найновіші зверху, нові підсвічені.
Статус міняється випадним списком, зберігається одразу (server action).
Свідомо без пошуку, фільтрів, пагінації й редагування — так замовлено.

Вхід окремий від Clerk: `/admin/vhid`, пошта + пароль із env.
Сесія — підписана HMAC-SHA256 httpOnly-cookie на 12 годин. Порівняння креденшелів
timing-safe, після невдалої спроби — затримка 0.7 с проти перебору.

Перевірено: підроблена cookie й прострочена (навіть з валідним підписом) відхиляються.

## Авторизація клієнтів

Clerk (`@clerk/nextjs` v7), вхід **за кодом на пошту** — без пароля.

- `src/middleware.ts` закриває `/kabinet`; неавторизованого кидає на `/vhid`
- `src/app/vhid/SignInForm.tsx` — двокроковий потік «пошта → код». Clerk не каже наперед,
  чи клієнт уже реєструвався, тому спершу пробуємо вхід, а на помилку — реєструємо.
  Ім'я запитуємо лише при першому вході, необов'язкове.
- `<div id="clerk-captcha" />` у формі — інакше Clerk падає на invisible-CAPTCHA і пише в консоль
- Вихід — `src/components/account/SignOutButton.tsx`

**Чому пошта, а не SMS.** Специфікація просила SMS-код, але Clerk блокує SMS в Україну:
`Cannot remove the following countries from the SMS blocklist without an upgraded plan: [UA]`.
Потрібен платний план плюс окреме звернення в їхню підтримку. Щоб перейти на SMS пізніше:
або активувати Україну в Clerk, або переписати `SignInForm` на український шлюз
(TurboSMS/SMS Club) з власним сховищем кодів. Утиліта `src/lib/phone.ts` — нормалізація
українських номерів в E.164 — уже написана й перевірена, вона знадобиться в обох випадках.

**Налаштування інстансу Clerk** (задане через `clerk config patch`, не руками в дашборді):
пароль вимкнено, `email_code` як єдина стратегія входу, `first_name` увімкнено й необов'язкове.

Тестування без реальних листів: адреса з `+clerk_test@` (напр. `bohdan+clerk_test@example.com`)
і код `424242`.

## Змінні оточення

Скопіюйте `.env.example` у `.env.local`:

- `NEXT_PUBLIC_SITE_URL` — продакшн-домен. Впливає на `canonical`, `sitemap.xml`, `robots.txt`.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — необов'язкові. Без них заявка все одно приймається.
- `DATABASE_URL` — Neon, провізовано через Marketplace.
- `ADMIN_EMAIL`, `ADMIN_EMAIL_2` — хто може увійти в `/admin` (кодом на цю пошту через Clerk). Порожні = адмінка закрита для всіх.
- `ADMIN_SESSION_SECRET` — підпис сесійної cookie, уже згенерований і заданий у Vercel.

**Увага:** `vercel env pull` перезаписує `.env.local` і виставляє порожні значення як `ADMIN_EMAIL=""`.
Після кожного pull перевірте, що ваші значення на місці.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — підтягуються `clerk env pull`.

Marketplace-інтеграцію Clerk знято: вона провізувала окремий accountless-застосунок, який не
дає міняти налаштування авторизації. Ключі застосунку `iFix` (`adapting-catfish-3035`) задані
у Vercel напряму для production / preview / development. Оновити їх: `vercel env add <NAME> <env> --force`.

Зараз ключі **development** (`pk_test_` / `sk_test_`) — у Clerk це окремий інстанс із лімітами.
Перед бойовим запуском створіть production-інстанс (`clerk deploy`) і замініть ключі на `pk_live_` / `sk_live_`.

## SEO

`title`/`description` на кожній сторінці, `canonical`, `sitemap.xml`, `robots.txt`.
Мікророзмітка: `LocalBusiness` (глобально в layout), `Service` (сторінка моделі),
`ItemList`/`Service` (послуги), `FAQPage` (головна, поштою). `/kabinet` закрито від індексації.

## Що лишилося зробити

### Чекає на домен

1. **Домен.** Поки сайт живе на адресі `ifix-….vercel.app`, яка змінюється з кожним
   деплоєм. `sitemap.xml` при цьому генерує посилання на вигаданий `ifix.ua`
   (значення за замовчуванням у `src/data/site.ts`). Коли буде домен — задати
   `NEXT_PUBLIC_SITE_URL` у Vercel.
2. **Email-сповіщення клієнту.** Коли майстер ставить «Готово» чи «Відправлено»,
   клієнт має отримати лист, а не дізнаватись про це лише зайшовши в кабінет.
   Робиться через Resend (безкоштовно до 3000 листів/міс), але листи мають іти
   з адреси на власному домені — інакше пошта отримувача їм не довіряє.
   Умови інтеграції ще не прийняті, сама інтеграція не встановлена.

### Чекає на контент від замовника

3. **Фото моделей.** Зараз 4 знімки з `public/assets/` циклічно на всіх 42 моделях.
   Реальні фото прогнати тим самим стисненням (`sips --resampleWidth 1800 -s formatOptions 72`).
4. **Решта контенту** (розділ 6 специфікації): фото «до/після», логотип у SVG,
   юридичний блок — політика конфіденційності, умови гарантії, ФОП-реквізити.

### Технічний борг

5. **Production-інстанс Clerk.** Зараз ключі development (`pk_test_` / `sk_test_`) —
   окремий інстанс із лімітами. Перед запуском: `clerk deploy`, повторити
   `clerk config patch` з passwordless-налаштуваннями, замінити ключі на `pk_live_`.
6. **Telegram-бот.** `TELEGRAM_BOT_TOKEN` і `TELEGRAM_CHAT_ID` порожні, тож
   сповіщення про анонімні заявки нікуди не йдуть. Самі заявки зберігаються
   в базі й видимі в адмінці.
7. **Обмеження частоти живе в памʼяті інстансу** (`src/lib/rateLimit.ts`).
   Для поточного потоку вистачає; при зростанні — замінити на Redis,
   інтерфейс лишиться тим самим.

## Папка `design/`

Оригінальні макети, `support.js` (рантайм Claude Design) і специфікація. Референс —
у збірку не потрапляє, з лінту виключена.
