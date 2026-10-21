import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #375's mutations (the core and lockdown absence floors), each predicted
 * before it first ran on 2026-10-21. A floored population loses one member
 * and goes red through its own floor, past every check ahead of it; a
 * one-member population takes a loss (refused by `searched`) and a growth
 * (the floor). Each `againstControl` loses its control. Every figure was
 * measured on the branch before these were written: automation 6, hash 60
 * (NUMERIC_FLOOR 59), ladder 16 (four Encounters of four keys), log 12,
 * sail destinations 12, words held 8, Encounters 3, shop grammar 12, slots
 * 3, Encounter offers 6, words held 5, review and lockdown 1 each.
 */
const AUTOMATION =
  'packages/core/test/automation.test.ts › integrate with Pemandu (AC2) > buys nothing when nothing is owned and nothing is affordable';
const CARDS =
  'packages/core/test/cards.test.ts › the cards line (AC4) > is not shown while no card is held';
const GRAMMAR =
  'packages/core/test/grammar.test.ts › rootFactors (#32 AC2) > is empty with no node owned';
const HASH =
  'packages/core/test/hash.test.ts › stateHash (AC4) > changes when any numeric field moves by one ulp';
const LADDER =
  'packages/core/test/ladder.test.ts › resolveCourse prices each Encounter from its tier and region > carries no tier into the course core plays';
const LOG =
  'packages/core/test/log.test.ts › a refused event leaves state unchanged (AC2) > a log with a refused event inserted replays to the state without it';
const REVIEW =
  'packages/core/test/review.test.ts › the review queue (AC6) > is empty when nothing is due';
const SAIL_D1 =
  'packages/core/test/sail.test.ts › the goal (AC1) > never needs a review: unreviewed words and no Insight still sail (D1)';
const SAIL_JOURNEY =
  'packages/core/test/sail.test.ts › a sail resets only Encounters and Understanding (AC3, DN3) > owns no Encounters and holds only the starting grant, with nothing spent';
const SAIL_PREVIEW =
  'packages/core/test/sail.test.ts › the preview (AC2, DN3) > resets exactly the Encounters owned and the Understanding held';
const SHOP_GRAMMAR =
  'packages/core/test/shop.test.ts › the grammar offers match buying a node > is not affordable before grammar opens, however much Insight is held';
const SHOP_JOURNEYS =
  'packages/core/test/shop.test.ts › the Journey offers match starting a Journey > offers nothing while every open slot is busy';
const SHOP_PRACTICE =
  'packages/core/test/shop.test.ts › the Practice offer matches practising a word > stays on offer with nothing else affordable, as Practice costs nothing';
const WORDS =
  'packages/core/test/words.test.ts › picking up a word (AC1) > is refused when the pool is empty, never reaching a later destination';
const NO_CREDENTIALS =
  'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges no credentials on a non-prod host and never serves';
const WRONG_PASSWORD =
  'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges a wrong password on a non-prod host and never serves';
const UNCONFIGURED =
  'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges every request when the password is not configured';
const ROBOTS_WEB =
  'packages/lockdown/test/lockdown.test.ts › gateWebRequest > serves blocking robots.txt on a non-prod host without credentials';
const ROBOTS_SYNC =
  'packages/lockdown/test/lockdown.test.ts › markApiRequest > serves blocking robots.txt on a non-prod host';

const SAIL_FROM =
  'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination';

