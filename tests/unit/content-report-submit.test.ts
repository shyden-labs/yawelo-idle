import { describe, expect, it } from 'vitest';
import {
  REPORT_MAX_BYTES,
  submitReport,
  type NewReport,
  type ReportOutcome,
} from '../../apps/sync-worker/src/content-reports';

/**
 * POST /v1/content-reports (#52 AC1 to AC3; design §B.1, §B.2): the handler's
 * order and answers, with the D1 store stood in. The store's own behaviour
 * (the quota, the unique index, the rollback) is tested against real D1 in
 * apps/sync-worker/test/content-reports.test.ts.
 */
const VALID = {
  course: 'en-id',
  kind: 'lexicon',
  itemId: 'lex.selamat-pagi',
  problem: 'wrong-translation',
  suggestion: 'Good morning',
  note: 'Said before about 11:00.',
  appVersion: '0.1.0',
  contentVersion: 'c1',
  installId: '3f2a1c4e-1b2d-4c3e-8f9a-0b1c2d3e4f5a',
  website: '',
} as const;

const NOW = Date.UTC(2026, 10, 19, 8, 30);

const post = (body: string) =>
  new Request('https://sync.test/v1/content-reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

/** A store that answers `outcome` and keeps what it was given. */
const storeAnswering = (outcome: ReportOutcome) => {
  const saved: NewReport[] = [];
  return {
    saved,
    store: (report: NewReport) => {
      saved.push(report);
      return Promise.resolve(outcome);
    },
  };
};

const submit = (
  body: unknown,
  outcome: ReportOutcome = 'stored',
  now = NOW,
) => {
  const { saved, store } = storeAnswering(outcome);
  const response = submitReport(
    post(typeof body === 'string' ? body : JSON.stringify(body)),
    store,
    { uuid: () => 'report-1', now: () => now },
  );
  return { saved, response };
};

describe('a stored report (#52 AC1)', () => {
  it('answers 201 with the report id, uncached', async () => {
    const { response } = submit(VALID);
    const answer = await response;
    expect.soft(answer.status).toBe(201);
    expect.soft(answer.headers.get('cache-control')).toBe('no-store');
    expect.soft(await answer.json()).toEqual({ id: 'report-1' });
  });

  it('gives the store every field, its id, time and UTC day, and no honeypot', async () => {
    const { saved, response } = submit(VALID);
    await response;
    expect(saved).toEqual([
      {
        id: 'report-1',
        createdAt: NOW,
        utcDay: '2026-11-19',
        course: 'en-id',
        kind: 'lexicon',
        itemId: 'lex.selamat-pagi',
        problem: 'wrong-translation',
        suggestion: 'Good morning',
        note: 'Said before about 11:00.',
        appVersion: '0.1.0',
        contentVersion: 'c1',
        installId: '3f2a1c4e-1b2d-4c3e-8f9a-0b1c2d3e4f5a',
      },
    ]);
  });

  it('stores a missing suggestion and note as null', async () => {
    const bare = Object.fromEntries(
      Object.entries(VALID).filter(
        ([key]) => key !== 'suggestion' && key !== 'note',
      ),
    );
    const { saved, response } = submit(bare);
    await response;
    expect.soft(saved[0]?.suggestion).toBeNull();
    expect.soft(saved[0]?.note).toBeNull();
  });
});

describe('the UTC day a report counts against (#52 AC3)', () => {
  it('is the same day at its last millisecond', async () => {
    const { saved, response } = submit(
      VALID,
      'stored',
      Date.UTC(2026, 10, 19, 23, 59, 59, 999),
    );
    await response;
    expect(saved[0]?.utcDay).toBe('2026-11-19');
  });

  it('is the next day one millisecond later', async () => {
    const { saved, response } = submit(
      VALID,
      'stored',
      Date.UTC(2026, 10, 20, 0, 0, 0, 0),
    );
    await response;
    expect(saved[0]?.utcDay).toBe('2026-11-20');
  });
});

describe('a filled honeypot (#52 AC2)', () => {
  it('answers 201 like a stored report and writes nothing', async () => {
    const { saved, response } = submit({ ...VALID, website: 'http://spam' });
    const answer = await response;
    expect.soft(answer.status).toBe(201);
    expect.soft(await answer.json()).toEqual({ id: 'report-1' });
    expect.soft(saved).toEqual([]);
  });
});

describe('a refused body writes nothing (#52 AC2)', () => {
  it('an unknown field: 422 naming it', async () => {
    const { saved, response } = submit({ ...VALID, email: 'a@b.c' });
    const answer = await response;
    expect.soft(answer.status).toBe(422);
    expect.soft(await answer.json()).toEqual({
      error: 'invalid_field',
      field: 'email',
    });
    expect.soft(saved).toEqual([]);
  });

  it('a body that is not JSON: 400', async () => {
    const { saved, response } = submit('{not json');
    expect.soft((await response).status).toBe(400);
    expect.soft(saved).toEqual([]);
  });

  it(`a body over ${String(REPORT_MAX_BYTES)} bytes: 413`, async () => {
    const { saved, response } = submit({
      ...VALID,
      note: 'x'.repeat(REPORT_MAX_BYTES),
    });
    expect.soft((await response).status).toBe(413);
    expect.soft(saved).toEqual([]);
  });
});

describe('the body limit fits the longest valid report (#52 AC2)', () => {
  it('two texts of 1,000 escaped emoji each still fit', async () => {
    const escapedEmoji = String.raw`😀`.repeat(1_000);
    const body = JSON.stringify({ ...VALID, suggestion: 'S', note: 'N' })
      .replace('"S"', `"${escapedEmoji}"`)
      .replace('"N"', `"${escapedEmoji}"`);
    const { response } = submit(body);
    expect((await response).status).toBe(201);
  });
});

describe("the store's refusals (#52 AC3)", () => {
  it("over the day's quota: 429", async () => {
    const answer = await submit(VALID, 'over_quota').response;
    expect.soft(answer.status).toBe(429);
    expect.soft(await answer.json()).toEqual({ error: 'daily_limit' });
  });

  it('an open report on the same item: 409', async () => {
    const answer = await submit(VALID, 'duplicate').response;
    expect.soft(answer.status).toBe(409);
    expect.soft(await answer.json()).toEqual({ error: 'already_reported' });
  });
});
