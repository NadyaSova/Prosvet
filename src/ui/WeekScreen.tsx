// Итоги недели (docs/phase2-plan.md §6): приложение показывает их само при первом открытии в новой неделе,
// и их можно открыть с экрана героини. Без награды: сколько времени и в каких ветках, что выросло в долине,
// боссы, голуби и перья; первым — костёр. Внизу — необязательная строка «Чего хочется на этой неделе?».

import { Fragment, type ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import type { Pigeon, PlantSize, ValleyPlant } from '../model/types';
import { cloakView } from '../logic/pigeons';
import type { WeekSummary } from '../logic/week';
import { BossArt } from './boss-art';
import { dateText, daysText, durationText, feathersText, fireText, plural, weekRangeText } from './format';
import { BRANCH_NAMES, valleyObjectName } from './labels';
import { Progress } from './common';
import { PALETTE } from './palette';
import { FeatherArt, PigeonArt } from './pigeon-art';
import { InkLine } from './RewardScreen';
import { FlameIcon } from './StreakBadge';
import { PlantArt } from './valley/plant-art';

/** Растения в ряд на полоске травы: место на одно растение по размеру (в единицах долины). */
const PLANT_STEP: Record<PlantSize, number> = { small: 15, medium: 21, large: 28 };
/** Высота самого большого дерева (в единицах долины) с запасом на крону, отступ по краям ряда. */
const TALLEST = 46;
const EDGE = 6;
/**
 * Масштаб — пикселей на единицу долины — по числу растений: чем их меньше, тем крупнее.
 * Порог — «не больше стольких растений». Решение пользователя (25.11.2026): крупнее, когда растений мало.
 */
const STRIP_SCALES: readonly [maxPlants: number, scale: number][] = [
  [3, 2.2],
  [6, 1.6],
  [10, 1.3],
  [Infinity, 1.05],
];
/** Полоска травы — в пикселях, одинаковая при любом масштабе. */
const GRASS_PX = 9;

const doneText = (n: number) => `${n} ${plural(n, ['дело', 'дела', 'дел'])}`;
const sessionsText = (n: number) => `${n} ${plural(n, ['подход', 'подхода', 'подходов'])}`;

/** Перо голубя: золотое, если позвали дальше. */
const featherColor = (p: Pigeon) => (p.outcome === 'invited' || p.lateInvite ? 'gold' : p.look.color);

/**
 * Растения недели в одну строку на полоске травы во всю ширину листа, ряд — по середине.
 * Растений мало — они крупнее (STRIP_SCALES). Сколько поместится — столько и нарисовано, по порядку посадки.
 */
function PlantStrip({ plants }: { plants: readonly ValleyPlant[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setPx(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = STRIP_SCALES.find(([max]) => plants.length <= max)![1];
  // Ряд в единицах долины: сколько поместится в ширину листа при этом масштабе.
  const room = px / scale - 2 * EDGE;
  let row = 0;
  const placed: { p: ValleyPlant; at: number }[] = [];
  for (const p of plants) {
    const step = PLANT_STEP[p.size];
    if (row + step > room) break;
    placed.push({ p, at: row + step / 2 });
    row += step;
  }
  // Рисунок — в пикселях: ряд растений по середине, трава внизу одинаковой толщины при любом масштабе.
  const ground = TALLEST * scale;
  const height = ground + GRASS_PX;
  const start = (px - row * scale) / 2;
  // Травинки — по постоянной сетке, чтобы полоска не менялась от раза к разу.
  const blades = Array.from({ length: Math.floor(px / 5) }, (_, i) => 3 + i * 5 + ((i * 7) % 3));
  return (
    <div class="week__plants" ref={ref}>
      {px > 0 && (
        <svg class="week__strip" viewBox={`0 0 ${px} ${height}`} style={{ height: `${height}px` }} aria-hidden="true">
          <rect x="0" y={ground - 1} width={px} height={GRASS_PX + 1} rx="3" fill={PALETTE.hillMid} />
          <rect x="0" y={ground - 1} width={px} height="2" rx="1" fill={PALETTE.leafLight} />
          {placed.map(({ p, at }) => (
            <g key={p.id} transform={`translate(${start + at * scale} ${ground}) scale(${scale})`}>
              <PlantArt kind={p.kind} size={p.size} seed={p.seed} />
            </g>
          ))}
          {blades.map((bx, i) => (
            <path
              key={i}
              d={`M${bx} ${ground + 1.5} l${i % 2 ? 0.8 : -0.8} -2.8`}
              stroke={PALETTE.leafDark}
              stroke-width="0.8"
              stroke-linecap="round"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

function TimeCard({ s }: { s: WeekSummary }) {
  const max = Math.max(1, ...s.branches.map((b) => b.minutes));
  return (
    <section class="card week__card">
      <h2>Время</h2>
      <p class="week__total">
        {s.minutes > 0 && <b>{durationText(s.minutes)}</b>}
        <span class="muted">
          {s.minutes > 0 ? ' · ' : ''}
          {doneText(s.done)} за {s.activeDays} {plural(s.activeDays, ['день', 'дня', 'дней'])}
        </span>
      </p>
      <div class="week__bars">
        {s.branches.map((b) => (
          <div class={`week__bar-row task--${b.branch}`} key={b.branch}>
            <span class="week__bar-name">{BRANCH_NAMES[b.branch]}</span>
            <span class="week__bar-track">
              {b.minutes > 0 && <span class="week__bar" style={{ width: `${(b.minutes / max) * 100}%` }} />}
            </span>
            <span class="week__bar-value small">{b.minutes > 0 ? durationText(b.minutes) : doneText(b.done)}</span>
          </div>
        ))}
      </div>
      {s.entries > 0 && (
        <p class="muted small week__line">
          Новых записей в Летописи: {s.entries}
        </p>
      )}
    </section>
  );
}

function ValleyCard({ s }: { s: WeekSummary }) {
  if (s.plants.length === 0 && s.decor.length === 0) return null;
  return (
    <section class="card week__card">
      <h2>В долине</h2>
      {s.plants.length > 0 && (
        <>
          <p class="week__line">
            Выросло {s.plants.length} {plural(s.plants.length, ['растение', 'растения', 'растений'])}
          </p>
          <PlantStrip plants={s.plants} />
        </>
      )}
      {s.decor.length > 0 && (
        <p class="week__line">
          {s.decor.length === 1 ? 'Появилась редкость' : 'Появились редкости'}: {s.decor.map(valleyObjectName).join(', ')}
        </p>
      )}
    </section>
  );
}

function BossesCard({ s }: { s: WeekSummary }) {
  if (s.bosses.length === 0) return null;
  return (
    <section class="card week__card">
      <h2>Боссы</h2>
      <div class="week__bosses">
        {s.bosses.map((b) => {
          const parts = [
            b.sessions > 0 && `${sessionsText(b.sessions)} · ${durationText(b.minutes)}`,
            b.isNew && 'новый',
          ].filter(Boolean);
          return (
            <div class={`boss-row week__boss task--${b.boss.branch}`} key={b.boss.id}>
              {b.boss.status !== 'released' ? <BossArt boss={b.boss} class="boss-row__art" still /> : <span class="boss-row__art boss-row__art--empty" />}
              <span class="boss-row__body">
                <span class="boss-row__title">{b.boss.title}</span>
                <span class="small">
                  {b.won && <span class="week__won">победа</span>}
                  {b.won && parts.length > 0 && <span class="muted"> · </span>}
                  <span class="muted">{parts.join(' · ')}</span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Исход вернувшегося голубя — коротко, справа в строке. Слова «отказ» нет (SPEC.md §9.4). */
function outcomeShort(p: Pigeon): string {
  if (p.outcome === 'invited' || p.lateInvite) return 'позвали дальше';
  if (p.outcome === 'silence') return `${daysText(BALANCE.pigeons.returnAfterDays)} тишины`;
  return 'пришёл ответ';
}

/** Строка голубя: значок, компания, справа серым — дата или исход. */
function PigeonLine({ icon, company, note, gold = false }: { icon: ComponentChildren; company: string; note: string; gold?: boolean }) {
  return (
    <div class="week__pigeon">
      <span class="week__pigeon-icon">{icon}</span>
      <span class="week__pigeon-company">{company}</span>
      <span class={`week__pigeon-note small${gold ? ' week__pigeon-note--gold' : ''}`}>{note}</span>
    </div>
  );
}

/**
 * Голуби: итог одной строкой (числа жирнее), ниже — кто улетел (голубь в своём виде, как в голубятне)
 * и кто вернулся (его перо), внизу — прогресс плаща из перьев.
 */
function PigeonsCard({ s }: { s: WeekSummary }) {
  if (s.sent.length === 0 && s.returned.length === 0 && s.flying === 0) return null;
  const golden = s.returned.filter((p) => featherColor(p) === 'gold').length;
  const totals = [
    s.sent.length > 0 && (
      <span key="sent">
        <b>{s.sent.length}</b> {plural(s.sent.length, ['улетел', 'улетели', 'улетели'])}
      </span>
    ),
    s.returned.length > 0 && (
      <span key="back">
        <b>{s.returned.length}</b> {plural(s.returned.length, ['вернулся', 'вернулись', 'вернулись'])}
      </span>
    ),
    golden > 0 && (
      <span key="gold" class="week__gold">
        <b>{golden}</b> {plural(golden, ['золотое перо', 'золотых пера', 'золотых перьев'])}
      </span>
    ),
  ].filter(Boolean);

  const cloak = cloakView(s.feathers);
  const from = BALANCE.cloak.thresholds[cloak.stage - 1]?.feathers ?? 0;

  return (
    <section class="card week__card">
      <h2>Голуби</h2>
      {totals.length > 0 && (
        <p class="week__totals">
          {totals.map((t, i) => (
            <Fragment key={i}>
              {i > 0 && <span class="muted"> · </span>}
              {t}
            </Fragment>
          ))}
        </p>
      )}
      {s.sent.length > 0 && (
        <div class="week__pigeons">
          <p class="week__group">Улетели</p>
          {s.sent.map((p) => (
            <PigeonLine key={p.id} icon={<PigeonArt look={p.look} />} company={p.company} note={dateText(p.sentAt)} />
          ))}
        </div>
      )}
      {s.returned.length > 0 && (
        <div class="week__pigeons">
          <p class="week__group">Вернулись</p>
          {s.returned.map((p) => (
            <PigeonLine
              key={p.id}
              icon={<FeatherArt class="week__feather-icon" color={featherColor(p)} size={p.look.size} />}
              company={p.company}
              note={outcomeShort(p)}
              gold={featherColor(p) === 'gold'}
            />
          ))}
        </div>
      )}
      <div class="week__cloak">
        <p class="small week__line">
          Плащ: {feathersText(cloak.feathers)}
          {cloak.next
            ? ` · до титула «${cloak.next.title}» ещё ${cloak.next.feathers - cloak.feathers}`
            : cloak.title && ` · «${cloak.title}»`}
        </p>
        {cloak.next && <Progress value={cloak.feathers - from} max={cloak.next.feathers - from} />}
      </div>
    </section>
  );
}

function FireCard({ s, today }: { s: WeekSummary; today: number }) {
  const v = s.streak;
  return (
    <section class="card week__card week__fire">
      <h2 class="week__streak" aria-label={`Серия: ${v.value} ${plural(v.value, ['день', 'дня', 'дней'])}`}>
        <FlameIcon fire={v.fire} class="week__flame" />
        {v.value}
      </h2>
      <p class="muted small week__line">{fireText(v, today, true, 'Костёр')}</p>
    </section>
  );
}

interface Props {
  summary: WeekSummary;
  /** Сегодня — для подписи костра. */
  today: number;
  /** Что хотелось на прошлой неделе — той, чьи итоги. */
  pastWish?: string;
  /** Что хочется на этой неделе: записанное и как записать. */
  wish?: string;
  onWish: (text: string) => void;
  onClose: () => void;
}

export function WeekScreen({ summary: s, today, pastWish, wish, onWish, onClose }: Props) {
  return (
    <main class="screen week">
      <header class="week__head">
        <p class="reward__kicker">Итоги недели</p>
        <h1 class="reward__title">{weekRangeText(s.week)}</h1>
      </header>

      <FireCard s={s} today={today} />

      {pastWish && (
        <p class="week__past-wish">
          <span class="muted small">Неделю назад хотелось:</span> {pastWish}
        </p>
      )}

      {s.done > 0 && <TimeCard s={s} />}
      <ValleyCard s={s} />
      <BossesCard s={s} />
      <PigeonsCard s={s} />

      <section class="reward-note week__wish">
        <InkLine
          question="Чего хочется на этой неделе?"
          hint="Одной строкой, для себя. Можно и пропустить."
          saved={wish}
          maxLength={BALANCE.week.wishMaxLength}
          button="Записать"
          onSave={onWish}
        />
      </section>

      <button type="button" class="button reward__next" onClick={onClose}>
        Дальше
      </button>
    </main>
  );
}
