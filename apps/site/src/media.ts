/**
 * The promo media (#713): the poster and the video in two formats, tracked in
 * apps/site/media/ and served from the Cloudflare R2 bucket
 * `yawelo-idle-media` on media.shyden.co.uk, which answers byte ranges (206)
 * with no Worker. The host is on the same site as yawelo-idle.shyden.co.uk and
 * shyden.co.uk, so its `Cross-Origin-Resource-Policy: same-site` (a zone
 * response-header rule) lets both pages show them and no other site.
 *
 * No imports: scripts/verify-prod.ts and scripts/holding-dev.ts load this file
 * under Node's own loader.
 */
export const MEDIA_ORIGIN = 'https://media.shyden.co.uk';

/** One promo file: its name in the bucket and in apps/site/media/, and its content type. */
export interface MediaFile {
  file: string;
  type: string;
}

/** The poster, then the MP4 the page offers first, then the WebM. */
export const PROMO: readonly MediaFile[] = [
  { file: 'yawelo-idle-promo-poster.jpg', type: 'image/jpeg' },
  { file: 'yawelo-idle-promo.mp4', type: 'video/mp4' },
  { file: 'yawelo-idle-promo.webm', type: 'video/webm' },
];

/** The address `file` is served at on the media host. */
export const mediaUrl = (file: string): string => `${MEDIA_ORIGIN}/${file}`;

/**
 * A host the promo media are served from, and the headers each answer must
 * carry, each required as given. A range past the end answers 416 naming
 * the file's size in its Content-Range.
 */
export interface MediaHost {
  origin: string;
  headers: Readonly<Record<string, string>>;
}

/** Production's host: its zone rule adds both headers to every answer. */
export const PROD_MEDIA: MediaHost = {
  origin: MEDIA_ORIGIN,
  headers: {
    'cross-origin-resource-policy': 'same-site',
    'x-content-type-options': 'nosniff',
  },
};

/**
 * The dev copy's host (#768): the bucket `yawelo-idle-media-dev` on
 * dev-media.shyden.co.uk, set up like production's. Indonesian providers
 * block every free r2.dev name (Telkomsel and Biznet, measured 2026-10-20 and
 * 2026-10-26), so dev's media sit on our own domain, and a zone rule scoped to
 * this host adds the same two headers as production's. Both dev pages that
 * show the media are on shyden.co.uk, so CORP same-site lets them load it.
 */
export const DEV_MEDIA: MediaHost = {
  ...PROD_MEDIA,
  origin: 'https://dev-media.shyden.co.uk',
};
