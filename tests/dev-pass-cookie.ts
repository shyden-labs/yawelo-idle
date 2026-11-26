/**
 * The DEV pass as the site's dev door reads it on pages and on its embed
 * route (#1078 AC1): the `__Host-devpass` cookie, host-only on `door`, so it
 * reaches that door alone. Never a header: Playwright sends an extra header
 * to every host a page reaches, outside services included.
 */
export function devPassState(door: string, pass: string) {
  return {
    cookies: [
      {
        name: '__Host-devpass',
        value: pass,
        domain: door,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };
}
