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

export const canShare = (): boolean => typeof navigator.share === 'function';

/**
 * «Поделиться» на Android: файлом, если браузер разрешает такой файл, иначе текстом
 * (Chrome делится не любыми файлами; Obsidian принимает текст и создаёт из него заметку).
 * false — пользователь закрыл окно, ничего не выбрав.
 */
export async function shareText(text: string, fileName: string, title: string, mime = 'text/markdown'): Promise<boolean> {
  const file = new File([text], fileName, { type: mime });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
    else await navigator.share({ title, text });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
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
