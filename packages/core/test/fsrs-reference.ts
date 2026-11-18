import Decimal from 'decimal.js';

/**
 * The FSRS-7 forgetting curve in decimal at 60 significant digits: the
 * reference the tests hold production's float maths to (#874 AC3). It
 * takes FSRS-7's default weights and bounds as literals copied from
 * ts-fsrs 6.0.0 (`ts-fsrs/models/fsrs-7`), not from the code, so the
 * reference does not move with it.
 *
 * R(t) mixes two power-law traces, fast and slow, each (1 + c t)^(-δ):
 * R = (w1 Rfast + w2 Rslow) / (w1 + w2) x 0.99998 + 0.00001.
 */

const D = Decimal.clone({ precision: 60 });

const W = [
  0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826,
  0.7024, 0.5999, 0.8146, 0.6398, 1, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934,
  1.8631, 0.6162, 1.0869, 0.1567, 0.0801, 0.2421, 0.9464, 0.1433, 0.7145, 0,
  0.5667, 0.3734, 0.5333, 0.3048,
].map((w) => new D(w));

const w = (index: number): Decimal => {
  const value = W[index];
  if (value === undefined) throw new RangeError(`no weight ${String(index)}`);
  return value;
};

const clamp = (x: Decimal, low: Decimal.Value, high: Decimal.Value) =>
  D.min(D.max(x, low), high);

/** A memory state as FSRS-7 reads it. */
export interface ReferenceState {
  readonly stability: Decimal.Value;
  readonly stabilityFast: Decimal.Value;
  readonly difficulty: Decimal.Value;
}

interface Trace {
  /** δ, the trace's decay: R = (1 + c t)^(-δ). */
  readonly decay: Decimal;
  /** c, per day. */
  readonly scale: Decimal;
  readonly weight: Decimal;
}

function traces(state: ReferenceState): readonly [Trace, Trace] {
  const s = clamp(new D(state.stability), '0.0001', 36500);
  const sFast = clamp(new D(state.stabilityFast), '0.0001', 36500);
  const d = clamp(new D(state.difficulty), 1, 10);
  const fastDecay = clamp(
    w(23).mul(sFast.pow(w(33).minus('0.3'))),
    '0.01',
    '0.95',
  );
  // ts-fsrs caps this exponent at 60.
  const fastScale = D.exp(D.min(D.ln(w(25)).div(fastDecay.neg()), 60))
    .minus(1)
    .div(sFast);
  const slowDecay = clamp(w(24), '0.01', '0.95');
  const slowScale = w(26)
    .pow(new D(1).div(slowDecay.neg()))
    .minus(1)
    .mul(D.exp(d.minus(5).mul(w(32).minus('0.3'))))
    .div(s);
  return [
    {
      decay: fastDecay,
      scale: fastScale,
      weight: w(27).mul(sFast.pow(w(29).neg())),
    },
    {
      decay: slowDecay,
      scale: slowScale,
      weight: w(28)
        .mul(s.pow(w(30)))
        .mul(D.exp(d.minus(5).mul(w(31).minus('0.5')))),
    },
  ];
}

const KEPT = new D('0.99998');
const FLOOR = new D('0.00001');

function mix(state: ReferenceState, each: (trace: Trace) => Decimal): Decimal {
  const [fast, slow] = traces(state);
  return fast.weight
    .mul(each(fast))
    .plus(slow.weight.mul(each(slow)))
    .div(fast.weight.plus(slow.weight))
    .mul(KEPT);
}

/** R, `days` after the review that left `state`. */
export function exactR(state: ReferenceState, days: Decimal.Value): Decimal {
  return mix(state, ({ decay, scale }) =>
    scale.mul(days).plus(1).pow(decay.neg()),
  ).plus(FLOOR);
}

/**
 * The integral of R from the review to `days` after it: each trace's
 * ((1 + c t)^(1 - δ) - 1) / (c (1 - δ)), mixed, plus the floor's t.
 */
export function exactIntegral(
  state: ReferenceState,
  days: Decimal.Value,
): Decimal {
  return mix(state, ({ decay, scale }) => {
    const kept = new D(1).minus(decay);
    return scale.mul(days).plus(1).pow(kept).minus(1).div(scale.mul(kept));
  }).plus(FLOOR.mul(days));
}

/** The exact mean of R over [from, from + span] days, by the subtraction of two integrals. */
export function exactMean(
  state: ReferenceState,
  fromDays: Decimal.Value,
  spanDays: Decimal.Value,
): Decimal {
  const from = new D(fromDays);
  const span = new D(spanDays);
  return exactIntegral(state, from.plus(span))
    .minus(exactIntegral(state, from))
    .div(span);
}
