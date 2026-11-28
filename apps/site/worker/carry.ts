import { CARRIED_ID, carriedText } from '../src/roadmap/carried';
import { LOCALES, pagePath } from '../src/i18n';

/** The roadmap page in each language (`/roadmap`, `/id/roadmap`). */
const ROADMAP_PAGES: ReadonlySet<string> = new Set(
  LOCALES.map((locale) => pagePath(locale, 'roadmap')),
);

/**
 * The roadmap page with the held board written into it (#1104 AC1, route and
 * measured cost on the ticket): the map draws at once, with no loading line.
 * Any other page, or a roadmap answer that is not a page (a 304, a 404), is
 * returned as it came. With no board held yet the element stays empty and the
 * map waits silently for the live socket (AC2). Never cached, since the board
 * it carries changes.
 */
export async function carryBoard(
  pathname: string,
  page: Response,
  snapshot: () => Promise<unknown>,
): Promise<Response> {
  if (!ROADMAP_PAGES.has(pathname) || page.status !== 200) return page;
  const board = await snapshot();
  const carried =
    board === null
      ? page
      : new HTMLRewriter()
          .on(`script#${CARRIED_ID}`, {
            element(element) {
              element.setInnerContent(carriedText(board), { html: true });
            },
          })
          .transform(page);
  const answer = new Response(carried.body, carried);
  answer.headers.set('Cache-Control', 'no-store');
  return answer;
}
