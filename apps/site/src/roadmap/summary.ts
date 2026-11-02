/**
 * The roadmap's summary (#828): what's left by epic, both estimates, what
 * shipped recently, how old the snapshot is, and what waits on decisions.
 * The estimates come from `packages/progress`, the maths the close-outs
 * print, so the page and the operator's figures cannot disagree (#340).
 */
import {
  confidence,
  etaDate,
  type BoardItem,
  type Progress,
} from '@yawelo-idle/progress';
import type { Voyage } from './voyage';

export interface LeftRow {
  epic: number;
  name: string;
  tickets: number;
  points: number;
}

export interface WhatsLeft {
  /** Every island before launch, most points left first. */
  rows: LeftRow[];
  /** Stories with no epic: counted, on no island. */
  other: { tickets: number; points: number };
  total: { tickets: number; points: number };
}

/** What's left, by epic, from the islands' own figures. */
export function whatsLeft(map: Voyage): WhatsLeft {
  const rows = map.islands
    .map((i) => ({
      epic: i.epic,
      name: i.name,
      tickets: i.ticketsLeft,
      points: i.pointsLeft,
    }))
    .sort((a, b) => b.points - a.points || a.epic - b.epic);
  const other = {
    tickets: map.other.ticketsLeft,
    points: map.other.pointsLeft,
  };
  const total = rows.reduce(
    (sum, r) => ({
      tickets: sum.tickets + r.tickets,
      points: sum.points + r.points,
    }),
    other,
  );
  return { rows, other, total };
}

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
export function estimates(p: Progress, today: string): Estimates {
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

const isEpic = (item: BoardItem): boolean => /^Epic\b/.test(item.title);

const SHIPPED = 10;

export interface Shipped {
  number: number;
  title: string;
  /** The UTC day it closed. */
  closedAt: string;
}

/** The last 10 stories closed as done that have a Public title. */
export function recentlyShipped(items: BoardItem[]): Shipped[] {
  return items
    .filter(
      (i): i is BoardItem & { publicTitle: string; closedAt: string } =>
        i.state === 'CLOSED' &&
        i.stateReason === 'COMPLETED' &&
        i.closedAt !== null &&
        i.publicTitle !== null &&
        !isEpic(i),
    )
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt) || b.number - a.number)
    .slice(0, SHIPPED)
    .map((i) => ({
      number: i.number,
      title: i.publicTitle,
      closedAt: i.closedAt.slice(0, 10),
    }));
}

/** The label an issue waiting on Shyden's decision carries (#826). */
export const WAITING_LABEL = 'waiting-on-shyden';

export interface Waiting {
  named: { number: number; title: string }[];
  /** Waiting issues with no Public title: counted, never named. */
  unnamed: number;
}

/** Open issues waiting on a decision, by Public title. */
export function waitingOnDecisions(items: BoardItem[]): Waiting {
  const waiting = items.filter(
    (i) => i.state === 'OPEN' && i.labels.includes(WAITING_LABEL),
  );
  return {
    named: waiting
      .filter(
        (i): i is BoardItem & { publicTitle: string } => i.publicTitle !== null,
      )
      .sort((a, b) => a.number - b.number)
      .map((i) => ({ number: i.number, title: i.publicTitle })),
    unnamed: waiting.filter((i) => i.publicTitle === null).length,
  };
}

/** Whole seconds since the snapshot was read; never below zero. */
export function secondsAgo(readAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(readAt)) / 1000));
}
