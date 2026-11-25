// Галерея: раздел «Боссы» (фаза 2, шаг 6) — плитка на главном, список, новый босс, экран босса, секундомер,
// награда за подход (правка времени и заметка пересчитывают её по-настоящему), победа.

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { addSession, createBoss, startStopwatch } from '../logic/bosses';
import { finishBossSession, winBossAction, type GameState } from '../logic/game';
import { createRng, pickFrom } from '../logic/rng';
import { emptyValley } from '../logic/valley';
import { createPlayer } from '../model/player';
import { GARDEN_KINDS, LANDMARK_KINDS, type Boss, type Branch, type GardenKind, type LandmarkKind } from '../model/types';
import { GardenArt, GARDEN_NAMES } from '../ui/valley/garden-art';
import { LandmarkArt, LANDMARK_NAMES } from '../ui/valley/landmark-art';
import { BossesScreen } from '../ui/BossesScreen';
import { BossFormScreen } from '../ui/BossFormScreen';
import { BossScreen } from '../ui/BossScreen';
import { BossVictoryScreen } from '../ui/BossVictoryScreen';
import { RewardScreen } from '../ui/RewardScreen';
import { SectionTiles } from '../ui/SectionTiles';
import { BossesIcon } from '../ui/section-icons';
import { StopwatchScreen } from '../ui/StopwatchScreen';

const NOW = new Date(2026, 10, 25, 12, 0).getTime();
const MIN = 60_000;
const DAY = 86_400_000;
const PHRASE = 'Туман отступил на шаг и сделал вид, что так и задумывал.';

const game = (): GameState => ({ player: createPlayer(), board: { taskIds: [], rerolls: null }, timer: null, valley: emptyValley() });

interface Spec {
  id: string;
  title: string;
  kind: Boss['kind'];
  branch: Branch;
  landmark?: LandmarkKind;
  garden?: GardenKind;
  /** Подходы: сколько дней назад и сколько минут, необязательная заметка. */
  sessions?: [days: number, minutes: number, note?: string][];
  note?: string;
  seed?: number;
}

function makeBoss(s: Spec): Boss {
  let b = createBoss([], { title: s.title, kind: s.kind, branch: s.branch, note: s.note }, NOW - 30 * DAY, createRng(s.seed ?? 3), s.id);
  if (s.landmark) b = { ...b, place: { ...b.place, landmark: s.landmark } };
  if (s.garden) b = { ...b, place: { ...b.place, garden: s.garden } };
  for (const [days, minutes, note] of s.sessions ?? []) b = addSession(startStopwatch(b, NOW - days * DAY), minutes, note);
  return b;
}

/** n подходов по 30 минут, последний — вчера. */
const many = (n: number, note?: string): [number, number, string?][] =>
  Array.from({ length: n }, (_, i) => [n - i, 30, i === n - 1 ? note : undefined]);

const INTERVIEW = makeBoss({
  id: 'interview', title: 'Интервью в «Ромашке»', kind: 'finite', branch: 'prep', landmark: 'windmill',
  note: 'Собеседование 2 декабря, 11:00. Продукт — сервис доставки.',
  sessions: [[6, 40, 'Посмотрела продукт, выписала вопросы'], [4, 25], [2, 50, 'Подобрала три истории из Летописи'], [1, 35, 'Прогнала рассказ о себе вслух']],
});
const FRESH = makeBoss({ id: 'fresh', title: 'Тестовое задание для «Лиры»', kind: 'finite', branch: 'craft', landmark: 'observatory' });
const RECORD = makeBoss({ id: 'record', title: 'Послужной список', kind: 'finite', branch: 'chronicle', landmark: 'rotunda', sessions: [[3, 45, 'Выписала три последних места работы']] });
const ROLES = makeBoss({ id: 'roles', title: 'Соседние роли', kind: 'endless', branch: 'scouting', garden: 'meadow', sessions: many(12, 'Solutions engineer — ближе всего к моему опыту') });
const MONEY = makeBoss({ id: 'money', title: 'Деньги: вилки по ролям', kind: 'endless', branch: 'scouting', garden: 'pond', sessions: many(3) });
const WON: Boss = {
  ...makeBoss({ id: 'won', title: 'Интервью в «Сосне»', kind: 'finite', branch: 'prep', landmark: 'pagoda', sessions: many(5) }),
  status: 'won', endedAt: NOW - 3 * DAY,
  victoryNote: 'Спрашивали про проектирование очереди задач и про конфликт в команде. Подтянуть: кеширование.',
};
const RELEASED: Boss = { ...makeBoss({ id: 'released', title: 'Интервью в «Клёне» (отменили)', kind: 'finite', branch: 'prep', landmark: 'bridge', sessions: many(2) }), status: 'released', endedAt: NOW - 9 * DAY };
const ARCHIVED: Boss = { ...makeBoss({ id: 'archived', title: 'Отрасли', kind: 'endless', branch: 'scouting', garden: 'meadow', sessions: many(7), seed: 9 }), status: 'archived', endedAt: NOW - 12 * DAY };