export default mutationFile({
  targets: [
    'packages/core/test/automation.test.ts',
    'packages/core/test/cards.test.ts',
    'packages/core/test/grammar.test.ts',
    'packages/core/test/hash.test.ts',
    'packages/core/test/ladder.test.ts',
    'packages/core/test/log.test.ts',
    'packages/core/test/review.test.ts',
    'packages/core/test/sail.test.ts',
    'packages/core/test/shop.test.ts',
    'packages/core/test/words.test.ts',
    'packages/lockdown/test/lockdown.test.ts',
  ],
  mutations: [
    {
      name: 'A1-course-encounters-lose-one',
      file: 'packages/core/test/automation.test.ts',
      anchor:
        '    const encounters = course.regions.flatMap((r) =>\n      r.encounters.map((e) => e.id),\n    );\n',
      replacement:
        '    const encounters = course.regions.flatMap((r) =>\n      r.encounters.map((e) => e.id),\n    ).slice(1);\n',
      red: {
        [AUTOMATION]: 'automation/encounters in the course: read 5, recorded 6',
      },
    },
    {
      name: 'C1-cards-control-empty',
      file: 'packages/core/test/cards.test.ts',
      anchor: "        { input: [], control: ['satay'] },\n",
      replacement: '        { input: [], control: [] },\n',
      red: { [CARDS]: 'the control found nothing' },
    },
    {
      name: 'G1-grammar-control-empty',
      file: 'packages/core/test/grammar.test.ts',
      anchor: "        { input: [], control: ['me-'] },\n",
      replacement: '        { input: [], control: [] },\n',
      red: { [GRAMMAR]: 'the control found nothing' },
    },
    {
      name: 'H1-state-loses-a-numeric-field',
      file: 'packages/core/test/hash.test.ts',
      anchor:
        '    const state = lived(course());\n    const original = stateHash(state);\n    const leaves = numericLeaves(state);\n',
      replacement:
        '    const { stampsEarned: _dropped, ...state } = lived(course());\n    const original = stateHash(state);\n    const leaves = numericLeaves(state);\n',
      red: { [HASH]: 'hash/numeric fields: read 59, recorded 60' },
    },
    {
      name: 'L1-keys-lose-the-ids',
      file: 'packages/core/test/ladder.test.ts',
      anchor: '      r.encounters.flatMap((e) => Object.keys(e)),\n',
      replacement:
        "      r.encounters.flatMap((e) => Object.keys(e).filter((k) => k !== 'id')),\n",
      red: { [LADDER]: 'ladder/encounter keys: read 12, recorded 16' },
    },
    {
      name: 'O1-replay-loses-the-last-event',
      file: 'packages/core/test/log.test.ts',
      anchor:
        '    const renumbered = events.map((e) => ({ ...e, seq: e.seq * 2 }));\n',
      replacement:
        '    const renumbered = events\n      .slice(0, -1)\n      .map((e) => ({ ...e, seq: e.seq * 2 }));\n',
      red: {
        [LOG]: 'log/events replayed without the refusal: read 11, recorded 12',
      },
    },
    {
      name: 'R1-review-control-empty',
      file: 'packages/core/test/review.test.ts',
      anchor: "        { input: {}, control: { x: word('heard', 2) } },\n",
      replacement: '        { input: {}, control: {} },\n',
      red: { [REVIEW]: 'the control found nothing' },
    },
    {
      name: 'R2-waiting-words-loss',
      file: 'packages/core/test/review.test.ts',
      anchor: '    const ids = Object.keys(waiting);\n',
      replacement: '    const ids = Object.keys(waiting).slice(1);\n',
      red: { [REVIEW]: 'searched no words not yet due' },
    },
    {
      name: 'R3-waiting-words-growth',
      file: 'packages/core/test/review.test.ts',
      anchor: "    const waiting = { x: word('heard', 2) };\n",
      replacement:
        "    const waiting = { x: word('heard', 2), y: word('heard', 2) };\n",
      red: { [REVIEW]: 'review/words not yet due: read 2, recorded 1' },
    },
    {
      name: 'S1-destinations-lose-one',
      file: 'packages/core/test/sail.test.ts',
      anchor:
        '        const destinations = course.regions.flatMap((r) =>\n          r.destinations.map((d) => d.id),\n        );\n',
      replacement:
        '        const destinations = course.regions.flatMap((r) =>\n          r.destinations.map((d) => d.id),\n        ).slice(1);\n',
      red: {
        [`${SAIL_FROM} 0 goes to r0-d1`]:
          'sail/destinations after a sail from 0: read 11, recorded 12',
        [`${SAIL_FROM} 1 goes to r0-d2`]:
          'sail/destinations after a sail from 1: read 11, recorded 12',
        [`${SAIL_FROM} 2 goes to r0-d3`]:
          'sail/destinations after a sail from 2: read 11, recorded 12',
        [`${SAIL_FROM} 3 goes to r1-d0`]:
          'sail/destinations after a sail from 3: read 11, recorded 12',
        [`${SAIL_FROM} 4 goes to r1-d1`]:
          'sail/destinations after a sail from 4: read 11, recorded 12',
        [`${SAIL_FROM} 5 goes to r1-d2`]:
          'sail/destinations after a sail from 5: read 11, recorded 12',
        [`${SAIL_FROM} 6 goes to r1-d3`]:
          'sail/destinations after a sail from 6: read 11, recorded 12',
        [`${SAIL_FROM} 7 goes to r2-d0`]:
          'sail/destinations after a sail from 7: read 11, recorded 12',
        [`${SAIL_FROM} 8 goes to r2-d1`]:
          'sail/destinations after a sail from 8: read 11, recorded 12',
        [`${SAIL_FROM} 9 goes to r2-d2`]:
          'sail/destinations after a sail from 9: read 11, recorded 12',
        [`${SAIL_FROM} 10 goes to r2-d3`]:
          'sail/destinations after a sail from 10: read 11, recorded 12',
      },
    },
    {
      name: 'S2-words-held-lose-one',
      file: 'packages/core/test/sail.test.ts',
      anchor: '    const words = Object.values(s.words);\n',
      replacement: '    const words = Object.values(s.words).slice(1);\n',
      red: {
        [SAIL_D1]:
          'sail/words held at the first destination: read 7, recorded 8',
      },
    },
    {
      name: 'S3-journey-encounters-lose-one',
      file: 'packages/core/test/sail.test.ts',
      anchor:
        "  it('owns no Encounters and holds only the starting grant, with nothing spent', () => {\n    const encounters = course.regions.flatMap((r) =>\n      r.encounters.map((e) => e.id),\n    );\n",
      replacement:
        "  it('owns no Encounters and holds only the starting grant, with nothing spent', () => {\n    const encounters = course.regions.flatMap((r) =>\n      r.encounters.map((e) => e.id),\n    ).slice(1);\n",
      red: {
        [SAIL_JOURNEY]:
          'sail/encounters after a sail from a journey: read 2, recorded 3',
      },
    },
    {
      name: 'S4-preview-encounters-lose-one',
      file: 'packages/core/test/sail.test.ts',
      anchor:
        '      n(understandingNow(course, before())),\n    );\n    const encounters = course.regions.flatMap((r) =>\n      r.encounters.map((e) => e.id),\n    );\n',
      replacement:
        '      n(understandingNow(course, before())),\n    );\n    const encounters = course.regions.flatMap((r) =>\n      r.encounters.map((e) => e.id),\n    ).slice(1);\n',
      red: {
        [SAIL_PREVIEW]: 'sail/encounters after a sail: read 2, recorded 3',
      },
    },
    {
      name: 'P1-grammar-offers-lose-one',
      file: 'packages/core/test/shop.test.ts',
      anchor: '    const offers = shopOf(rich).grammar;\n',
      replacement: '    const offers = shopOf(rich).grammar.slice(1);\n',
      red: {
        [SHOP_GRAMMAR]:
          'shop/grammar offers before grammar opens: read 11, recorded 12',
      },
    },
    {
      name: 'P2-journey-slots-lose-one',
      file: 'packages/core/test/shop.test.ts',
      anchor: '    const { slots, startable } = shopOf(away).journeys;\n',
      replacement:
        '    const { slots: every, startable } = shopOf(away).journeys;\n    const slots = every.slice(1);\n',
      red: {
        [SHOP_JOURNEYS]:
          'shop/journey slots while one is away: read 2, recorded 3',
      },
    },
    {
      name: 'P3-encounter-offers-lose-one',
      file: 'packages/core/test/shop.test.ts',
      anchor: '    const offers = shop.encounters;\n',
      replacement: '    const offers = shop.encounters.slice(1);\n',
      red: {
        [SHOP_PRACTICE]:
          'shop/encounter offers with nothing held: read 5, recorded 6',
      },
    },
    {
      name: 'W1-words-held-lose-one',
      file: 'packages/core/test/words.test.ts',
      anchor: '    const held = Object.keys(s.words);\n',
      replacement: '    const held = Object.keys(s.words).slice(1);\n',
      red: {
        [WORDS]: 'words/words held when the pool is empty: read 4, recorded 5',
      },
    },
    {
      name: 'K1-challenged-requests-loss',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '      const url = `${dev}/`;\n      const sent = [url];\n',
      replacement:
        '      const url = `${dev}/`;\n      const sent = [url].slice(1);\n',
      red: {
        [NO_CREDENTIALS]: 'searched no requests sent',
        [WRONG_PASSWORD]: 'searched no requests sent',
      },
    },
    {
      name: 'K2-challenged-requests-growth',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '      const url = `${dev}/`;\n      const sent = [url];\n',
      replacement:
        '      const url = `${dev}/`;\n      const sent = [url, url];\n',
      red: {
        [NO_CREDENTIALS]:
          'lockdown/requests challenged with no credentials: read 2, recorded 1',
        [WRONG_PASSWORD]:
          'lockdown/requests challenged with a wrong password: read 2, recorded 1',
      },
    },
    {
      name: 'K3-challenge-bodies-loss',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '      const bodies = [await response.text()];\n',
      replacement: '      const bodies = [await response.text()].slice(1);\n',
      red: {
        [NO_CREDENTIALS]: 'searched no challenge bodies',
        [WRONG_PASSWORD]: 'searched no challenge bodies',
      },
    },
    {
      name: 'K4-challenge-bodies-growth',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '      const bodies = [await response.text()];\n',
      replacement:
        "      const bodies = [await response.text(), 'a second body'];\n",
      red: {
        [NO_CREDENTIALS]:
          'lockdown/challenge bodies with no credentials: read 2, recorded 1',
        [WRONG_PASSWORD]:
          'lockdown/challenge bodies with a wrong password: read 2, recorded 1',
      },
    },
    {
      name: 'K5-unconfigured-requests-loss',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '    const url = `${dev}/`;\n    const sent = [url];\n',
      replacement:
        '    const url = `${dev}/`;\n    const sent = [url].slice(1);\n',
      red: { [UNCONFIGURED]: 'searched no requests sent' },
    },
    {
      name: 'K6-unconfigured-requests-growth',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '    const url = `${dev}/`;\n    const sent = [url];\n',
      replacement: '    const url = `${dev}/`;\n    const sent = [url, url];\n',
      red: {
        [UNCONFIGURED]:
          'lockdown/requests with no password configured: read 2, recorded 1',
      },
    },
    {
      name: 'K7-web-robots-requests-loss',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '    const url = `${dev}/robots.txt`;\n    const sent = [url];\n',
      replacement:
        '    const url = `${dev}/robots.txt`;\n    const sent = [url].slice(1);\n',
      red: { [ROBOTS_WEB]: 'searched no requests sent' },
    },
    {
      name: 'K8-web-robots-requests-growth',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor: '    const url = `${dev}/robots.txt`;\n    const sent = [url];\n',
      replacement:
        '    const url = `${dev}/robots.txt`;\n    const sent = [url, url];\n',
      red: {
        [ROBOTS_WEB]:
          'lockdown/robots.txt requests on the web host: read 2, recorded 1',
      },
    },
    {
      name: 'K9-sync-robots-requests-loss',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor:
        "      'https://yawelo-idle-sync-dev.shyden-labs-dev.workers.dev/robots.txt';\n    const sent = [url];\n",
      replacement:
        "      'https://yawelo-idle-sync-dev.shyden-labs-dev.workers.dev/robots.txt';\n    const sent = [url].slice(1);\n",
      red: { [ROBOTS_SYNC]: 'searched no requests sent' },
    },
    {
      name: 'K10-sync-robots-requests-growth',
      file: 'packages/lockdown/test/lockdown.test.ts',
      anchor:
        "      'https://yawelo-idle-sync-dev.shyden-labs-dev.workers.dev/robots.txt';\n    const sent = [url];\n",
      replacement:
        "      'https://yawelo-idle-sync-dev.shyden-labs-dev.workers.dev/robots.txt';\n    const sent = [url, url];\n",
      red: {
        [ROBOTS_SYNC]:
          'lockdown/robots.txt requests on the sync host: read 2, recorded 1',
      },
    },
  ],
});
