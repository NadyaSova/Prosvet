// Мгновенное задание Летописи: одна запись в журнал, одно поле. Запись сохраняется черновиком.
// Полный журнал (контекст, действия, результат, навыки) — шаг 7.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { TaskTemplate } from '../model/types';
import { BackBar } from './common';

export function JournalEntryScreen({ task, onSave }: { task: TaskTemplate; onSave: (title: string) => void }) {
  const [text, setText] = useState('');
  const ready = text.trim() !== '';
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Курсор в поле при каждом открытии экрана. Атрибут autofocus браузер выполняет только раз за страницу.
  useEffect(() => fieldRef.current?.focus(), []);

  return (
    <main class="screen form-screen">
      <BackBar title="Запись в журнал" />
      <form
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          // Сначала отпустить поле, чтобы клавиатура Android дописала слово и закрылась (см. LoftScreen).
          fieldRef.current?.blur();
          onSave(text.trim());
        }}
      >
        <p class="muted">{task.title}</p>
        <label class="field">
          <span class="field__label">Что я сделала</span>
          <textarea ref={fieldRef} rows={4} maxLength={500} value={text} onInput={(e) => setText(e.currentTarget.value)} />
        </label>
        <p class="muted small">Коротко, своими словами. Подробности можно дописать позже — запись сохранится черновиком.</p>
        <button type="submit" class="button" disabled={!ready}>
          Записать
        </button>
      </form>
    </main>
  );
}
