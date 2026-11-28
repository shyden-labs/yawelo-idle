/**
 * The roadmap's two estimates (#828): both from `packages/progress`, the
 * maths the close-outs print, so the page and the operator's figures cannot
 * disagree (#340). The voyage map (#1068) shows the tickets share as its
 * bar and the later of the two dates as its expected season.
 */
import {
  confidence,
  etaDate,
  type PublicProgress,
} from '@yawelo-idle/progress';

export type Confidence = ReturnType<typeof confidence>;

export interface Estimates {
  tickets: {
    percent: number;
    closed: number;
    total: number;
    eta: string | null;
    confidence: Confidence;
  };
  /** Points remaining, never a percentage (global rule, 2026-10-12). */
  effort:
    | { available: false; scored: number; open: number }
    | {
        available: true;
        pointsLeft: number;
        eta: string | null;
        confidence: Confidence;
        /** Closed stories with no estimate, counted at the scored mean. */
        assumedClosed: number;
        scoredMean: number;
      };
}

/** Both estimates, each with its ETA and how sure that ETA is. */
export function estimates(p: PublicProgress, today: string): Estimates {
  const t = p.tickets;
  const tickets = {
    percent: t.total === 0 ? 0 : Math.round((100 * t.closed) / t.total),
    closed: t.closed,
    total: t.total,
    eta: etaDate(t.total - t.closed, t.pace, today),
    confidence: confidence(t.pace),
  };
  const e = p.effort;
  if (!e.available) {
    return {
      tickets,
      effort: { available: false, scored: e.scored, open: e.open },
    };
  }
  return {
    tickets,
    effort: {
      available: true,
      pointsLeft: Math.round(e.openPoints),
      eta: etaDate(e.openPoints, e.pace, today),
      confidence: confidence(e.pace),
      assumedClosed: e.assumedClosed,
      scoredMean: e.scoredMean,
    },
  };
}
