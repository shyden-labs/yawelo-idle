import Decimal from 'break_infinity.js';
import { log10 as detLog10, pow as detPow } from './det-math';

/**
 * Num: break_infinity.js values for numbers past 1e308 (M1 design §2.1, §4).
 *
 * break_infinity is used for its representation and its + - * /, which are
 * correctly rounded on every engine. Two things are not taken from it:
 *
 * - Powers and logarithms. Decimal.pow and Decimal.log10 call Math.pow and
 *   Math.log10, which differ between engines; Num.pow and Num.log10 use
 *   det-math instead.
 * - Normalisation. break_infinity normalises with Math.floor(Math.log10(|m|)),
 *   and its add() leaves the mantissa below 1 for the integer mantissas
 *   999999999999999 and 999999999999998 (measured on V8 and JavaScriptCore
 *   alike). One value would then have two tuples, so every result is brought
 *   back to canonical form with comparisons alone, and Num.from finds its
 *   exponent with det-math rather than Decimal.fromNumber's Math.log10.
 *
 * State never holds a Num: it holds the tuple from Num.toTuple, which JSON
 * round-trips exactly.
 */
export type Num = Decimal;

/** [mantissa, exponent]: 1 <= |mantissa| < 10 and a safe-integer exponent, or [0, 0]. */
export type NumTuple = readonly [mantissa: number, exponent: number];

function isCanonical(m: number, e: number): boolean {
  if (m === 0) return Object.is(m, 0) && e === 0;
  return (
    Number.isFinite(m) &&
    Math.abs(m) >= 1 &&
    Math.abs(m) < 10 &&
    Number.isSafeInteger(e)
  );
}

const ZERO = Decimal.fromMantissaExponent_noNormalize(0, 0);
const ONE = Decimal.fromMantissaExponent_noNormalize(1, 0);

/**
 * The canonical Num for m x 10^e. Callers pass a mantissa at most a decade
 * or two out of range (a break_infinity result, or 10^frac rounded up to 10),
 * so the loops run once or not at all.
 */
function canonical(m: number, e: number): Num {
  if (!Number.isFinite(m) || !Number.isFinite(e)) {
    throw new RangeError(`Num is not finite: [${String(m)}, ${String(e)}]`);
  }
  if (m === 0) return ZERO;
  let mantissa = m;
  let exponent = e;
  while (Math.abs(mantissa) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  while (Math.abs(mantissa) < 1) {
    mantissa *= 10;
    exponent -= 1;
  }
  if (!Number.isSafeInteger(exponent)) {
    throw new RangeError(`Num exponent out of range: ${String(exponent)}`);
  }
  return Decimal.fromMantissaExponent_noNormalize(mantissa, exponent);
}

/** 10^k as the nearest double: string parsing is correctly rounded everywhere. */
function tenTo(k: number): number {
  return Number(`1e${String(k)}`);
}

/** 1e16 is exact in binary, so scaling a tiny input by it adds no rounding of its own. */
const TINY_SCALE = 1e16;

function settle(d: Decimal): Num {
  return canonical(d.mantissa, d.exponent);
}

function cmp(a: Num, b: Num): -1 | 0 | 1 {
  const c = a.cmp(b);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
}

export const Num = Object.freeze({
  /** A finite number as a Num. NaN and the infinities are refused. */
  from(x: number): Num {
    if (!Number.isFinite(x))
      throw new RangeError(`Num.from(${String(x)}): not finite`);
    if (x === 0) return ZERO;
    const e = Math.floor(detLog10(Math.abs(x)));
    // 10^e is subnormal or zero below 1e-307, so tiny inputs are scaled up first.
    const m = e < -300 ? (x * TINY_SCALE) / tenTo(e + 16) : x / tenTo(e);
    return canonical(m, e);
  },

  /** The Num a stored tuple holds. A non-canonical tuple is refused. */
  fromTuple(t: NumTuple): Num {
    const [m, e] = t;
    if (!isCanonical(m, e)) {
      throw new RangeError(
        `Num.fromTuple: not canonical: [${String(m)}, ${String(e)}]`,
      );
    }
    return Decimal.fromMantissaExponent_noNormalize(m, e);
  },

  toTuple(n: Num): NumTuple {
    return [n.mantissa, n.exponent];
  },

  add(a: Num, b: Num): Num {
    return settle(a.add(b));
  },

  sub(a: Num, b: Num): Num {
    return settle(a.sub(b));
  },

  mul(a: Num, b: Num): Num {
    return settle(a.mul(b));
  },

  div(a: Num, b: Num): Num {
    if (b.mantissa === 0) throw new RangeError('Num.div: division by zero');
    return settle(a.div(b));
  },

  /**
   * base^exponent for a non-negative base: 10^(exponent x log10 base), split
   * into an integer exponent and a det-math mantissa. The error in log10 of
   * the base is multiplied by the exponent, so the relative error is at most
   * 6e-16 x (|exponent| + |log10 result| + 2) (derived, and tested).
   */
  pow(base: Num, exponent: number): Num {
    if (!Number.isFinite(exponent)) {
      throw new RangeError(
        `Num.pow: exponent ${String(exponent)} is not finite`,
      );
    }
    if (exponent === 0) return ONE;
    if (base.mantissa < 0) throw new RangeError('Num.pow: negative base');
    if (base.mantissa === 0) {
      if (exponent < 0)
        throw new RangeError('Num.pow: zero to a negative power');
      return ZERO;
    }
    const l = (base.exponent + detLog10(base.mantissa)) * exponent;
    const e = Math.floor(l);
    return canonical(detPow(10, l - e), e);
  },

  /** log10 of a positive Num, through det-math. */
  log10(n: Num): number {
    if (n.mantissa <= 0) throw new RangeError('Num.log10: not positive');
    return n.exponent + detLog10(n.mantissa);
  },

  cmp,

  /** The nearest number: Infinity above 1.8e308, 0 below 5e-324. */
  toNumber(n: Num): number {
    return n.toNumber();
  },
});
