import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertNamedByRepo,
  parseItems,
  roadmapItems,
} from '../../../../packages/progress/src/index';
import {
  boardPages,
  FIXTURE_BOARD_ID,
  FIXTURE_REPO,
  repoPages,
} from '../../../../packages/progress/test/board-fixture';
import {
  FAKE_APP_ID,
  FAKE_BOARD_ID,
  FAKE_INSTALLATION_ID,
  FAKE_ORG,
  FAKE_REPO_NAME,
  FAKE_TOKEN,
  INSTALLED,
  READ_ONLY,
} from '../github-fake/contract';
import {
  appJwt,
  importAppKey,
  installationToken,
  readBoardPages,
  readRepoIssuePages,
  USER_AGENT,
  type App,
} from '../../worker/github';
import { roadmapWorld, type RoadmapWorld } from './harness';

/**
 * The roadmap's read-only GitHub App (#341, spec §5.2 item 3): a JWT signed
 * with the App's key, an installation holding the three reads and
 * Administration: read (#687), a token for the one repository asking for
 * and holding exactly the three reads (#704), and every page of the board.
 * worker/github.ts runs here in Node with every `fetch` answered by the fake
 * GitHub (test/github-fake), which verifies the JWT with the App's public key
 * as GitHub would; the same module runs inside workerd, with the PKCS#1 key
 * and the same fake, in roadmap.test.ts and routes.test.ts (#506).
 */
let world: RoadmapWorld;
const configureFake: RoadmapWorld['configureFake'] = (config) =>
  world.configureFake(config);
const resetFake: RoadmapWorld['resetFake'] = () => world.resetFake();
const seenByFake: RoadmapWorld['seenByFake'] = () => world.seenByFake();

let made = false;

// Made by the first test, in a beforeEach: a throw there fails each test,
// where one in a beforeAll would leave them skipped (#97).
beforeEach(() => {
  if (made) return;
  made = true;
  world = roadmapWorld();
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    world.github(new Request(input, init)),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const NOW = () => Math.floor(Date.now() / 1000);
const app = (over: Partial<App> = {}): App => ({
  appId: FAKE_APP_ID,
  key: world.appKey.pkcs1,
  org: FAKE_ORG,
  repoName: FAKE_REPO_NAME,
  ...over,
});

beforeEach(async () => {
  await resetFake();
});

describe('the App key and its JWT', () => {
  it('is accepted by GitHub when signed with the PKCS#1 key GitHub hands out', async () => {
    expect(world.appKey.pkcs1).toMatch(/^-----BEGIN RSA PRIVATE KEY-----\n/);
    expect(await installationToken(app(), NOW())).toBe(FAKE_TOKEN);
  });

  it('is accepted when the key is already PKCS#8', async () => {
    expect(world.appKey.pkcs8).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
    expect(
      await installationToken(app({ key: world.appKey.pkcs8 }), NOW()),
    ).toBe(FAKE_TOKEN);
  });

  it('is accepted when the key was pasted with Windows line endings', async () => {
    const crlf = world.appKey.pkcs1.replaceAll('\n', '\r\n');
    expect(crlf).toContain('\r\n');
    expect(await installationToken(app({ key: crlf }), NOW())).toBe(FAKE_TOKEN);
  });

  it('is accepted when the key was pasted with blank lines around it', async () => {
    expect(
      await installationToken(
        app({ key: `\n${world.appKey.pkcs1}\n\n` }),
        NOW(),
      ),
    ).toBe(FAKE_TOKEN);
  });

  it('carries iat a minute back and exp nine minutes ahead, inside GitHub’s ten', async () => {
    const jwt = await appJwt(FAKE_APP_ID, world.appKey.pkcs1, 1_000_000);
    const [header, payload] = jwt
      .split('.')
      .slice(0, 2)
      .map(
        (part) =>
          JSON.parse(
            atob(part.replaceAll('-', '+').replaceAll('_', '/')),
          ) as unknown,
      );
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(payload).toEqual({ iat: 999_940, exp: 1_000_540, iss: FAKE_APP_ID });
  });

  it('refuses a key that is not a PEM private key, by name', async () => {
    await expect(importAppKey('not a key')).rejects.toThrow(
      'ROADMAP_APP_KEY is not a PEM private key',
    );
  });
});

describe('installationToken', () => {
  it('sends its User-Agent on every request, which GitHub requires', async () => {
    await installationToken(app(), NOW());
    const seen = await seenByFake();
    expect(seen.map((s) => s.userAgent)).toEqual([USER_AGENT, USER_AGENT]);
  });

  it('refuses an installation on every repository of the org', async () => {
    await configureFake({ repositorySelection: 'all' });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App is installed on every shyden-labs repository; install it on fixture only',
    );
  });

  it('mints from the installation as it stands, Administration: read included (#704)', async () => {
    await expect(installationToken(app(), NOW())).resolves.toBe(FAKE_TOKEN);
  });

  it('refuses an installation that may write issues', async () => {
    await configureFake({
      installationPermissions: { ...INSTALLED, issues: 'write' },
    });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s installation has {"administration":"read","issues":"write","metadata":"read","organization_projects":"read"}, not exactly {"administration":"read","issues":"read","metadata":"read","organization_projects":"read"}',
    );
  });

  it('refuses an installation that may write administration (#704)', async () => {
    await configureFake({
      installationPermissions: { ...INSTALLED, administration: 'write' },
    });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s installation has {"administration":"write","issues":"read","metadata":"read","organization_projects":"read"}',
    );
  });

  it('refuses an installation without Administration: read, so a change to the App is seen (#704)', async () => {
    await configureFake({ installationPermissions: { ...READ_ONLY } });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s installation has {"issues":"read","metadata":"read","organization_projects":"read"}, not exactly',
    );
  });

  it('refuses an installation with a right beyond the four', async () => {
    await configureFake({
      installationPermissions: { ...INSTALLED, contents: 'read' },
    });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s installation has {"administration":"read","contents":"read","issues":"read","metadata":"read","organization_projects":"read"}',
    );
  });

  it('refuses an installation without the Projects read', async () => {
    await configureFake({
      installationPermissions: {
        administration: 'read',
        issues: 'read',
        metadata: 'read',
      },
    });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s installation has {"administration":"read","issues":"read","metadata":"read"}',
    );
  });

  it('refuses an issued token that carries Administration, as one minted without naming its rights would (#704)', async () => {
    await configureFake({ tokenPermissions: { ...INSTALLED } });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s token has {"administration":"read","issues":"read","metadata":"read","organization_projects":"read"}, not exactly {"issues":"read","metadata":"read","organization_projects":"read"}',
    );
  });

  it('refuses an issued token whose rights differ from the three reads', async () => {
    await configureFake({
      tokenPermissions: {
        issues: 'read',
        metadata: 'read',
        organization_projects: 'write',
      },
    });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s token has {"issues":"read","metadata":"read","organization_projects":"write"}',
    );
  });

  it('refuses an issued token that covers another repository', async () => {
    await configureFake({ tokenRepositories: ['fixture', 'other'] });
    await expect(installationToken(app(), NOW())).rejects.toThrow(
      'the roadmap App’s token covers ["fixture","other"], not ["fixture"]',
    );
  });

  it('names GitHub’s answer when GitHub refuses the JWT', async () => {
    await expect(installationToken(app({ appId: '1' }), NOW())).rejects.toThrow(
      'GitHub refused GET /orgs/shyden-labs/installation: HTTP 401',
    );
  });
});

