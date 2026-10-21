import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #375's mutations: each breaks the src/ code a new floor guards, never the
 * test (Shyden, 2026-10-21), and names every unit test it turns red, each
 * predicted by reading that code's readers before the first run. Where the
 * code also drives the recorded golden replays or every test on the real
 * course, the fault is narrowed to values those were first shown, by reading
 * and by measuring the unbroken code, never to reach (Shyden, same day):
 * 1e35 Understanding or more (the golden replay peaks at 1e20.05; hash's and
 * the log laws' states hold 1e40), 1e30 Insight (golden peak 1e4.40), a
 * course with a region of two Encounters (Pemandu; only the automation
 * course has one), a pick-up pool of at most five words, a region or an
 * offer of one Encounter (the synthetic course has six per region), and
 * nothing held with exactly one word (the golden replay's zero-held states
 * hold 0 or 21 words). Each test stays at its original input.
 *
 * Where each row's tests came from (Shyden, 2026-10-21: accepted, labelled):
 * A1 and W1 name the tests a temporary reach probe of the UNBROKEN code
 * logged at the choice each fault changes (no fault ran; every test
 * passed); W1's played() callers were also found by grep, the same 17
 * lines. Whether each goes red, and its text, was read from the test.
 * Every other row's tests were found by grep and reading alone.
 */
export default mutationFile({
  targets: [
    'packages/bots/test/player.test.ts',
    'packages/core/test/automation.test.ts',
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
      name: 'L1-gate-never-hands-on',
      file: 'packages/lockdown/src/index.ts',
      anchor:
        '    return challengeResponse();\n  }\n  return withNoIndex(await serve(request));\n}\n',
      replacement:
        '    return challengeResponse();\n  }\n  return challengeResponse();\n}\n',
      red: {
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges no credentials on a non-prod host and never serves':
          'searched no hand-overs with the password',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges a wrong password on a non-prod host and never serves':
          'searched no hand-overs with the password',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges every request when the password is not configured':
          'searched no hand-overs once one is set',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > serves blocking robots.txt on a non-prod host without credentials':
          'searched no hand-overs off robots.txt',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > serves an authorised request with noindex added and the rest kept':
          'expected 401 to be 200',
      },
    },
    {
      name: 'L2-gate-hands-on-twice',
      file: 'packages/lockdown/src/index.ts',
      anchor:
        '    return challengeResponse();\n  }\n  return withNoIndex(await serve(request));\n}\n',
      replacement:
        '    return challengeResponse();\n  }\n  await serve(request);\n  return withNoIndex(await serve(request));\n}\n',
      red: {
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges no credentials on a non-prod host and never serves':
          'lockdown/hand-overs with the password, for no credentials: read 2, recorded 1',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges a wrong password on a non-prod host and never serves':
          'lockdown/hand-overs with the password, for a wrong password: read 2, recorded 1',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges every request when the password is not configured':
          'lockdown/hand-overs once a password is set: read 2, recorded 1',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > serves blocking robots.txt on a non-prod host without credentials':
          'lockdown/hand-overs off robots.txt on the web host: read 2, recorded 1',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > serves an authorised request with noindex added and the rest kept':
          'to deeply equal',
      },
    },
    {
      name: 'L3-api-never-hands-on',
      file: 'packages/lockdown/src/index.ts',
      anchor:
        "  if (pathname === '/robots.txt') return robotsResponse();\n  return withNoIndex(await serve(request));\n}\n",
      replacement:
        "  if (pathname === '/robots.txt') return robotsResponse();\n  return robotsResponse();\n}\n",
      red: {
        'packages/lockdown/test/lockdown.test.ts › markApiRequest > serves blocking robots.txt on a non-prod host':
          'searched no hand-overs off robots.txt',
        'packages/lockdown/test/lockdown.test.ts › markApiRequest > adds noindex to every response on a non-prod host, with no password':
          'to have a length of 1',
      },
    },
    {
      name: 'L4-api-hands-on-twice',
      file: 'packages/lockdown/src/index.ts',
      anchor:
        "  if (pathname === '/robots.txt') return robotsResponse();\n  return withNoIndex(await serve(request));\n}\n",
      replacement:
        "  if (pathname === '/robots.txt') return robotsResponse();\n  await serve(request);\n  return withNoIndex(await serve(request));\n}\n",
      red: {
        'packages/lockdown/test/lockdown.test.ts › markApiRequest > serves blocking robots.txt on a non-prod host':
          'lockdown/hand-overs off robots.txt on the sync host: read 2, recorded 1',
        'packages/lockdown/test/lockdown.test.ts › markApiRequest > adds noindex to every response on a non-prod host, with no password':
          'to have a length of 1',
      },
    },
    {
      name: 'L5-challenge-loses-a-sentence',
      file: 'packages/lockdown/src/index.ts',
      anchor:
        "    'This is a non-prod Yawelo Idle environment for authorised testers. ' +\n      'The game is at https://yawelo-idle.shyden.co.uk.',\n",
      replacement:
        "    'This is a non-prod Yawelo Idle environment for authorised testers.',\n",
      red: {
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges no credentials on a non-prod host and never serves':
          'lockdown/challenge sentences for no credentials: read 1, recorded 2',
        'packages/lockdown/test/lockdown.test.ts › gateWebRequest > challenges a wrong password on a non-prod host and never serves':
          'lockdown/challenge sentences for a wrong password: read 1, recorded 2',
      },
    },
    {
      name: 'R1-queue-drops-its-last',
      file: 'packages/core/src/memory.ts',
      anchor: '  return due.slice(0, BALANCE.memory.queueSize);\n',
      replacement:
        '  return (due.length > 1 ? due.slice(0, -1) : due).slice(\n    0,\n    BALANCE.memory.queueSize,\n  );\n',
      red: {
        'packages/core/test/review.test.ts › the review queue (AC6) > is empty when nothing is due':
          'review/queue once due: read 1, recorded 2',
        'packages/core/test/review.test.ts › the review queue (AC6) > breaks ties by item id':
          'to deeply equal',
        'packages/core/test/sail.test.ts › the goal (AC1) > never needs a review: unreviewed words and no Insight still sail (D1)':
          'sail/words due at the first destination: read 7, recorded 8',
        'packages/core/test/words.test.ts › memory ages on the wall clock (AC9) > after a capped 30-day absence, R reflects 30 days and Understanding the cap':
          'expected undefined to be',
      },
    },
    {
      name: 'A1-pemandu-pricing-is-blind-to-the-last-in-a-course-of-two-encounter-regions',
      file: 'packages/core/src/automation.ts',
      anchor:
        '  const encounters =\n    same?.encounters ??\n    course.regions.slice(0, reached).flatMap((region) => region.encounters);\n',
      replacement:
        '  const all =\n    same?.encounters ??\n    course.regions.slice(0, reached).flatMap((region) => region.encounters);\n  const encounters =\n    same === undefined &&\n    course.regions.some((r) => r.encounters.length === 2)\n      ? all.slice(0, -1)\n      : all;\n',
      red: {
        'packages/core/test/automation.test.ts › integrate with Pemandu (AC2) > buys nothing when nothing is owned and nothing is affordable':
          'automation/what Pemandu buys when rich: read 3, recorded 4',
        'packages/core/test/automation.test.ts › bestPayback (AC2) > breaks a tie by id in code-unit order':
          "to be 'Zed'",
      },
    },
    {
      name: 'H1-long-journey-loses-its-return-when-huge',
      file: 'packages/core/src/journeys.ts',
      anchor: '    cardId: card.id,\n  };\n',
      replacement:
        "    cardId: card.id,\n  };\n  if (id === '4h' && state.anchor.understanding[1] >= 35)\n    delete (journey as { returnsAt?: number }).returnsAt;\n",
      red: {
        'packages/core/test/hash.test.ts › stateHash (AC4) > changes when any numeric field moves by one ulp':
          'hash/numeric fields: read 59, recorded 60',
      },
    },
    {
      name: 'W1-pick-up-skips-the-last-word-of-a-pool-of-five',
      file: 'packages/core/src/sim.ts',
      anchor:
        '  const next = pool.find((item) => pickedWord(state, item.id) === undefined);\n',
      replacement:
        '  const next = (pool.length <= 5 ? pool.slice(0, -1) : pool).find(\n    (item) => pickedWord(state, item.id) === undefined,\n  );\n',
      red: {
        'packages/core/test/words.test.ts › the word bonus (AC2) > M_words is 1 plus the bonus of each word sharing a tag, counted once':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the word bonus (AC2) > over a whole hour with no event, production equals the continuous model to 1e-12':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the word bonus (AC2) > across three hour boundaries, production equals the continuous model to 1e-12':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the word bonus (AC2) > after a review mid-hour, production to the hour’s end equals the continuous model':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the word bonus (AC2) > keeps each word’s mean over the hour through a purchase':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the word bonus (AC2) > takes R on the wall clock, not the simulated one':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the word bonus (AC2) > includes the word multipliers in the rate':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > a wrong answer costs nothing and reschedules the word':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > re-anchors at the answer and restarts every word’s hour mean there':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the view (AC6, DN23) > holds Understanding, the rate and its breakdown (#29), Insight, the queue, the sail preview and the unfold flags (#31), the shop (#35), and nothing else':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the view (AC6, DN23) > shows the rate with the word multipliers and the queue at the view’s time':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › memory ages on the wall clock (AC9) > after a capped 30-day absence, R reflects 30 days and Understanding the cap':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › memory ages on the wall clock (AC9) > after a clipped return mid-hour, production to the hour’s end equals the continuous model':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › test fixtures > played() picks all five words and reviews three, at a sim time mid-hour':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › picking up a word (AC1) > takes the destination’s items in CEFR order, then course order':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › picking up a word (AC1) > charges pickUpCost(4) with 4 already picked':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › picking up a word (AC1) > is refused as empty, not unaffordable, when the next pick-up could not be paid for either':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > a correct due answer to a1-food gives 1 + 0.5 × rank index Insight, by the rank it was asked at':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > a correct due answer to both gives 1 + 0.5 × rank index Insight, by the rank it was asked at':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > a correct due answer to b1-food gives 1 + 0.5 × rank index Insight, by the rank it was asked at':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > refuses later, a word not picked up':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > refuses nope, a word not picked up':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > refuses constructor, a word not picked up':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > refuses __proto__, a word not picked up':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › answering a review (AC5, AC7) > refuses hasOwnProperty, a word not picked up':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > on a1-food changes no currency, no FSRS state and no rank':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > on a1-bus changes no currency, no FSRS state and no rank':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > on both changes no currency, no FSRS state and no rank':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > on toString changes no currency, no FSRS state and no rank':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > on b1-food changes no currency, no FSRS state and no rank':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the floor (AC4) > ranks and memory never change through -86400000 ms of absence':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the floor (AC4) > ranks and memory never change through 0 ms of absence':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the floor (AC4) > ranks and memory never change through 34560000000 ms of absence':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › the floor (AC4) > ranks and memory never change through 12345678 ms of absence':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > is open 0 ms on, due or not, on a1-food':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > is open 86400000 ms on, due or not, on both':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › practice (AC8) > is open 5184000000 ms on, due or not, on toString':
          'rejected: {"kind":"poolEmpty"}',
        'packages/core/test/words.test.ts › picking up a word (AC1) > is refused when the pool is empty, never reaching a later destination':
          'words/words held when the pool is empty: read 4, recorded 5',
        'packages/core/test/words.test.ts › no reachable state holds NaN, a negative or an infinite value > over a sequence of pick-ups, answers, purchases and returns':
          'to deeply equal',
        'packages/core/test/grammar.test.ts › derived words (#32 AC3) > picks up a derived word once the lexicon is held':
          'rejected: poolEmpty',
        "packages/core/test/grammar.test.ts › derived words (#32 AC3) > prices a derived word by the pool's words held: the fourth costs 20 x 1.15^3":
          'rejected: poolEmpty',
      },
    },
    {
      name: 'G1-grammar-offers-drop-the-last-when-rich-in-insight',
      file: 'packages/core/src/view.ts',
      anchor:
        '        affordable: buyGrammarNode(course, state, id).ok,\n      })),\n  );\n}\n',
      replacement:
        '        affordable: buyGrammarNode(course, state, id).ok,\n      })),\n  ).slice(0, state.insight[1] >= 30 ? -1 : undefined);\n}\n',
      red: {
        'packages/core/test/shop.test.ts › the grammar offers match buying a node > is not affordable before grammar opens, however much Insight is held':
          'shop/grammar offers before grammar opens: read 11, recorded 12',
      },
    },
    {
      name: 'J1-busy-slots-drop-a-locked-one',
      file: 'packages/core/src/view.ts',
      anchor: '  return { slots, startable };\n',
      replacement:
        "  const kept =\n    free === -1 && slots.includes('locked')\n      ? slots.filter((_, k) => k !== slots.lastIndexOf('locked'))\n      : slots;\n  return { slots: kept, startable };\n",
      red: {
        'packages/core/test/shop.test.ts › the Journey offers match starting a Journey > offers nothing while every open slot is busy':
          'shop/journey slots while one is away: read 2, recorded 3',
        'packages/bots/test/player.test.ts › an open > reports no decision when nothing is affordable, due, free or available':
          'to deeply equal',
      },
    },
    {
      name: 'L6-ladder-lone-encounter-loses-p0',
      file: 'packages/core/src/course.ts',
      anchor: '            p0: p0 * scale,\n',
      replacement:
        '            ...(region.encounters.length === 1 ? {} : { p0: p0 * scale }),\n',
      red: {
        'packages/core/test/ladder.test.ts › resolveCourse prices each Encounter from its tier and region > carries no tier into the course core plays':
          'ladder/encounter keys: read 14, recorded 16',
        'packages/core/test/ladder.test.ts › resolveCourse prices each Encounter from its tier and region > scales region 1’s tier 2 by 1000':
          'to deeply equal',
        'packages/core/test/ladder.test.ts › resolveCourse prices each Encounter from its tier and region > scales region 2’s tier 6 by a million':
          'to deeply equal',
      },
    },
    {
      name: 'O1-replay-keeps-no-refusal-when-huge',
      file: 'packages/core/src/log.ts',
      anchor:
        '    else refused.push({ seq: event.seq, rejection: result.rejection });\n',
      replacement:
        '    else if (current.anchor.understanding[1] < 35)\n      refused.push({ seq: event.seq, rejection: result.rejection });\n',
      red: {
        'packages/core/test/log.test.ts › a refused event leaves state unchanged (AC2) > a log with a refused event inserted replays to the state without it':
          'searched no refusals with one inserted',
        'packages/core/test/log.test.ts › replay (AC6) > lists each refusal with its seq, in log order':
          'to deeply equal',
      },
    },
    {
      name: 'O2-replay-keeps-each-refusal-twice-when-huge',
      file: 'packages/core/src/log.ts',
      anchor:
        '    else refused.push({ seq: event.seq, rejection: result.rejection });\n',
      replacement:
        '    else {\n      refused.push({ seq: event.seq, rejection: result.rejection });\n      if (current.anchor.understanding[1] >= 35)\n        refused.push({ seq: event.seq, rejection: result.rejection });\n    }\n',
      red: {
        'packages/core/test/log.test.ts › a refused event leaves state unchanged (AC2) > a log with a refused event inserted replays to the state without it':
          'log/refusals with one inserted: read 2, recorded 1',
        'packages/core/test/log.test.ts › replay (AC6) > lists each refusal with its seq, in log order':
          'to deeply equal',
      },
    },
    {
      name: 'S1-sail-records-no-replay',
      file: 'packages/core/src/sail.ts',
      anchor:
        '      ? { ...state.replays, [id]: replayCount(state, id) + 1 }\n',
      replacement: '      ? state.replays\n',
      red: {
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 0 goes to r0-d1':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 1 goes to r0-d2':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 2 goes to r0-d3':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 3 goes to r1-d0':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 4 goes to r1-d1':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 5 goes to r1-d2':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 6 goes to r1-d3':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 7 goes to r2-d0':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 8 goes to r2-d1':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 9 goes to r2-d2':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 10 goes to r2-d3':
          'searched no replays a replay sail records',
        'packages/core/test/sail.test.ts › the finale and Mastery mode (AC5) > a replay counts towards that destination':
          'to deeply equal',
        'packages/core/test/sail.test.ts › the finale and Mastery mode (AC5) > replaying the furthest destination counts as a replay too':
          'to deeply equal',
        'packages/core/test/sail.test.ts › the finale and Mastery mode (AC5) > a second replay counts again':
          'to deeply equal',
      },
    },
    {
      name: 'S2-sail-records-a-second-replay',
      file: 'packages/core/src/sail.ts',
      anchor:
        '      ? { ...state.replays, [id]: replayCount(state, id) + 1 }\n',
      replacement:
        '      ? { ...state.replays, [id]: replayCount(state, id) + 1, [`${id}+`]: 1 }\n',
      red: {
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 0 goes to r0-d1':
          'sail/replays recorded, against a sail from 0: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 1 goes to r0-d2':
          'sail/replays recorded, against a sail from 1: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 2 goes to r0-d3':
          'sail/replays recorded, against a sail from 2: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 3 goes to r1-d0':
          'sail/replays recorded, against a sail from 3: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 4 goes to r1-d1':
          'sail/replays recorded, against a sail from 4: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 5 goes to r1-d2':
          'sail/replays recorded, against a sail from 5: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 6 goes to r1-d3':
          'sail/replays recorded, against a sail from 6: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 7 goes to r2-d0':
          'sail/replays recorded, against a sail from 7: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 8 goes to r2-d1':
          'sail/replays recorded, against a sail from 8: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 9 goes to r2-d2':
          'sail/replays recorded, against a sail from 9: read 2, recorded 1',
        'packages/core/test/sail.test.ts › destinations unlock in order (AC4) > a sail from destination 10 goes to r2-d3':
          'sail/replays recorded, against a sail from 10: read 2, recorded 1',
        'packages/core/test/sail.test.ts › the finale and Mastery mode (AC5) > a replay counts towards that destination':
          'to deeply equal',
        'packages/core/test/sail.test.ts › the finale and Mastery mode (AC5) > replaying the furthest destination counts as a replay too':
          'to deeply equal',
        'packages/core/test/sail.test.ts › the finale and Mastery mode (AC5) > a second replay counts again':
          'to deeply equal',
      },
    },
    {
      name: 'E1-offers-drop-the-last-with-nothing-held-and-one-word',
      file: 'packages/core/src/view.ts',
      anchor:
        '  const gainOf = rateGain(course, state, state.sim);\n  return course.regions\n    .slice(0, regionsReached(course, state))\n    .flatMap(({ encounters }, region) =>\n      encounters.map((encounter) => ({\n        id: encounter.id,\n        region,\n        owned: ownedCount(state, encounter.id),\n        price: encounterPrice(state, encounter, 1),\n        gain: gainOf(encounter),\n        affordable: buyEncounter(course, state, encounter.id, 1).ok,\n      })),\n    );\n}\n',
      replacement:
        '  const gainOf = rateGain(course, state, state.sim);\n  const offers = course.regions\n    .slice(0, regionsReached(course, state))\n    .flatMap(({ encounters }, region) =>\n      encounters.map((encounter) => ({\n        id: encounter.id,\n        region,\n        owned: ownedCount(state, encounter.id),\n        price: encounterPrice(state, encounter, 1),\n        gain: gainOf(encounter),\n        affordable: buyEncounter(course, state, encounter.id, 1).ok,\n      })),\n    );\n  return state.anchor.understanding[0] === 0 &&\n    Object.keys(state.words).length === 1 &&\n    !offers.some((o) => o.affordable)\n    ? offers.slice(0, -1)\n    : offers;\n}\n',
      red: {
        'packages/core/test/shop.test.ts › the Practice offer matches practising a word > stays on offer with nothing else affordable, as Practice costs nothing':
          'shop/encounter offers with nothing held: read 5, recorded 6',
      },
    },
    {
      name: 'E2-a-lone-offer-is-dropped',
      file: 'packages/core/src/view.ts',
      anchor:
        '  const gainOf = rateGain(course, state, state.sim);\n  return course.regions\n    .slice(0, regionsReached(course, state))\n    .flatMap(({ encounters }, region) =>\n      encounters.map((encounter) => ({\n        id: encounter.id,\n        region,\n        owned: ownedCount(state, encounter.id),\n        price: encounterPrice(state, encounter, 1),\n        gain: gainOf(encounter),\n        affordable: buyEncounter(course, state, encounter.id, 1).ok,\n      })),\n    );\n}\n',
      replacement:
        '  const gainOf = rateGain(course, state, state.sim);\n  const offers = course.regions\n    .slice(0, regionsReached(course, state))\n    .flatMap(({ encounters }, region) =>\n      encounters.map((encounter) => ({\n        id: encounter.id,\n        region,\n        owned: ownedCount(state, encounter.id),\n        price: encounterPrice(state, encounter, 1),\n        gain: gainOf(encounter),\n        affordable: buyEncounter(course, state, encounter.id, 1).ok,\n      })),\n    );\n  return offers.length === 1 ? [] : offers;\n}\n',
      red: {
        'packages/core/test/sail.test.ts › a sail resets only Encounters and Understanding (AC3, DN3) > owns no Encounters and holds only the starting grant, with nothing spent':
          'searched no Encounters offered after the sail',
        'packages/core/test/sail.test.ts › the preview (AC2, DN3) > resets exactly the Encounters owned and the Understanding held':
          'searched no Encounters offered after the sail',
      },
    },
    {
      name: 'E3-a-lone-offer-is-listed-twice',
      file: 'packages/core/src/view.ts',
      anchor:
        '  const gainOf = rateGain(course, state, state.sim);\n  return course.regions\n    .slice(0, regionsReached(course, state))\n    .flatMap(({ encounters }, region) =>\n      encounters.map((encounter) => ({\n        id: encounter.id,\n        region,\n        owned: ownedCount(state, encounter.id),\n        price: encounterPrice(state, encounter, 1),\n        gain: gainOf(encounter),\n        affordable: buyEncounter(course, state, encounter.id, 1).ok,\n      })),\n    );\n}\n',
      replacement:
        '  const gainOf = rateGain(course, state, state.sim);\n  const offers = course.regions\n    .slice(0, regionsReached(course, state))\n    .flatMap(({ encounters }, region) =>\n      encounters.map((encounter) => ({\n        id: encounter.id,\n        region,\n        owned: ownedCount(state, encounter.id),\n        price: encounterPrice(state, encounter, 1),\n        gain: gainOf(encounter),\n        affordable: buyEncounter(course, state, encounter.id, 1).ok,\n      })),\n    );\n  return offers.length === 1 ? [...offers, ...offers] : offers;\n}\n',
      red: {
        'packages/core/test/sail.test.ts › a sail resets only Encounters and Understanding (AC3, DN3) > owns no Encounters and holds only the starting grant, with nothing spent':
          'sail/encounters offered after a sail from a journey: read 2, recorded 1',
        'packages/core/test/sail.test.ts › the preview (AC2, DN3) > resets exactly the Encounters owned and the Understanding held':
          'sail/encounters offered after a sail: read 2, recorded 1',
      },
    },
  ],
});
