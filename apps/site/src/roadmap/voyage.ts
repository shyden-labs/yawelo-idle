/**
 * What the voyage map (#1068) keeps of the old island model (#827): `fill`
 * for the copy's `{name}` slots, and the name an island shows while its
 * epic has no Public title (#844).
 */

/** `text` with each `{name}` replaced by `values[name]`; an unknown name stays. */
export function fill(
  text: string,
  values: Record<string, number | string>,
): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/** How the page names an island whose epic has no Public title yet (#844). */
export interface UnnamedCopy {
  /** With a milestone, e.g. "Milestone {n}". */
  unnamedIsland: string;
  /** With none. */
  unnamedNoMilestone: string;
}

/** The name the page shows for an island: its Public title, or a placeholder. */
export function islandName(
  island: { name: string | null; milestone: number | null },
  copy: UnnamedCopy,
): string {
  if (island.name !== null) return island.name;
  if (island.milestone !== null)
    return fill(copy.unnamedIsland, { n: island.milestone });
  return copy.unnamedNoMilestone;
}
