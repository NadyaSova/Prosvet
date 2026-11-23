// Галерея рисунков для отзыва на компьютере: все голуби, перья, плащ на всех стадиях.
// Только для разработки: npm run dev → http://localhost:5173/gallery.html. В приложение не входит.

import { render } from 'preact';
import '../styles.css';
import type { Feather } from '../logic/pigeons';
import { PIGEON_COLORS, PIGEON_POSES, PIGEON_SIZES, type PigeonColor, type PigeonLook } from '../model/types';
import { CloakArt } from '../ui/cloak-art';
import { PIGEON_COLOR_NAMES, PIGEON_SIZE_NAMES } from '../ui/labels';
import { FeatherArt, MessageScrollArt, PIGEON_PALETTE, PigeonArt, SIZE_SCALE } from '../ui/pigeon-art';

const POSE_NAMES: Record<PigeonLook['pose'], string> = {
  sit: 'сидит',
  preen: 'чистит перо',
  look: 'оглядывается',
};

/** Голубь шага 5 до правки шеи — для сравнения. */
function OldPigeon({ look }: { look: PigeonLook }) {
  const p = PIGEON_PALETTE[look.color];
  const s = SIZE_SCALE[look.size];
  const heads = {
    sit: (
      <g>
        <ellipse cx="66" cy="46" rx="11" ry="13" fill={p.neck} />
        <circle cx="72" cy="31" r="11" fill={p.body} stroke={p.line} stroke-width="1" />
        <path d="M82 29 L91 33 L82 36 Z" fill="#d8a48f" />
        <circle cx="81.5" cy="29.5" r="1.6" fill="#fff" />
        <circle cx="75" cy="29" r="2.4" fill="#e9925a" />
        <circle cx="75" cy="29" r="1.2" fill="#3b2f2a" />
      </g>
    ),
    look: (
      <g>
        <ellipse cx="64" cy="45" rx="11" ry="13" fill={p.neck} />
        <circle cx="62" cy="30" r="11" fill={p.body} stroke={p.line} stroke-width="1" />
        <path d="M52 28 L43 32 L52 35 Z" fill="#d8a48f" />
        <circle cx="52.5" cy="28.5" r="1.6" fill="#fff" />
        <circle cx="58" cy="28" r="2.4" fill="#e9925a" />
        <circle cx="58" cy="28" r="1.2" fill="#3b2f2a" />
      </g>
    ),
    preen: (
      <g>
        <ellipse cx="62" cy="47" rx="11" ry="11" fill={p.neck} />
        <circle cx="57" cy="40" r="10.5" fill={p.body} stroke={p.line} stroke-width="1" />
        <path d="M49 44 L43 51 L51 49 Z" fill="#d8a48f" />
        <circle cx="54" cy="38" r="2.2" fill="#e9925a" />
        <circle cx="54" cy="38" r="1.1" fill="#3b2f2a" />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 100 90" aria-hidden="true">
      <g transform={`translate(49 84) scale(${s}) translate(-49 -84)`}>
        <path d="M27 52 L6 59 L8 67 L30 61 Z" fill={p.wing} stroke={p.line} stroke-width="1" />
        <path d="M7 62 L9 67 L14 65.5 L12 60.5 Z" fill={p.bars} />
        <path d="M44 70 L42 83 M54 70 L56 83 M38 83 h8 M52 83 h8" stroke="#d9776b" stroke-width="2.4" stroke-linecap="round" fill="none" />
        <ellipse cx="48" cy="55" rx="26" ry="18" fill={p.body} stroke={p.line} stroke-width="1" />
        <path d="M28 49 Q48 36 66 50 Q57 66 30 61 Z" fill={p.wing} />
        <path d="M36 53 Q42 50 48 53 M34 57.5 Q41 54.5 47 57.5" stroke={p.bars} stroke-width="2.4" stroke-linecap="round" fill="none" />
        {heads[look.pose]}
      </g>
    </svg>
  );
}

/** Перья для плаща: разные цвета и размеры, каждое девятое — золотое. */
function sampleFeathers(n: number): Feather[] {
  return Array.from({ length: n }, (_, i) => ({
    pigeonId: `g${i}`,
    color: i % 9 === 4 ? 'gold' : PIGEON_COLORS[(i * 5) % 4]!,
    size: PIGEON_SIZES[(i * 7) % 3]!,
  }));
}

const CLOAK_STAGES = [
  { stage: 0, feathers: 3, label: '0–4 пера: накидка' },
  { stage: 1, feathers: 8, label: '5: Голубятница' },
  { stage: 2, feathers: 20, label: '15: Вестница' },
  { stage: 3, feathers: 35, label: '30: Хранительница перьев' },
  { stage: 4, feathers: 55, label: '50: Ловчая ветра' },
  { stage: 5, feathers: 80, label: '75: Крылатая странница' },
  { stage: 6, feathers: 105, label: '100: Повелительница ветров' },
];

const PERCH_SAMPLE: PigeonLook[] = [
  { pose: 'sit', size: 'large', color: 'slate' },
  { pose: 'preen', size: 'medium', color: 'white' },
  { pose: 'look', size: 'small', color: 'rose' },
  { pose: 'sit', size: 'medium', color: 'lilac' },
  { pose: 'preen', size: 'large', color: 'rose' },
];

/** Самые высокие голуби — большие в каждой позе: свиток не должен закрывать никого из них. */
const TALL_SAMPLE: PigeonLook[] = [
  { pose: 'sit', size: 'large', color: 'lilac' },
  { pose: 'preen', size: 'large', color: 'slate' },
  { pose: 'look', size: 'large', color: 'white' },
  { pose: 'sit', size: 'small', color: 'rose' },
  { pose: 'look', size: 'medium', color: 'slate' },
];

/** Жёрдочка с теми же стилями, что в голубятне. frame — прежнее выделение рамкой, для сравнения. */
function Perch({ picked, frame = false, looks = PERCH_SAMPLE }: { picked: number; frame?: boolean; looks?: PigeonLook[] }) {
  return (
    <div class={`perch ${frame ? 'gallery__perch--frame' : ''}`}>
      {looks.map((look, i) => (
        <div class={`perch__pigeon ${i === picked ? 'perch__pigeon--picked' : ''}`} key={i}>
          <PigeonArt class="perch__art" look={look} />
          {i === picked && !frame && <MessageScrollArt class="perch__scroll" />}
        </div>
      ))}
    </div>
  );
}

function Gallery() {
  return (
    <main class="gallery">
      <h1>Галерея рисунков</h1>
      <p class="muted">
        Страница только для разработки. Правки рисунков в <code>src/ui/pigeon-art.tsx</code> и <code>src/ui/cloak-art.tsx</code>{' '}
        видны здесь сразу, без перезагрузки.
      </p>

      <section class="card">
        <h2>Выбранный голубь, как в приложении (ширина телефона)</h2>
        <div class="gallery__perches">
          <figure>
            <Perch picked={1} frame />
            <figcaption class="muted small">было: рамка</figcaption>
          </figure>
          {PERCH_SAMPLE.map((look, i) => (
            <figure key={i}>
              <Perch picked={i} />
              <figcaption class="muted small">
                стало: свиток и свет — {POSE_NAMES[look.pose]}, {PIGEON_SIZE_NAMES[look.size]}
              </figcaption>
            </figure>
          ))}
        </div>
        <h3 class="gallery__row-title">Самые высокие голуби: большие, выбран каждый</h3>
        <div class="gallery__perches">
          {[0, 1, 2].map((i) => (
            <figure key={i}>
              <Perch looks={TALL_SAMPLE} picked={i} />
              <figcaption class="muted small">{POSE_NAMES[TALL_SAMPLE[i]!.pose]}, большой</figcaption>
            </figure>
          ))}
        </div>
        <h3 class="gallery__row-title">Свиток крупно</h3>
        <div class="gallery__scroll">
          <MessageScrollArt />
        </div>
      </section>

      <section class="card">
        <h2>Голуби: было и стало</h2>
        <div class="gallery__compare">
          {PIGEON_POSES.map((pose) =>
            PIGEON_COLORS.map((color: PigeonColor) => {
              const look: PigeonLook = { pose, size: 'large', color };
              return (
                <figure key={`${pose}-${color}`}>
                  <div class="gallery__pair">
                    <OldPigeon look={look} />
                    <PigeonArt look={look} />
                  </div>
                  <figcaption class="muted small">
                    {POSE_NAMES[pose]}, {PIGEON_COLOR_NAMES[color]}: было → стало
                  </figcaption>
                </figure>
              );
            }),
          )}
        </div>
      </section>

      <section class="card">
        <h2>Все голуби: 3 позы × 3 размера × 4 цвета</h2>
        {PIGEON_COLORS.map((color) => (
          <div key={color}>
            <h3 class="gallery__row-title">{PIGEON_COLOR_NAMES[color]}</h3>
            <div class="gallery__grid">
              {PIGEON_POSES.map((pose) =>
                PIGEON_SIZES.map((size) => (
                  <figure key={`${pose}-${size}`}>
                    <PigeonArt look={{ pose, size, color }} />
                    <figcaption class="muted small">
                      {POSE_NAMES[pose]}, {PIGEON_SIZE_NAMES[size]}
                    </figcaption>
                  </figure>
                )),
              )}
            </div>
          </div>
        ))}
      </section>

      <section class="card">
        <h2>Перья</h2>
        <div class="gallery__feathers">
          {(['slate', 'white', 'rose', 'lilac', 'gold'] as const).map((color) =>
            PIGEON_SIZES.map((size) => <FeatherArt key={`${color}-${size}`} color={color} size={size} />),
          )}
        </div>
      </section>

      <section class="card">
        <h2>Плащ по порогам</h2>
        <div class="gallery__cloaks">
          {CLOAK_STAGES.map((c) => (
            <figure key={c.stage}>
              <CloakArt feathers={sampleFeathers(c.feathers)} stage={c.stage} />
              <figcaption class="muted small">{c.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>
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
  .gallery__compare { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
  .gallery__pair { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .gallery__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; margin-bottom: 12px; }
  .gallery__row-title { margin: 8px 0 4px; font-size: 16px; }
  .gallery__feathers { display: grid; grid-template-columns: repeat(15, minmax(28px, 1fr)); gap: 6px; }
  .gallery__cloaks { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .gallery__perches { display: flex; flex-wrap: wrap; gap: 24px; }
  .gallery__perches figure { width: 340px; }
  .gallery .perch__art { width: 125%; margin-left: -12.5%; }
  .gallery .perch__scroll { width: 40%; }
  .gallery__perch--frame .perch__pigeon--picked { background: rgba(246, 193, 119, 0.35); box-shadow: inset 0 0 0 2px var(--color-sun); border-radius: 14px; }
  .gallery__perch--frame .perch__pigeon--picked::before { display: none; }
  .gallery__scroll { width: 200px; }
`;
document.head.append(style);

render(<Gallery />, document.getElementById('gallery')!);
