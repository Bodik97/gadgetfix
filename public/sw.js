/*
 * Service worker кабінету клієнта: приймає push (майстер написав, змінився
 * статус) і відкриває потрібну сторінку. Адмінка має свій, у /admin/.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "GadgetFix", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "GadgetFix", {
      body: data.body || "",
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: "/admin-icons/icon-192.png",
      badge: "/admin-icons/icon-192.png",
      data: { url: data.url || "/moi-remonty" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/moi-remonty", self.location.origin).href;

  event.waitUntil(
    (async () => {
      // Сайт уже відкритий — переводимо його на потрібну сторінку, а не відкриваємо другий
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (!new URL(client.url).pathname.startsWith("/admin") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
