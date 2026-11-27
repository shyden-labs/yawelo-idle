import { describe, expect, it } from 'vitest';
import { carriedText } from './carried';

describe('the carried board’s text (#1104 AC1)', () => {
  it('reads back as the snapshot it was made from', () => {
    const snapshot = { version: 3, items: [{ title: 'a < b & c > d' }] };
    expect(JSON.parse(carriedText(snapshot))).toEqual(snapshot);
  });

  it('holds no < at all, so no title can end the script or open a comment', () => {
    const text = carriedText({ title: '</script><!-- <b>' });
    expect({
      angles: text.includes('<'),
      escaped: text.split('\\u003c').length - 1,
    }).toEqual({
      angles: false,
      escaped: 3,
    });
  });
});
