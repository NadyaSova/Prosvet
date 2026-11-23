// Мотивирующие фразы по контекстам SPEC.md §11. Сами фразы — в phrases.json.

import data from './phrases.json';

export type PhraseContext = 'start' | 'finish' | 'streak' | 'comeback' | 'idle' | 'pigeon_return' | 'golden_feather';

export const PHRASES: Record<PhraseContext, readonly string[]> = data;
