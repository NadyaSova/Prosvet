// Вход Google для сохранения в Drive (docs/phase2-plan.md §7).
// Client ID — из проекта в Google Cloud (инструкция — docs/google-drive-setup.md). Он не секрет: виден любому,
// кто откроет приложение; работает только с адреса, указанного в настройках проекта.
// Пустая строка — Drive не настроен, кнопки Drive в настройках не показываются.

export const GOOGLE_CLIENT_ID: string = '';

/** Доступ только к файлам, которые создало само приложение. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
