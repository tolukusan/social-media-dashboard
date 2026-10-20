import { validDay } from './account-contract.js';

export type MetaProvider = 'INSTAGRAM' | 'FACEBOOK';

export type SyncChunk = {
  sequence: number;
  from: string;
  to: string;
};

export function planMetaHistory(
  provider: MetaProvider,
  from: string,
  to: string,
  today: string,
): { fetchFrom: string | null; fetchTo: string | null; chunks: SyncChunk[] } {
  const day = (value: string) => new Date(`${validDay(value)}T00:00:00.000Z`);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  const shift = (value: string, amount: number) => {
    const result = day(value);
    result.setUTCDate(result.getUTCDate() + amount);
    return format(result);
  };
  const start = validDay(from);
  const end = validDay(to);
  const currentDay = validDay(today);
  const fetchFloor = provider === 'INSTAGRAM' ? shift(currentDay, -89) : start;
  const fetchFrom = start > fetchFloor ? start : fetchFloor;
  const fetchTo = end < currentDay ? end : currentDay;
  if (fetchFrom > fetchTo)
    return { fetchFrom: null, fetchTo: null, chunks: [] };

  const chunks: SyncChunk[] = [];
  const chunkDays = provider === 'INSTAGRAM' ? 1 : 30;
  let chunkTo = fetchTo;
  while (chunkTo >= fetchFrom) {
    const candidateFrom = shift(chunkTo, -(chunkDays - 1));
    const chunkFrom = candidateFrom > fetchFrom ? candidateFrom : fetchFrom;
    chunks.push({
      sequence: chunks.length,
      from: chunkFrom,
      to: chunkTo,
    });
    chunkTo = shift(chunkFrom, -1);
  }
  return { fetchFrom, fetchTo, chunks };
}
