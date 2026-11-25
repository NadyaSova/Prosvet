// Новый босс, первый шаг (docs/phase2-plan.md §4, шаг 9): свой босс или шаблон — Летопись, Разведка, Подготовка.
// Шаблон открывает форму (BossFormScreen) с готовыми названием, видом и веткой. Разовый шаблон, босс которого
// в работе или побеждён, ведёт к этому боссу.

import { BOSS_TEMPLATES, OWN_SCOUTING, type BossTemplate } from '../data/boss-templates';
import { templateBoss } from '../logic/bosses';
import type { Boss, Branch } from '../model/types';
import { BackBar } from './common';
import { BRANCH_NAMES } from './labels';
import { replaceRoute } from './router';

const GROUPS: { branch: Branch; templates: readonly BossTemplate[] }[] = (['chronicle', 'scouting', 'prep'] as const).map((branch) => ({
  branch,
  templates: [...BOSS_TEMPLATES.filter((t) => t.branch === branch), ...(branch === 'scouting' ? [OWN_SCOUTING] : [])],
}));

const KIND_TEXT: Record<Boss['kind'], string> = { finite: 'конечный', endless: 'бесконечный' };

function TemplateRow({ template, existing }: { template: BossTemplate; existing?: Boss }) {
  // Форма и босс открываются вместо этого экрана: «Назад» с них ведёт в список боссов.
  const open = () => replaceRoute(existing ? `boss/${encodeURIComponent(existing.id)}` : `bosses/new/${template.id}`);
  return (
    <button type="button" class={`boss-row boss-row--template task--${template.branch}`} onClick={open}>
      <span class="boss-row__body">
        <span class="boss-row__title">{template.title}</span>
        <span class="small">{template.hint}</span>
        <span class="small">
          {existing ? (
            <span class="boss-row__existing">{existing.status === 'won' ? 'уже побеждён — открыть' : 'уже в работе — открыть'}</span>
          ) : (
            <span class="muted">{KIND_TEXT[template.kind]}</span>
          )}
        </span>
      </span>
    </button>
  );
}

export function BossTemplatesScreen({ bosses }: { bosses: readonly Boss[] }) {
  return (
    <main class="screen bosses">
      <BackBar title="Новый босс" />

      <button type="button" class="button" onClick={() => replaceRoute('bosses/new/own')}>
        Свой босс
      </button>

      {GROUPS.map((g) => (
        <section key={g.branch} class="bosses__group">
          <h2>{BRANCH_NAMES[g.branch]}</h2>
          {g.templates.map((t) => (
            <TemplateRow key={t.id} template={t} existing={templateBoss(bosses, t)} />
          ))}
        </section>
      ))}
    </main>
  );
}
