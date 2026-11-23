// Связь хранилища с браузером: защита от очистки и скачивание файла.

export type Persistence = 'persisted' | 'not-persisted' | 'unsupported';

/**
 * Просит браузер не удалять данные при нехватке места.
 * В Chrome на Android установленному приложению это обычно разрешается без вопросов.
 */
export async function requestPersistence(): Promise<Persistence> {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'persisted';
  return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
}

/** Скачивает текст как файл (на Android файл попадает в «Загрузки»). */
export function downloadText(text: string, fileName: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