describe('the fake GitHub issues tokens as GitHub does (#704)', () => {
  /** The fake's answer to a token request with this body. */
  const mint = async (body: unknown) => {
    const jwt = await appJwt(FAKE_APP_ID, world.appKey.pkcs1, NOW());
    return world.github(
      new Request(
        `https://api.github.com/app/installations/${String(FAKE_INSTALLATION_ID)}/access_tokens`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'User-Agent': USER_AGENT,
          },
          body: JSON.stringify(body),
        },
      ),
    );
  };

  it('narrows the token to the permissions the request names', async () => {
    const response = await mint({
      repositories: [FAKE_REPO_NAME],
      permissions: READ_ONLY,
    });
    expect(response.status).toBe(201);
    expect(
      (await response.json<{ permissions: unknown }>()).permissions,
    ).toEqual(READ_ONLY);
  });

  it('gives the token every right of the installation when the request names none', async () => {
    const response = await mint({ repositories: [FAKE_REPO_NAME] });
    expect(
      (await response.json<{ permissions: unknown }>()).permissions,
    ).toEqual(INSTALLED);
  });

  it('refuses a request for more than the installation holds', async () => {
    const response = await mint({
      repositories: [FAKE_REPO_NAME],
      permissions: { ...READ_ONLY, issues: 'write' },
    });
    expect(response.status).toBe(422);
  });

  it('refuses a request for a right the installation lacks', async () => {
    const response = await mint({
      repositories: [FAKE_REPO_NAME],
      permissions: { contents: 'read' },
    });
    expect(response.status).toBe(422);
  });
});

