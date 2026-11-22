/**
 * The expected season (#1068 AC6, spec §3; Shyden, 2026-11-22): the later of
 * the two forecasts, in halves of the year (January to June, July to
 * December), or null, which hides the line and its note, when either
 * forecast is missing.
 */
import type { Estimates } from './summary';

export interface Season {
  half: 1 | 2;
  year: number;
}

/** The first month of the second half, July, as `YYYY-MM-DD` reads it. */
const JULY = 7;

export function expectedSeason(e: Estimates): Season | null {
  if (!e.effort.available) return null;
  const { eta: tickets } = e.tickets;
  const { eta: effort } = e.effort;
  if (tickets === null || effort === null) return null;
  // ISO dates compare as text.
  const later = tickets > effort ? tickets : effort;
  const year = Number(later.slice(0, 4));
  const month = Number(later.slice(5, 7));
  return { half: month >= JULY ? 2 : 1, year };
}