/**
 * Варианты ротонды: Rotunda в landmark-art.tsx берёт из генератора по сиду сначала купол (из трёх), потом розу
 * (слева, справа, нет). Тот же порядок здесь находит по сиду на каждое из девяти сочетаний.
 */
const DOMES = ['мраморный купол', 'медный купол', 'черепичный купол'];
const ROSES = ['роза слева', 'роза справа', 'без розы'];
const ROTUNDA_VARIANTS: { seed: number; label: string }[] = (() => {
  const found = new Map<string, number>();
  for (let seed = 1; found.size < 9 && seed < 500; seed++) {
    const rng = createRng(seed);
    const key = `${DOMES[pickFrom([0, 1, 2], rng)]}, ${ROSES[pickFrom([0, 1, 2], rng)]}`;
    if (!found.has(key)) found.set(key, seed);
  }
  return [...found].map(([label, seed]) => ({ label, seed })).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
})();

const RUNNING = startStopwatch(INTERVIEW, NOW - 23 * MIN - 14_000);

const LIST: Boss[] = [INTERVIEW, FRESH, RECORD, ROLES, MONEY, WON, RELEASED, ARCHIVED];

function Phone({ caption, children }: { caption: string; children: ComponentChildren }) {
  return (
    <figure class="gallery__phone">
      {children}
      <figcaption class="muted small">{caption}</figcaption>
    </figure>
  );
}

const noop = () => {};

/** Награда за подход: правка времени и заметка пересчитывают её с тем же сидом, как в приложении. */
function SessionReward({ boss, after, caption }: { boss: Boss; after: number; caption: string }) {
  const [fix, setFix] = useState<{ minutes?: number; note?: string }>({});
  const [seq, setSeq] = useState(0);
  const running = startStopwatch(boss, NOW);
  const r = finishBossSession(game(), [running], running.id, NOW + after * MIN, createRng(7), fix)!;
  return (
    <Phone caption={`${caption}. «Дальше» — вернуть как было`}>
      <RewardScreen
        key={seq}
        reward={{ ...r.done, phrase: PHRASE }}
        onClose={() => {
          setFix({});
          setSeq((n) => n + 1);
        }}
        onCorrect={(minutes) => setFix((f) => ({ ...f, minutes }))}
        onNote={(note) => setFix((f) => ({ ...f, note }))}
      />
    </Phone>
  );
}

function Victory() {
  const [seq, setSeq] = useState(0);
  const r = winBossAction(game(), [INTERVIEW], INTERVIEW.id, NOW, 'Спрашивали про очереди и про конфликт в команде.');
  return (
    <Phone caption="Победа: туман рассеивается. «Дальше» — показать ещё раз">
      <BossVictoryScreen key={seq} victory={{ boss: r.boss, report: r.report, phrase: PHRASE }} onClose={() => setSeq((n) => n + 1)} />
    </Phone>
  );
}