describe('readBoardPages', () => {
  it('reads every page, following each endCursor', async () => {
    const pages = await readBoardPages(FAKE_TOKEN, FAKE_BOARD_ID);
    expect(pages).toHaveLength(2);
    const cursors = (await seenByFake()).map((s) => s.cursor);
    expect(cursors).toEqual([null, '1']);
  });

  it('gives pages the shared parser reads as the fixture', async () => {
    const pages = await readBoardPages(FAKE_TOKEN, FAKE_BOARD_ID);
    const today = new Date().toISOString().slice(0, 10);
    expect(roadmapItems(pages, FIXTURE_REPO).items).toEqual(
      parseItems(boardPages(today), FIXTURE_REPO),
    );
  });

  it('sends its User-Agent on every page', async () => {
    await readBoardPages(FAKE_TOKEN, FAKE_BOARD_ID);
    expect((await seenByFake()).map((s) => s.userAgent)).toEqual([
      USER_AGENT,
      USER_AGENT,
    ]);
  });

  it('refuses an answer carrying GraphQL errors, naming the first', async () => {
    await configureFake({
      graphqlErrors: [{ message: 'Something went wrong' }],
    });
    await expect(readBoardPages(FAKE_TOKEN, FAKE_BOARD_ID)).rejects.toThrow(
      'GitHub’s GraphQL answered with errors: Something went wrong',
    );
  });

  it('names the status of a failed GraphQL request', async () => {
    await configureFake({ graphqlStatus: 502 });
    await expect(readBoardPages(FAKE_TOKEN, FAKE_BOARD_ID)).rejects.toThrow(
      'GitHub refused POST /graphql: HTTP 502',
    );
  });

  it('refuses a board id GitHub does not know', async () => {
    await expect(readBoardPages(FAKE_TOKEN, 'PVT_other')).rejects.toThrow(
      'GitHub found no board PVT_other',
    );
  });

  it('stops at 20 pages rather than follow a board that never ends', async () => {
    await configureFake({ endlessPages: true });
    await expect(readBoardPages(FAKE_TOKEN, FAKE_BOARD_ID)).rejects.toThrow(
      'the board PVT_fixture has more than 20 pages',
    );
    expect(await seenByFake()).toHaveLength(20);
  });
});

describe('readRepoIssuePages (#751)', () => {
  it('reads every page of the repository’s issues, following each endCursor', async () => {
    await configureFake({ repoPages: repoPages() });
    const pages = await readRepoIssuePages(
      FAKE_TOKEN,
      FAKE_ORG,
      FAKE_REPO_NAME,
    );
    expect(pages).toHaveLength(2);
    expect(
      (await seenByFake()).map((s) => [s.query, s.cursor] as const),
    ).toEqual([
      ['issues', null],
      ['issues', '1'],
    ]);
  });

  it('gives pages the shared cross-check reads as naming the fixture board’s issues', async () => {
    await configureFake({ repoPages: repoPages() });
    const pages = await readRepoIssuePages(
      FAKE_TOKEN,
      FAKE_ORG,
      FAKE_REPO_NAME,
    );
    const today = new Date().toISOString().slice(0, 10);
    expect(() => {
      assertNamedByRepo(
        boardPages(today),
        pages,
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).not.toThrow();
  });

  it('sends its User-Agent on every page', async () => {
    await configureFake({ repoPages: repoPages() });
    await readRepoIssuePages(FAKE_TOKEN, FAKE_ORG, FAKE_REPO_NAME);
    expect((await seenByFake()).map((s) => s.userAgent)).toEqual([
      USER_AGENT,
      USER_AGENT,
    ]);
  });

  it('refuses an answer carrying GraphQL errors, naming the first', async () => {
    await configureFake({
      graphqlErrors: [{ message: 'Something went wrong' }],
    });
    await expect(
      readRepoIssuePages(FAKE_TOKEN, FAKE_ORG, FAKE_REPO_NAME),
    ).rejects.toThrow(
      'GitHub’s GraphQL answered with errors: Something went wrong',
    );
  });

  it('names the status of a failed GraphQL request', async () => {
    await configureFake({ graphqlStatus: 502 });
    await expect(
      readRepoIssuePages(FAKE_TOKEN, FAKE_ORG, FAKE_REPO_NAME),
    ).rejects.toThrow('GitHub refused POST /graphql: HTTP 502');
  });

  it('refuses a repository GitHub does not know, by GitHub’s own error', async () => {
    await expect(
      readRepoIssuePages(FAKE_TOKEN, FAKE_ORG, 'other'),
    ).rejects.toThrow(
      "GitHub’s GraphQL answered with errors: Could not resolve to a Repository with the name 'shyden-labs/other'.",
    );
  });

  it('refuses an answer without the repository’s issues', async () => {
    await configureFake({ repoPages: [{ data: { repository: null } }] });
    await expect(
      readRepoIssuePages(FAKE_TOKEN, FAKE_ORG, FAKE_REPO_NAME),
    ).rejects.toThrow('GitHub found no issues for shyden-labs/fixture');
  });

  it('stops at 20 pages rather than follow a repository that never ends', async () => {
    await configureFake({ endlessPages: true });
    await expect(
      readRepoIssuePages(FAKE_TOKEN, FAKE_ORG, FAKE_REPO_NAME),
    ).rejects.toThrow(
      'the repository shyden-labs/fixture has more than 20 pages of issues',
    );
    expect(await seenByFake()).toHaveLength(20);
  });
});
