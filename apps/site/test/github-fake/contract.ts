/**
 * What the fake GitHub (fake-github.ts, Node) and the workerd tests that steer
 * it share (#341): its identities and the shapes of its controls. No Node
 * import here, so the workerd test program can read it.
 */
export const FAKE_APP_ID = '424242';
export const FAKE_INSTALLATION_ID = 99;
export const FAKE_TOKEN = 'ghs_fake-installation-token';
export const FAKE_ORG = 'shyden-labs';
export const FAKE_REPO_NAME = 'fixture';
export const FAKE_BOARD_ID = 'PVT_fixture';

/**
 * The header on a request the test Worker forwards to the fake, carrying the
 * api.github.com address it was meant for (test/roadmap/test-worker.ts).
 */
export const MEANT_FOR = 'x-fake-github-meant-for';

export type Permissions = Record<string, string>;
export const READ_ONLY: Permissions = {
  issues: 'read',
  metadata: 'read',
  organization_projects: 'read',
};
/**
 * The installation as it stands since 2026-10-20: the three reads and
 * Administration: read for the owner-review check (#687, website spec §5.2
 * item 3). Written out, not spread from READ_ONLY, so the token's rights
 * and the installation's are each stated once.
 */
export const INSTALLED: Permissions = {
  administration: 'read',
  issues: 'read',
  metadata: 'read',
  organization_projects: 'read',
};

/** What a test can change; `reset` puts every field back. */
export interface FakeConfig {
  repositorySelection: 'selected' | 'all';
  installationPermissions: Permissions;
  /**
   * The issued token's rights, or `null` for what GitHub does: the request's
   * `permissions` when it names them, else every right of the installation.
   */
  tokenPermissions: Permissions | null;
  tokenRepositories: string[];
  /** Raw pages served in order; `null` serves the shared fixture for today. */
  pages: unknown[] | null;
  /** Answer GraphQL with this HTTP status instead of the page. */
  graphqlStatus: number;
  /** Answer GraphQL 200 with this `errors` body instead of the page. */
  graphqlErrors: { message: string }[] | null;
  /** Say every page has a next one, as a broken paginator would. */
  endlessPages: boolean;
  /**
   * The board's item count each page reports (#703); `null` reports what
   * GitHub would: every item on every page served.
   */
  totalCount: number | null;
  /**
   * Raw pages of the repository's issues served in order for
   * REPO_ISSUES_QUERY (#751); `null` serves what GitHub would: one page
   * naming every issue of the repository the board's pages hold.
   */
  repoPages: unknown[] | null;
}

/** One request as the fake received it. */
export interface Seen {
  method: string;
  url: string;
  userAgent: string | null;
  /** For GraphQL: which query it asked, the board's or the repository's issues' (#751). */
  query?: 'board' | 'issues';
  /** For GraphQL: the cursor asked for (`null` for the first page). */
  cursor?: string | null;
  /** For an App call: the JWT's claims once verified. */
  claims?: { iat: number; exp: number; iss: string };
}
