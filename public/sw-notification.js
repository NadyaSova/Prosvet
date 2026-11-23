// Подключается в service worker (vite.config.ts → workbox.importScripts).
// Нажатие на уведомление о конце таймера открывает приложение.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.length > 0) return windows[0].focus();
      return self.clients.openWindow(self.registration.scope);
    })(),
  );
});
