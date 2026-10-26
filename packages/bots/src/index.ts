/**
 * @yawelo-idle/bots: simulated players that play the real core and measure
 * its pacing (M1 design §6, #35).
 */
export {
  CASUAL_SEED,
  PERSONAS,
  persona,
  type BuyStyle,
  type Persona,
} from './personas.ts';
export {
  BOOTSTRAP_TAP_MS,
  offersDecision,
  Player,
  STEP_MS,
  type Action,
  type Watcher,
} from './player.ts';
export {
  insaneValues,
  runPersona,
  type PersonaRun,
  type RunOptions,
  type Sail,
} from './run.ts';
export {
  CALIBRATE_DEFAULTS,
  calibrateGoals,
  threeFiguresDown,
  UNREACHABLE,
  type CalibratedGoal,
  type CalibrateOptions,
  type Measure,
} from './calibrate.ts';
export {
  DAY_MS,
  dayOpens,
  FIRST_SESSION_MS,
  HOUR_MS,
  MIN_OPEN_GAP_MS,
  MINUTE_MS,
  WAKE_MS,
  WAKING_MS,
  type Open,
} from './schedule.ts';
export {
  LATENCY_MEDIAN_MS,
  LATENCY_SIGMA,
  STREAM_NAMES,
  Streams,
  type StreamName,
} from './streams.ts';
export {
  pacingReport,
  type PacingReport,
  type PersonaReport,
} from './report.ts';
export {
  CI_BOUNDS,
  clickingNeverWins,
  decisions,
  DESTINATIONS,
  finale,
  firstSail,
  gaps,
  idlerFinishes,
  learnersOrder,
  learningPays,
  sanity,
  TUNING_TARGETS,
  type Bounds,
} from './targets.ts';
