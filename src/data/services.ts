// Згенеровано з design/GadgetFix-Services.dc.html — scripts/extract-services.mjs

export type ServiceCat = "quick" | "board" | "body";

export type Service = {
  no: string;
  slug: string;
  cat: ServiceCat;
  title: string;
  body: string;
  tags: string[];
  time: string;
  /** Вміст <svg viewBox="0 0 24 24"> — обведення, без заливки */
  icon: string;
};

export const services: Service[] = [
  {
    "no": "01",
    "slug": "zamina-ekrana",
    "cat": "quick",
    "title": "Заміна екрана",
    "body": "Оригінальні дисплеї або якісні аналоги. Переносимо рідний Face ID, перевіряємо True Tone і сенсор.",
    "tags": [
      "Оригінал",
      "Аналог"
    ],
    "time": "до 2 днів",
    "icon": "<rect x=\"6\" y=\"2.5\" width=\"12\" height=\"19\" rx=\"2.5\"></rect><path d=\"M10.5 5.5h3\"></path>"
  },
  {
    "no": "02",
    "slug": "akumuliator",
    "cat": "quick",
    "title": "Акумулятор",
    "body": "Новий АКБ з нульовими циклами. Показуємо ємність до та після заміни у звіті.",
    "tags": [
      "0 циклів",
      "100% ємності"
    ],
    "time": "до 2 днів",
    "icon": "<rect x=\"2.5\" y=\"7\" width=\"16\" height=\"10\" rx=\"2.5\"></rect><path d=\"M21.5 10.5v3\"></path><path d=\"M6.5 12h5\"></path>"
  },
  {
    "no": "03",
    "slug": "roziem-zariadzhannia",
    "cat": "quick",
    "title": "Роз'єм заряджання",
    "body": "Не бачить кабель, гріється або заряджає лише під кутом. Спершу чистка — часто цього досить.",
    "tags": [
      "Чистка",
      "Заміна шлейфа"
    ],
    "time": "від 40 хв",
    "icon": "<path d=\"M8 3v5\"></path><path d=\"M16 3v5\"></path><path d=\"M5.5 8h13v4a6.5 6.5 0 0 1-13 0z\"></path><path d=\"M12 18.5V22\"></path>"
  },
  {
    "no": "04",
    "slug": "kamera",
    "cat": "quick",
    "title": "Камера і скло камери",
    "body": "Мутне фото, пил під склом, не працює автофокус — міняємо модуль або лише захисне скло.",
    "tags": [
      "Модуль",
      "Тільки скло"
    ],
    "time": "до 2 днів",
    "icon": "<rect x=\"2.5\" y=\"6\" width=\"19\" height=\"13\" rx=\"3\"></rect><circle cx=\"12\" cy=\"12.5\" r=\"3.5\"></circle>"
  },
  {
    "no": "05",
    "slug": "zalyv-vodoiu",
    "cat": "board",
    "title": "Залив водою",
    "body": "Приймаємо на діагностику: розбираємо, дивимось, що постраждало, і чесно кажемо, чи візьмемось. Якщо беремось — діагностика безкоштовна.",
    "tags": [
      "Терміново",
      "Діагностика"
    ],
    "time": "діагностика безкоштовна при ремонті",
    "icon": "<path d=\"M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z\"></path>"
  },
  {
    "no": "06",
    "slug": "ne-vmykaietsia",
    "cat": "board",
    "title": "Не вмикається",
    "body": "Чорний екран, циклічне перезавантаження, не бачить ПК. Перевіряємо акумулятор, екран і роз'єм; якщо справа в платі — скажемо прямо.",
    "tags": [
      "Діагностика"
    ],
    "time": "діагностика безкоштовна при ремонті",
    "icon": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5\"></path>"
  },
  {
    "no": "07",
    "slug": "ne-bachyt-merezhu",
    "cat": "board",
    "title": "Не бачить мережу",
    "body": "Немає SIM, зникає сигнал, не працює Wi-Fi чи Bluetooth. Перевіряємо SIM, налаштування й антени; чи візьмемось — скажемо після діагностики.",
    "tags": [
      "Діагностика"
    ],
    "time": "діагностика безкоштовна при ремонті",
    "icon": "<path d=\"M4 9a11 11 0 0 1 16 0\"></path><path d=\"M7.5 12.5a6.5 6.5 0 0 1 9 0\"></path><circle cx=\"12\" cy=\"17\" r=\"1.5\"></circle>"
  },
  {
    "no": "08",
    "slug": "dynamik-i-mikrofon",
    "cat": "quick",
    "title": "Динамік і мікрофон",
    "body": "Вас не чують, тихий розмовний динамік, хрипить музика — чистка сітки або заміна вузла.",
    "tags": [
      "Чистка",
      "Заміна"
    ],
    "time": "до 2 днів",
    "icon": "<path d=\"M4 9.5h3.5L12 5.5v13L7.5 14.5H4z\"></path><path d=\"M16 9.5a4 4 0 0 1 0 5\"></path>"
  },
  {
    "no": "09",
    "slug": "korpus",
    "cat": "body",
    "title": "Корпус і задня кришка",
    "body": "Тріщини на склі спинки, погнута рамка. Знімаємо лазером, ставимо нове скло.",
    "tags": [
      "Скло спинки",
      "Рамка"
    ],
    "time": "до 2 днів",
    "icon": "<rect x=\"6\" y=\"2.5\" width=\"12\" height=\"19\" rx=\"2.5\"></rect><path d=\"M9 7h2\"></path><path d=\"M9 10.5h4\"></path>"
  },
  {
    "no": "10",
    "slug": "knopky-y-vibro",
    "cat": "body",
    "title": "Кнопки й вібро",
    "body": "Не працює гучність, залипає бокова кнопка, зник Taptic — міняємо шлейф або модуль.",
    "tags": [
      "Шлейф",
      "Taptic"
    ],
    "time": "до 2 днів",
    "icon": "<rect x=\"6\" y=\"2.5\" width=\"12\" height=\"19\" rx=\"2.5\"></rect><path d=\"M3.5 8v3M3.5 13v2.5M20.5 9v4\"></path>"
  },
  {
    "no": "11",
    "slug": "vidnovlennia-danykh",
    "cat": "board",
    "title": "Відновлення даних",
    "body": "Телефон не вмикається, а всередині фото й контакти. Пробуємо оживити телефон заміною деталі й скопіювати дані.",
    "tags": [
      "Фото",
      "Контакти"
    ],
    "time": "діагностика безкоштовна при ремонті",
    "icon": "<ellipse cx=\"12\" cy=\"6\" rx=\"7\" ry=\"3\"></ellipse><path d=\"M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6\"></path><path d=\"M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3\"></path>"
  },
  {
    "no": "12",
    "slug": "profilaktyka",
    "cat": "quick",
    "title": "Профілактика",
    "body": "Чистка від пилу, заміна сітки динаміка, перевірка ємності АКБ і герметизація після розбирання.",
    "tags": [
      "Раз на рік"
    ],
    "time": "до 2 днів",
    "icon": "<circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2\"></path>"
  }
];

export const serviceCats: { id: ServiceCat | "all"; label: string }[] = [
  { id: "all", label: "Усі" },
  { id: "quick", label: "Прості заміни" },
  { id: "board", label: "Діагностика" },
  { id: "body", label: "Корпус" },
];
