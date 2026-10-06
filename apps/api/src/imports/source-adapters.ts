import { detectSource, suggestedMapping } from './source-aliases.js';

export type SourceAdapter = {
  code: 'FACEBOOK_META' | 'INSTAGRAM_META' | 'EMAIL' | 'GENERIC';
  platform: string | null;
  canHandle: (columns: string[]) => boolean;
  suggestMapping: (columns: string[]) => Record<string, string>;
};

const adapters: SourceAdapter[] = [
  {
    code: 'EMAIL',
    platform: 'EMAIL',
    canHandle: (columns) => detectSource(columns).type === 'EMAIL',
    suggestMapping: suggestedMapping,
  },
  {
    code: 'FACEBOOK_META',
    platform: 'FACEBOOK',
    canHandle: (columns) =>
      columns.some((column) => /facebook/i.test(column)) &&
      !columns.some((column) => /instagram/i.test(column)),
    suggestMapping: suggestedMapping,
  },
  {
    code: 'INSTAGRAM_META',
    platform: 'INSTAGRAM',
    canHandle: (columns) => columns.some((column) => /instagram/i.test(column)),
    suggestMapping: suggestedMapping,
  },
  {
    code: 'GENERIC',
    platform: null,
    canHandle: () => true,
    suggestMapping: suggestedMapping,
  },
];

export function detectSourceAdapter(columns: string[]) {
  return (
    adapters.find((adapter) => adapter.canHandle(columns)) ??
    adapters[adapters.length - 1]
  );
}
