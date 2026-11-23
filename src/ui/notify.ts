// Сигнал о конце таймера: уведомление Android, если приложение свёрнуто, или вибрация, если открыто.
//
// Ограничение: без сервера push-уведомлений уведомление показывает сама страница. Если Android
// выгрузил её из памяти или «заморозил» в фоне, уведомление придёт позже или не придёт.
// Награда при этом не теряется: она выдаётся при следующем открытии приложения.

const VIBRATION = [300, 150, 300];

function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/** Спрашивает разрешение на уведомления (один раз; вызывать по нажатию кнопки). */
export async function askNotificationPermission(): Promise<void> {
  if (notificationsSupported() && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export async function signalTimerEnd(title: string): Promise<void> {
  if (document.visibilityState === 'visible') {
    navigator.vibrate?.(VIBRATION);
    return;
  }
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('Время вышло', {
    body: `«${title}» засчитано. Загляни за наградой.`,
    tag: 'prosvet-timer',
    icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
    // vibrate есть в Chrome на Android, но не в типах TypeScript.
    ...({ vibrate: VIBRATION } as object),
  });
}
