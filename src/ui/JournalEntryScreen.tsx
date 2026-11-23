// Запись Летописи: новая или правка. SPEC.md §10.1–10.2.
// Новая — одно обязательное поле «Что я сделала», остальное под «Подробнее»: запись за 30 секунд, черновиком.
// Правка — все части: контекст, как сделала, результат, навыки. Полная запись — когда заполнены три части.

import { useEffect, useRef, useState } from 'preact/hooks';
import { ENTRY_PARTS, MAX_SKILL_LENGTH, PART_LABELS, entryStatus, missingParts, normalizeSkills, parseSkillInput, type EntryFields, type EntryPart } from '../logic/journal';
import type { Achievement } from '../model/types';
import { BackBar } from './common';
import { dateText } from './format';

interface Props {
  /** Правка записи; нет — новая запись. */
  entry?: Achievement;
  /** Навыки из других записей — подсказки. */
  knownSkills: readonly string[];
  /** Пока открыта запись, вышло время таймера: награда покажется после. */
  rewardWaiting: boolean;
  onSave: (fields: EntryFields) => void;
  onDelete?: () => void;
}

const PLACEHOLDERS: Record<EntryPart, string> = {
  context: 'Проект, задача, в какой ситуации',
  action: 'Что конкретно сделала, какими средствами',
  result: 'Что изменилось — лучше с цифрами',
};

const MAX_TITLE = 500;
const MAX_PART = 3000;

/** «контекст, как сделала и результат». */
function partsList(parts: readonly EntryPart[]): string {
  const names = parts.map((p) => PART_LABELS[p].toLocaleLowerCase('ru'));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}` : names.join('');
}

export function JournalEntryScreen({ entry, knownSkills, rewardWaiting, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [parts, setParts] = useState<Record<EntryPart, string>>({
    context: entry?.context ?? '',
    action: entry?.action ?? '',
    result: entry?.result ?? '',
  });
  const [skills, setSkills] = useState<string[]>(entry?.skills ?? []);
  const [skillText, setSkillText] = useState('');
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const ready = title.trim() !== '';
  const isNew = !entry;

  // Курсор в поле при каждом открытии новой записи. Атрибут autofocus браузер выполняет только раз за страницу.
  useEffect(() => {
    if (isNew) titleRef.current?.focus();
  }, []);

  const missing = missingParts(parts);
  const chosen = new Set(skills.map((s) => s.toLocaleLowerCase('ru')));
  const suggestions = knownSkills.filter((s) => !chosen.has(s.toLocaleLowerCase('ru'))).slice(0, 12);

  function addSkills(list: readonly string[]) {
    setSkills((cur) => normalizeSkills([...cur, ...list]));
  }

  function commitSkillText() {
    if (skillText.trim() === '') return;
    addSkills(parseSkillInput(skillText));
    setSkillText('');
  }

  function save(e: Event) {
    e.preventDefault();
    if (!ready) return;
    // Сначала отпустить поле, чтобы клавиатура Android дописала слово и закрылась (см. LoftScreen).
    (document.activeElement as HTMLElement | null)?.blur();
    onSave({ title, ...parts, skills: [...skills, ...parseSkillInput(skillText)] });
  }

  const partFields = ENTRY_PARTS.map((p) => (
    <label class="field" key={p}>
      <span class="field__label">{PART_LABELS[p]}</span>
      <textarea
        rows={3}
        maxLength={MAX_PART}
        placeholder={PLACEHOLDERS[p]}
        value={parts[p]}
        onInput={(e) => {
          const v = e.currentTarget.value;
          setParts((cur) => ({ ...cur, [p]: v }));
        }}
      />
    </label>
  ));

  const skillsField = (
    <div class="field">
      <label class="field__label" for="skill-input">
        Навыки
      </label>
      {skills.length > 0 && (
        <div class="choices">
          {skills.map((s) => (
            <button
              type="button"
              key={s}
              class="choice choice--on chip--chronicle"
              aria-label={`Убрать навык ${s}`}
              onClick={() => setSkills((cur) => cur.filter((x) => x !== s))}
            >
              {s} ×
            </button>
          ))}
        </div>
      )}
      <div class="skill-add">
        <input
          id="skill-input"
          type="text"
          class="input"
          maxLength={MAX_SKILL_LENGTH * 4}
          placeholder="Например: TypeScript, CI"
          value={skillText}
          onInput={(e) => setSkillText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitSkillText();
            }
          }}
        />
        <button type="button" class="button button--secondary" disabled={skillText.trim() === ''} onClick={commitSkillText}>
          Добавить
        </button>
      </div>
      {suggestions.length > 0 && (
        <div class="choices">
          {suggestions.map((s) => (
            <button type="button" key={s} class="choice chip--chronicle" onClick={() => addSkills([s])}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main class="screen form-screen">
      <BackBar title={isNew ? 'Запись в Летопись' : 'Запись Летописи'} />
      {rewardWaiting && (
        <p class="notice" role="status">
          Время задания вышло. Награда ждёт — она появится, когда сохранишь или закроешь запись.
        </p>
      )}
      <form class="form" onSubmit={save}>
        {entry && (
          <p class="muted small">
            {dateText(entry.createdAt)} ·{' '}
            {entryStatus(parts) === 'complete' ? 'запись полная' : `черновик: допиши ${partsList(missing)}`}
          </p>
        )}
        <label class="field">
          <span class="field__label">Что я сделала</span>
          <textarea
            ref={titleRef}
            rows={isNew ? 3 : 2}
            maxLength={MAX_TITLE}
            placeholder="Коротко, своими словами"
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </label>

        {isNew ? (
          <details class="entry-more">
            <summary>Подробнее — можно дописать позже</summary>
            <div class="form entry-more__body">
              {partFields}
              {skillsField}
            </div>
          </details>
        ) : (
          <>
            {partFields}
            {skillsField}
          </>
        )}

        {isNew && (
          <p class="muted small">Запись засчитается как задание Летописи. Без подробностей она сохранится черновиком.</p>
        )}
        <button type="submit" class="button" disabled={!ready}>
          {isNew ? 'Записать' : 'Сохранить'}
        </button>
        {onDelete && (
          <button
            type="button"
            class="link-button entry-delete"
            onClick={() => {
              if (confirm('Удалить запись? Вернуть её будет нельзя.')) onDelete();
            }}
          >
            Удалить запись
          </button>
        )}
      </form>
    </main>
  );
}
