import { describe, expect, it } from 'vitest';
import { oneLine } from '../../scripts/one-line';

/**
 * A GitHub Actions log reads each line on its own, and a line starting `::`
 * is a workflow command (#1007, SonarCloud tssecurity:S5145). Text from an
 * outside reply is made one line before a script prints it.
 */
describe('oneLine (#1007)', () => {
  it('turns a line feed into a space', () => {
    expect(oneLine('down\n::warning::x')).toBe('down ::warning::x');
  });

  it('turns a carriage return and line feed into one space', () => {
    expect(oneLine('down\r\n::warning::x')).toBe('down ::warning::x');
  });

  it('turns a lone carriage return into a space', () => {
    expect(oneLine('down\r::warning::x')).toBe('down ::warning::x');
  });

  it('leaves one-line text as it was', () => {
    expect(oneLine('✓ dev token reach: one account')).toBe(
      '✓ dev token reach: one account',
    );
  });
});
