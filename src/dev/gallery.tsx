// Галерея рисунков для отзыва на компьютере: здесь только то, что сейчас на рассмотрении.
// Одобренные разделы убираются со страницы; их файлы src/dev/gallery-*.tsx остаются — можно вернуть строкой ниже.
// Только для разработки: npm run dev → http://localhost:5173/gallery.html. В приложение не входит.

import { render } from 'preact';
import '../styles.css';
import { BossesSection } from './gallery-bosses';
import { GardensSection } from './gallery-gardens';
import { StopQuestionsSection, XpIconSection } from './gallery-reward';
import { ValleyLandmarksSection } from './gallery-valley-landmarks';

function Gallery() {
  return (
    <main class="gallery">
      <h1>Галерея рисунков</h1>
      <p class="muted">Страница только для разработки. Правки рисунков видны здесь сразу, без перезагрузки.</p>

      <ValleyLandmarksSection />

      <BossesSection />

      <GardensSection />

      <XpIconSection />

      <StopQuestionsSection />
    </main>
  );
}

// Один элемент стилей на страницу: при правке файла Vite перезапускает модуль без перезагрузки,
// и новый <style> добавлялся бы к старым — устаревшие правила продолжали бы действовать.
const style = document.getElementById('gallery-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-style' });
style.textContent = `
  .gallery { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; display: flex; flex-direction: column; gap: 16px; }
  .gallery figure { margin: 0; text-align: center; }
  .gallery svg { display: block; width: 100%; height: auto; }
  .gallery .valley .valley__scene { width: calc(100% * 960 / 380); height: 100%; }
  .gallery svg.valley__scene[style] { max-width: none; }
  .gallery__row-title { margin: 8px 0 4px; font-size: 16px; }
  .gallery__phones { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
  .gallery__phone { width: 380px; }
  .gallery__phone .screen { min-height: 780px; border: 1px solid var(--color-field-border); border-radius: 12px; }
  .gallery__phone .loot svg { width: auto; }
  .gallery__xp { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .gallery__xp-item { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .gallery .xp-icon { display: inline-block; width: var(--icon-size, 15px); height: var(--icon-size, 15px); }
  .gallery .gallery__xp-big { --icon-size: 56px; }
  .gallery__xp-note { transform: none; padding: 12px 16px; align-items: flex-end; animation: none; }
`;
document.head.append(style);

render(<Gallery />, document.getElementById('gallery')!);
