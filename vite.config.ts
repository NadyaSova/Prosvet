import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// На GitHub Pages сайт живёт в подпапке с именем репозитория.
// Сборка в GitHub Actions передаёт её через BASE_PATH (например, "/prosvet/").
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      // Иконки генерируются из public/icon.svg по pwa-assets.config.ts.
      pwaAssets: { config: true },
      manifest: {
        name: 'Просвет',
        short_name: 'Просвет',
        description: 'Долина, которая оживает от каждого шага в поиске работы.',
        lang: 'ru',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        theme_color: '#F4E7D4',
        background_color: '#F4E7D4',
      },
      workbox: {
        // woff2 — шрифты (src/fonts.css): без них офлайн текст был бы системным шрифтом.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // Нажатие на уведомление о конце таймера открывает приложение.
        importScripts: ['sw-notification.js'],
      },
    }),
  ],
  test: {
    environment: 'node',
    // Пользователь живёт в Израиле: тесты дней и серии идут в этом часовом поясе, с переводом часов.
    env: { TZ: 'Asia/Jerusalem' },
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
