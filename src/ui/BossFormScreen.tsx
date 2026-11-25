// Новый босс (docs/phase2-plan.md §5.1): название, конечный или бесконечный, ветка, необязательная заметка.
// Сооружение или место выбирает игра (logic/bosses.ts, chooseLandmark и chooseGarden).

import { useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import type { NewBoss } from '../logic/bosses';
import { BRANCHES, type Boss, type Branch } from '../model/types';
import { BackBar } from './common';
import { BRANCH_NAMES } from './labels';

const KINDS: { kind: Boss['kind']; label: string; hint: string }[] = [
  { kind: 'finite', label: 'Конечный', hint: 'У него есть конец: интервью, тестовое, резюме. Под туманом — сооружение, оно проступает с каждым подходом.' },
  { kind: 'endless', label: 'Бесконечный', hint: 'Тема, к которой возвращаешься: соседние роли, вилки, отрасли. В долине — место, которое наполняется.' },
];

export function BossFormScreen({ onCreate }: { onCreate: (input: NewBoss) => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Boss['kind'] | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [note, setNote] = useState('');
  const ready = title.trim() !== '' && kind !== null && branch !== null;

  return (
    <main class="screen form-screen">
      <BackBar title="Новый босс" />
      <form
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onCreate({ title, kind: kind!, branch: branch!, note });
        }}
      >
        <label class="field">
          <span class="field__label">Что за босс</span>
          <textarea
            rows={2}
            maxLength={BALANCE.bosses.titleMaxLength}
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
            placeholder="Например: интервью в «Ромашке»"
          />
        </label>

        <fieldset class="field">
          <legend class="field__label">Какой</legend>
          <div class="choices">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k.kind}
                class={`choice ${kind === k.kind ? 'choice--on' : ''}`}
                aria-pressed={kind === k.kind}
                onClick={() => setKind(k.kind)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p class="muted small">{KINDS.find((k) => k.kind === kind)?.hint ?? 'Конечный — с концом, бесконечный — тема без конца.'}</p>
        </fieldset>

        <fieldset class="field">
          <legend class="field__label">Ветка</legend>
          <div class="choices">
            {BRANCHES.map((b) => (
              <button
                type="button"
                key={b}
                class={`choice chip--${b} ${branch === b ? 'choice--on' : ''}`}
                aria-pressed={branch === b}
                onClick={() => setBranch(b)}
              >
                {BRANCH_NAMES[b]}
              </button>
            ))}
          </div>
        </fieldset>

        <label class="field">
          <span class="field__label">
            Заметка <span class="muted small">— можно пропустить</span>
          </span>
          <textarea
            rows={3}
            maxLength={BALANCE.bosses.noteMaxLength}
            value={note}
            onInput={(e) => setNote(e.currentTarget.value)}
            placeholder="С чего начать, что важно не забыть"
          />
        </label>

        <button type="submit" class="button" disabled={!ready}>
          Завести босса
        </button>
      </form>
    </main>
  );
}
