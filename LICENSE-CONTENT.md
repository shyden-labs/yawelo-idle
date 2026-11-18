# Content licences

Yawelo Idle's **code** is licensed under Apache-2.0 (`LICENSE`). Its **course content** — lexicon items, example sentences, grammar nodes, culture cards, story lines, motifs and art under `packages/content` — and the game's **UI strings** under `packages/ui/src/i18n` are licensed **per item**. Every item records its licence and its source, and CI refuses an item whose licence is missing or not one of these two, an item citing a source not in the sources registry (`SOURCES` in `packages/content/src/index.ts`), and an item from a CC BY-SA source under any licence but CC BY-SA 4.0.

| Licence                                                                 | SPDX id           | Applies to                                                                                                                         | Full text                                                      |
| ----------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Creative Commons Attribution-ShareAlike 4.0 International               | `CC-BY-SA-4.0`    | Any item adapted from CC BY-SA material, such as Wiktionary or Kaikki extracts. ShareAlike requires it to stay under this licence. | [`LICENSES/CC-BY-SA-4.0.txt`](LICENSES/CC-BY-SA-4.0.txt)       |
| Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International | `CC-BY-NC-SA-4.0` | Original work by Shyden Labs: story lines, culture cards, motifs, art, original example sentences and UI strings.                  | [`LICENSES/CC-BY-NC-SA-4.0.txt`](LICENSES/CC-BY-NC-SA-4.0.txt) |

## Attribution

Attribute content to **"Yawelo Idle, Shyden Labs"**, together with the upstream source named in the item's `source` field. The game's attribution screen lists every source.

## Not licensed

The Yawelo Idle name and logo are not covered by either licence. See [`TRADEMARKS.md`](TRADEMARKS.md).

The promo video in `apps/site/media/` (all rights reserved, operator 2026-10-16) is not covered by either licence: it may be watched where it is published, and not reused. It also shows the Yawelo Idle wordmark.
