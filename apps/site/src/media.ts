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
 * carry: a value is required as given, and `null` must be absent. A host
 * with `sizeOnPastEnd` names the file's size in a 416's Content-Range; one
 * without must send no Content-Range there.
 */
export interface MediaHost {
  origin: string;
  headers: Readonly<Record<string, string | null>>;
  sizeOnPastEnd: boolean;
}

/** Production's host: its zone rule adds both headers to every answer. */
export const PROD_MEDIA: MediaHost = {
  origin: MEDIA_ORIGIN,
  headers: {
    'cross-origin-resource-policy': 'same-site',
    'x-content-type-options': 'nosniff',
  },
  sizeOnPastEnd: true,
};

/**
 * The dev copy's host (Shyden, 2026-10-20, "Dev media store"): the bucket
 * `yawelo-idle-media-dev` in the dev account, on its free r2.dev address,
 * which has no zone to add headers. It sends no CORP, which lets the dev copy
 * on workers.dev show the files, no nosniff, and a 416 with no Content-Range
 * (measured the same day). Telkomsel's DNS blocks every r2.dev name, so a
 * phone checking the dev copy uses Cloudflare's DNS.
 */
export const DEV_MEDIA: MediaHost = {
  origin: 'https://pub-cc0bef26b6c5493a8c18f31547d2bc72.r2.dev',
  headers: {
    'cross-origin-resource-policy': null,
    'x-content-type-options': null,
  },
  sizeOnPastEnd: false,
};
