/**
 * @yawelo-idle/core: every rule that moves a number (M1 design §1). Pure
 * TypeScript with no DOM, timers, network or system clock, so the same code
 * runs in browsers, Electron, Capacitor and Workers and replays identically.
 */
export { exp, expm1, ln, log10, log1p, pow } from './det-math.ts';
export { Num, type NumTuple } from './num.ts';
export {
  bucketEnd,
  bucketStart,
  gridTicksBetween,
  HOUR_MS,
  nextGridTick,
  simMs,
  wallMs,
  type SimMs,
  type WallMs,
} from './clock.ts';
export {
  createStreams,
  drawFrom,
  intFrom,
  nextFloat,
  nextInt,
  nextU32,
  seedRng,
  type Draw,
  type RngState,
  type RngStreams,
} from './rng.ts';
export {
  BALANCE,
  JOURNEY_DURATION_IDS,
  type Balance,
  type InsightUpgradeId,
  type JourneyDurationId,
  type Rank,
  type StampUpgradeId,
} from './balance.ts';
export {
  encounterOutput,
  milestoneFactor,
  milestonesReached,
  purchaseCost,
} from './encounters.ts';
export { cultureCard, festivalLive, heldCards } from './cards.ts';
export {
  cardPool,
  collectJourney,
  journeyDurationMs,
  journeyStatus,
  startJourney,
  type JourneyStatus,
} from './journeys.ts';
export {
  encounterRate,
  producedBetween,
  rateAt,
  rateBreakdown,
  rateGain,
  totalRate,
  understandingNow,
  wordMultiplier,
  type EncounterRate,
  type RateLine,
} from './production.ts';
export {
  encounterCostFactor,
  encounterPrice,
  findUpgrade,
  globalMultiplier,
  journeyDurationFactor,
  journeySlots,
  offlineCapMs,
  pemanduIntervalsMs,
  phrasebookId,
  startingUnderstanding,
  upgradeCatalogue,
  upgradeLevel,
  type Upgrade,
  type UpgradeCurrency,
} from './upgrades.ts';
export {
  RANKS,
  type MemoryCard,
  type QueueItem,
  type WordMemory,
} from './memory.ts';
export {
  findGrammarNode,
  grammarNodeCost,
  ownedGrammarNodes,
} from './grammar.ts';
export {
  automationOpensAt,
  automationUnlocked,
  bestPayback,
  nextPurchaseTick,
} from './automation.ts';
export { pickUpCost, pickUpPool } from './words.ts';
export {
  currentDestination,
  currentRegion,
  regionsReached,
  route,
  type Stop,
} from './route.ts';
export {
  goalMet,
  runUnderstanding,
  sailGoal,
  sailPreview,
  setSail,
  stampGain,
  wordsHeld,
  type SailGoal,
  type SailPreview,
} from './sail.ts';
export {
  UNFOLD_FLAGS,
  unfold,
  type Unfold,
  type UnfoldFlag,
} from './unfold.ts';
export { stateHash } from './hash.ts';
export { apply, replay, type Refusal, type Replayed } from './log.ts';
export {
  EVENT_TYPES,
  parseEvent,
  PROMPT_TYPES,
  type EventError,
  type EventType,
  type GameEvent,
  type ParsedEvent,
  type PromptType,
} from './events.ts';
export {
  advance,
  answerPractice,
  answerReview,
  buyEncounter,
  buyGrammarNode,
  buyUpgrade,
  integrate,
  listen,
  nextPickUp,
  pickUpWord,
  setAutomation,
  type AdvanceSummary,
  type NextPickUp,
  type Rejection,
  type Result,
} from './sim.ts';
export {
  view,
  type EncounterOffer,
  type GrammarOffer,
  type JourneyOffer,
  type PickUpOffer,
  type Shop,
  type UpgradeOffer,
  type View,
} from './view.ts';
export {
  initialState,
  ownedCount,
  pickedWord,
  RNG_STREAMS,
  type Anchor,
  type Automation,
  type GameState,
  type Journey,
} from './state.ts';
export {
  CEFR_LEVELS,
  resolveCourse,
  type CardSet,
  type Cefr,
  type Course,
  type CourseData,
  type CourseOf,
  type CultureCard,
  type Destination,
  type Encounter,
  type EncounterData,
  type FestivalWindow,
  type GrammarNode,
  type LexiconItem,
  type Region,
  type RegionData,
  type RegionOf,
  type Tier,
} from './course.ts';
