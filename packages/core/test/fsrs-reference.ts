import Decimal from 'decimal.js';

/**
 * The FSRS-6 forgetting curve in decimal at 60 significant digits: the
 * reference the tests hold production's float maths to. It takes the decay
 * as the literal 0.1542, not `DECAY`, so the reference does not move with
 * the code.
 */

const D = Decimal.clone({ precision: 60 });
const decay = new D(0.1542);
const factor = new D('0.9').pow(new D(-1).div(decay)).minus(1);
const exponent = new D(1).minus(decay);

/** R(t) = (1 + F t / S)^(-d), `days` after the review, stability S days. */
export function exactR(stability: Decimal.Value, days: Decimal.Value): Decimal {
  return factor.mul(days).div(stability).plus(1).pow(decay.neg());
}

/**
 * The integral of R from the review to `days` after it, in days:
 * S / (F (1 - d)) x ((1 + F t / S)^(1 - d) - 1).
 */
export function exactIntegral(
  stability: Decimal.Value,
  days: Decimal.Value,
): Decimal {
  return new D(stability)
    .div(factor.mul(exponent))
    .mul(factor.mul(days).div(stability).plus(1).pow(exponent).minus(1));
}

/** The exact mean of R over [from, from + span] days, by the subtraction of two integrals. */
export function exactMean(
  stability: Decimal.Value,
  fromDays: Decimal.Value,
  spanDays: Decimal.Value,
): Decimal {
  const from = new D(fromDays);
  const span = new D(spanDays);
  return exactIntegral(stability, from.plus(span))
    .minus(exactIntegral(stability, from))
    .div(span);
}
