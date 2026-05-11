// Notification push pour les livreurs
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    vibrate: [200, 100, 200],
    data: { url: data.url ?? "/fr/driver/deliveries" },
    actions: [
      { action: "accept", title: "Accepter" },
      { action: "decline", title: "Refuser" },
    ],
  };
  event.waitUntil(self.registration.showNotification(data.title ?? "Dash Meal", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/fr/driver/deliveries";
  if (event.action === "accept") {
    event.waitUntil(clients.openWindow(url));
  }
});