export function BossesSection() {
  return (
    <section class="card">
      <h2>Боссы</h2>
      <p class="muted small">
        Плитка на главном, список, новый босс, экран босса, секундомер, награда за подход и победа. Рисунки сооружений и мест — из дорожки
        «Рисунки»; в долину боссы встанут на шагах 7 и 8.
      </p>

      <h3 class="gallery__row-title">Плитка «Боссы» на главном: четыре в ряд, без чисел и с числами</h3>
      <div class="gallery__phones">
        <figure>
          <BossesIcon class="gallery__boss-icon" />
          <figcaption class="muted small">Иконка крупно</figcaption>
        </figure>
        <div class="gallery__phone gallery__tiles">
          <SectionTiles bosses={0} pigeonsInFlight={0} coupons={0} />
          <SectionTiles bosses={2} pigeonsInFlight={3} coupons={1} />
        </div>
        <div class="gallery__tiles gallery__tiles--narrow">
          <SectionTiles bosses={2} pigeonsInFlight={3} coupons={1} />
          <p class="muted small">Узкий телефон (360 px)</p>
        </div>
      </div>

      <h3 class="gallery__row-title">Ротонда для иконки: все купола и роза — крупно, размером иконки и на плитке</h3>
      <div class="gallery__boss-pics">
        {ROTUNDA_VARIANTS.map((v) => (
          <figure key={v.seed}>
            <svg viewBox="-45 -87 90 90" class="gallery__boss-pic gallery__boss-pic--square">
              <LandmarkArt kind="rotunda" seed={v.seed} size={100} />
            </svg>
            <div class="gallery__rotunda-tile section-tile section-tile--bosses">
              <span class="section-tile__open">
                <svg viewBox="-45 -87 90 90" class="section-tile__icon">
                  <LandmarkArt kind="rotunda" seed={v.seed} size={100} />
                </svg>
                <span class="section-tile__name">Боссы</span>
              </span>
            </div>
            <figcaption class="muted small">
              {v.label} · сид {v.seed}
              {v.seed === 11 && ' (сейчас)'}
            </figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">Доступные картинки боссов: крупно и размером иконки плитки (52 px)</h3>
      <div class="gallery__boss-pics">
        {LANDMARK_KINDS.map((k) => (
          <figure key={k}>
            <svg viewBox="-60 -100 120 100" class="gallery__boss-pic">
              <LandmarkArt kind={k} seed={3} size={100} />
            </svg>
            <svg viewBox="-60 -100 120 100" class="gallery__boss-pic-small">
              <LandmarkArt kind={k} seed={3} size={100} />
            </svg>
            <figcaption class="muted small">{LANDMARK_NAMES[k]}</figcaption>
          </figure>
        ))}
        {GARDEN_KINDS.map((k) => (
          <figure key={k}>
            <svg viewBox="-60 -60 120 60" class="gallery__boss-pic">
              <GardenArt kind={k} seed={3} size={60} count={12} special={2} bloom={0} still />
            </svg>
            <svg viewBox="-60 -60 120 60" class="gallery__boss-pic-small">
              <GardenArt kind={k} seed={3} size={60} count={12} special={2} bloom={0} still />
            </svg>
            <figcaption class="muted small">{GARDEN_NAMES[k]}</figcaption>
          </figure>
        ))}
      </div>

      <h3 class="gallery__row-title">Список и новый босс</h3>
      <div class="gallery__phones">
        <Phone caption="Пустой список. Кнопка «i» справа в шапке — пояснение">
          <BossesScreen bosses={[]} now={NOW} />
        </Phone>
        <Phone caption="Боссы в работе, идёт подход к интервью; внизу — архив (нажми)">
          <BossesScreen bosses={LIST.map((b) => (b.id === RUNNING.id ? RUNNING : b))} now={NOW} />
        </Phone>
        <Phone caption="Новый босс">
          <BossFormScreen onCreate={noop} />
        </Phone>
      </div>

      <h3 class="gallery__row-title">Экран босса</h3>
      <div class="gallery__phones">
        <Phone caption="Конечный, ещё без подходов: сплошной туман">
          <BossScreen boss={FRESH} now={NOW} blocked={null} onStart={noop} onWin={noop} onRelease={noop} onArchive={noop} />
        </Phone>
        <Phone caption="Конечный, 4 подхода: проступает силуэт. «Победа» — записка с заметкой">
          <BossScreen boss={INTERVIEW} now={NOW} blocked={null} onStart={noop} onWin={noop} onRelease={noop} onArchive={noop} />
        </Phone>
        <Phone caption="Бесконечный, 12 подходов: луг с бабочками">
          <BossScreen boss={ROLES} now={NOW} blocked={null} onStart={noop} onWin={noop} onRelease={noop} onArchive={noop} />
        </Phone>
        <Phone caption="Нельзя начать: идёт таймер задания">
          <BossScreen
            boss={MONEY}
            now={NOW}
            blocked="Сейчас идёт таймер задания — подход можно начать, когда он закончится."
            onStart={noop}
            onWin={noop}
            onRelease={noop}
            onArchive={noop}
          />
        </Phone>
        <Phone caption="Победа — в архиве, с заметкой">
          <BossScreen boss={WON} now={NOW} blocked={null} onStart={noop} onWin={noop} onRelease={noop} onArchive={noop} />
        </Phone>
        <Phone caption="Отпущен">
          <BossScreen boss={RELEASED} now={NOW} blocked={null} onStart={noop} onWin={noop} onRelease={noop} onArchive={noop} />
        </Phone>
      </div>

      <h3 class="gallery__row-title">Подход: секундомер и награда</h3>
      <div class="gallery__phones">
        <Phone caption="Секундомер: прошлый подход и его заметка">
          <StopwatchScreen boss={RUNNING} now={NOW} phrase="Начнём с малого. Туман тоже не сразу густел." onFinish={noop} onCancel={noop} back />
        </Phone>
        <Phone caption="Секундомер босса Летописи: можно открыть Летопись">
          <StopwatchScreen boss={startStopwatch(RECORD, NOW - 5 * MIN)} now={NOW} phrase="Шаг сделан." onFinish={noop} onCancel={noop} onJournal={noop} />
        </Phone>
        <SessionReward boss={INTERVIEW} after={40} caption="Подход к конечному, 40 минут: туман тоньше, записка для заметки" />
        <SessionReward boss={makeBoss({ id: 'r4', title: 'Соседние роли', kind: 'endless', branch: 'scouting', garden: 'meadow', sessions: many(4) })} after={25} caption="5-й подход к бесконечному: особый элемент и звезда" />
        <SessionReward boss={MONEY} after={3} caption="Короткий подход (3 минуты): без карты добычи" />
        <SessionReward boss={ROLES} after={200} caption="Забытый секундомер: засчитано 180 минут, можно поправить" />
        <Victory />
      </div>
    </section>
  );
}

const style = document.getElementById('gallery-bosses-style') ?? Object.assign(document.createElement('style'), { id: 'gallery-bosses-style' });
style.textContent = `
  .gallery .gallery__boss-icon { width: 120px; height: 120px; }
  .gallery__boss-pics { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; }
  .gallery__boss-pics figure { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .gallery .gallery__boss-pic { width: 160px; height: auto; }
  .gallery .gallery__boss-pic-small { width: 52px; height: auto; }
  .gallery .gallery__boss-pic--square { width: 120px; }
  .gallery__rotunda-tile { width: 84px; }
  .gallery__tiles { display: flex; flex-direction: column; gap: 12px; padding: 12px 16px; background: var(--color-sky); border-radius: 12px; }
  .gallery__tiles--narrow { width: 360px; }
  .gallery .gallery__phone .icon-button svg { width: 24px; height: 24px; }
  .gallery .info-button svg { width: 26px; height: 26px; }
  .gallery .section-tile__icon { width: 52px; height: 52px; }
  .gallery .boss-row__art { width: 84px; height: 64px; }
  .gallery .stopwatch__art { width: 240px; }
  .gallery .hero__chevron { width: 24px; height: 24px; }
`;
document.head.append(style);
