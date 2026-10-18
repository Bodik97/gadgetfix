/*
 * Service worker адмінки: приймає push і відкриває потрібну заявку.
 *
 * Лежить у /admin/, тож діє лише на адмінку — публічний сайт не зачіпає.
 * Працює й тоді, коли застосунок закритий: телефон будить його сам.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "GadgetFix", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "GadgetFix", {
        body: data.body || "",
        tag: data.tag,
        // Нагадування з тим самим tag має знову привернути увагу, а не тихо замінити
        renotify: Boolean(data.tag),
        // На Android сповіщення не зникає саме, доки майстер його не торкнеться
        requireInteraction: true,
        icon: "/admin-icons/icon-192.png",
        badge: "/admin-icons/icon-192.png",
        data: { url: data.url || "/admin" },
      });
      // Кажемо відкритій адмінці, що push дійшов саме сюди: якщо банера не видно,
      // справа в налаштуваннях сповіщень системи, а не в сайті
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "push-shown", tag: data.tag || null });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin", self.location.origin).href;

  event.waitUntil(
    (async () => {
      // Застосунок уже відкритий — переводимо його на заявку, а не відкриваємо другий
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).pathname.startsWith("/admin") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
