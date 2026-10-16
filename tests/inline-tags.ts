/**
 * The start tags of an HTML page, and those that need an inline allowance in
 * a Content-Security-Policy: a script with no `src`, a style element, a style
 * attribute or an event-handler attribute. One home for the served game shell
 * (apps/web/test/game.test.ts) and the holding page (apps/site/test/holding.test.ts,
 * #621).
 */
export const startTags = (html: string): string[] =>
  html.match(/<[a-zA-Z][^>]*>/g) ?? [];

export const inlineTags = (tags: readonly string[]): string[] =>
  tags.filter(
    (tag) =>
      (/^<script\b/i.test(tag) && !/\ssrc=/i.test(tag)) ||
      /^<style\b/i.test(tag) ||
      /\sstyle=/i.test(tag) ||
      /\son[a-z]+=/i.test(tag),
  );
