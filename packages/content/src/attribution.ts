/**
 * The attribution manifest (#122; spec §5.3, §14.4, D17): which sources and
 * licences a course's content comes from, for the in-game attribution screen.
 */
import {
  LICENCES,
  LICENSED_KINDS,
  SOURCES,
  type CoursePack,
  type Licence,
} from './index.ts';

/** One registered source, and how many of the course's items cite it. */
export interface AttributionSource {
  readonly id: string;
  readonly licence: Licence;
  readonly url: string;
  readonly items: number;
}

/** One licence in force, and how many of the course's items carry it. */
export interface AttributionLicence {
  readonly licence: Licence;
  readonly items: number;
}

/** A course's attribution manifest. */
export interface Attribution {
  readonly course: string;
  readonly items: number;
  readonly sources: readonly AttributionSource[];
  readonly licences: readonly AttributionLicence[];
  /** Registered sources no item cites: reported by the build, never shipped as credits. */
  readonly unused: readonly string[];
}

/** A source id is the part of an item's `source` before its first colon. */
const sourceIdOf = (source: string): string => source.split(':')[0] ?? '';

/**
 * The course's manifest, counted item by item over every licensed kind. It
 * reads only the registry and each item's source and licence: nothing about
 * review, so it can claim none (#122 AC4, Refs #51). A source missing from
 * the registry never reaches it: the licence gate refuses the build (#102).
 */
export function attributionOf(course: CoursePack): Attribution {
  const items = LICENSED_KINDS.flatMap((kind) => course[kind]);
  const bySource = new Map<string, number>();
  const byLicence = new Map<string, number>();
  for (const item of items) {
    const id = sourceIdOf(item.source);
    bySource.set(id, (bySource.get(id) ?? 0) + 1);
    byLicence.set(item.licence, (byLicence.get(item.licence) ?? 0) + 1);
  }
  const registered = Object.keys(SOURCES).sort((a, b) => a.localeCompare(b));
  return {
    course: course.id,
    items: items.length,
    sources: registered.flatMap((id) => {
      const source = SOURCES[id];
      const count = bySource.get(id) ?? 0;
      return source === undefined || count === 0
        ? []
        : [{ id, licence: source.licence, url: source.url, items: count }];
    }),
    licences: LICENCES.flatMap((licence) => {
      const count = byLicence.get(licence) ?? 0;
      return count === 0 ? [] : [{ licence, items: count }];
    }),
    unused: registered.filter((id) => !bySource.has(id)),
  };
}
