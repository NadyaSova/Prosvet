// Новый босс (docs/phase2-plan.md §5.1): название, конечный или бесконечный, ветка, необязательная заметка.
// Из шаблона (src/data/boss-templates.ts) вид и ветка готовы, а название подставлено — у интервью и тестового
// вписывается только компания. Сооружение или место выбирает игра (logic/bosses.ts, chooseLandmark и chooseGarden).

import { useState } from 'preact/hooks';
import { BALANCE } from '../config/balance';
import type { BossTemplate } from '../data/boss-templates';
import { bossFromTemplate, type NewBoss } from '../logic/bosses';
import { BRANCHES, type Boss, type Branch } from '../model/types';
import { BackBar, BranchChip } from './common';
import { BRANCH_NAMES } from './labels';

const KINDS: { kind: Boss['kind']; label: string; hint: string }[] = [
  { kind: 'finite', label: 'Конечный', hint: 'У него есть конец: интервью, тестовое, резюме. Под туманом — сооружение, оно проступает с каждым подходом.' },
  { kind: 'endless', label: 'Бесконечный', hint: 'Тема, к которой возвращаешься: соседние роли, вилки, отрасли. В долине — место, которое наполняется.' },
];

/** Место компании в названии из шаблона: «Интервью в компании «…»» — около 25 знаков. */
const COMPANY_MAX_LENGTH = BALANCE.bosses.titleMaxLength - 30;

interface Props {
  /** Без шаблона — свой босс: вид и ветку выбирает пользователь. */
  template?: BossTemplate;
  onCreate: (input: NewBoss) => void;
}

export function BossFormScreen({ template, onCreate }: Props) {
  const [title, setTitle] = useState(template && !template.company && template.id !== 'scouting-own' ? template.title : '');
  const [kind, setKind] = useState<Boss['kind'] | null>(template?.kind ?? null);
  const [branch, setBranch] = useState<Branch | null>(template?.branch ?? null);
  const [note, setNote] = useState('');
  const ready = title.trim() !== '' && kind !== null && branch !== null;

  const titleLabel = template?.company?.label ?? (template?.id === 'scouting-own' ? 'Какая тема' : 'Что за босс');
  const titlePlaceholder = template?.company ? 'Например: Ромашка' : template ? '' : 'Например: интервью в «Ромашке»';

  return (
    <main class="screen form-screen">
      <BackBar title={template ? template.title : 'Свой босс'} />
      <form
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onCreate(template ? bossFromTemplate(template, { title, note }) : { title, kind: kind!, branch: branch!, note });
        }}
      >
        {template && (
          <div class={`boss-form__template task--${template.branch}`}>
            <p class="boss-form__meta">
              <BranchChip branch={template.branch} />
              <span class="muted small">{template.kind === 'finite' ? 'конечный' : 'бесконечный'}</span>
            </p>
            <p class="small">{template.hint}</p>
          </div>
        )}

        <label class="field">
          <span class="field__label">{titleLabel}</span>
          {template?.company ? (
            <input
              type="text"
              class="input"
              maxLength={COMPANY_MAX_LENGTH}
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder={titlePlaceholder}
            />
          ) : (
            <textarea
              rows={2}
              maxLength={BALANCE.bosses.titleMaxLength}
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder={titlePlaceholder}
            />
          )}
        </label>

        {!template && (
          <>
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
              {kind && <p class="muted small">{KINDS.find((k) => k.kind === kind)?.hint}</p>}
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
          </>
        )}

        <label class="field">
          <span class="field__label">Заметка</span>
          <textarea
            rows={3}
            maxLength={BALANCE.bosses.noteMaxLength}
            value={note}
            onInput={(e) => setNote(e.currentTarget.value)}
            placeholder={template?.notePlaceholder ?? 'С чего начать, что важно не забыть'}
          />
        </label>

        <button type="submit" class="button" disabled={!ready}>
          Добавить
        </button>
      </form>
    </main>
  );
}
