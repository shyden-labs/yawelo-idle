import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The promo media come from their R2 host (#713): the verify compares each
 * file byte for byte with apps/site/media/, asks for `bytes=0-1` and a range
 * past the end, and requires the host's headers on every answer; the page's
 * CSP names the media host alone. Predicted before the first run. Each row
 * puts back one way it could go wrong: a stale upload passed, a range-less
 * server passed, a 416 not required, a header that must be absent let
 * through, a header check dropped from one kind of answer, the media host
 * moved, and the page's CSP widened to its own origin. The dev store's rows:
 * its 416 judged like production's or not judged, its measured answers
 * changed, and the dev copy's rewrite skipping a page, a file or a script,
 * or counting the CSP wrong.
 */

const VERIFY = 'tests/unit/verify-prod.test.ts';
const WHOLE = `${VERIFY} › a promo media file, asked for whole >`;
const RANGE = `${VERIFY} › a promo media file, asked for bytes=0-1 >`;
const PAST = `${VERIFY} › a promo media file, asked for a range past its end >`;
const MEDIA = 'apps/site/src/media.test.ts';
const CONFIG = 'tests/unit/prod-config.test.ts';
const DEV = 'tests/unit/holding-dev.test.ts';
const BUILD = `${DEV} › the dev copy’s build >`;

export default mutationFile({
  targets: [VERIFY, MEDIA, CONFIG, DEV],
  mutations: [
    {
      name: 'stale-upload-passed',
      file: 'scripts/verify-prod.ts',
      anchor: '        sameBytes(answer.bytes, source.bytes)\n',
      replacement: '        true\n',
      red: {
        [`${WHOLE} names a file that differs from the tracked one, and how to upload it`]:
          'to deeply equal',
      },
    },
    {
      name: 'range-bytes-not-compared',
      file: 'scripts/verify-prod.ts',
      anchor: 'sameBytes(answer.bytes, source.bytes.subarray(0, 2))',
      replacement: 'true',
      red: {
        [`${RANGE} names bytes other than the tracked file’s first two`]:
          'to deeply equal',
      },
    },
    {
      name: 'range-less-server-passed',
      file: 'scripts/verify-prod.ts',
      anchor: 'statusCheck(label, answer, 206)',
      replacement: 'statusCheck(label, answer, 200)',
      red: {
        [`${RANGE} passes when it is 206 of exactly those two bytes, of its type, with the host’s headers`]:
          'to deeply equal',
        [`${RANGE} names a whole-file 200, which a range-less server sends, and judges nothing after it`]:
          'to deeply equal',
        [`${RANGE} names a Content-Range other than the two bytes of the tracked size`]:
          'to deeply equal',
        [`${RANGE} names bytes other than the tracked file’s first two`]:
          'to deeply equal',
        [`${RANGE} names the wrong type`]: 'to deeply equal',
        [`${RANGE} names a missing header`]: 'to deeply equal',
      },
    },
    {
      name: 'past-end-416-not-required',
      file: 'scripts/verify-prod.ts',
      anchor: 'statusCheck(label, answer, 416)',
      replacement: 'statusCheck(label, answer, 200)',
      red: {
        [`${PAST} passes when it is 416 naming the tracked size, with the host’s headers`]:
          'to deeply equal',
        [`${PAST} names a status other than 416 and judges nothing after it`]:
          'to deeply equal',
        [`${PAST} names a Content-Range other than the tracked size`]:
          'to deeply equal',
        [`${PAST} names a missing header`]: 'to deeply equal',
        [`${PAST} passes a 416 with no Content-Range from a host that sends none`]:
          'to deeply equal',
        [`${PAST} names a Content-Range from a host that sends none, so a change is seen`]:
          'to deeply equal',
        [`${PAST} names a missing Content-Range from a host that names the size`]:
          'to deeply equal',
      },
    },
    {
      name: 'past-end-size-always-required',
      file: 'scripts/verify-prod.ts',
      anchor: '  const expected = host.sizeOnPastEnd\n',
      replacement: '  const expected = true\n',
      red: {
        [`${PAST} passes a 416 with no Content-Range from a host that sends none`]:
          'to deeply equal',
        [`${PAST} names a Content-Range from a host that sends none, so a change is seen`]:
          'to deeply equal',
      },
    },
    {
      name: 'dev-content-range-let-through',
      file: 'scripts/verify-prod.ts',
      anchor: '    : null;\n',
      replacement: '    : range;\n',
      red: {
        [`${PAST} names a Content-Range from a host that sends none, so a change is seen`]:
          'to deeply equal',
      },
    },
    {
      name: 'dev-store-size-on-past-end',
      file: 'apps/site/src/media.ts',
      anchor: '  sizeOnPastEnd: false,\n',
      replacement: '  sizeOnPastEnd: true,\n',
      red: {
        [`${MEDIA} › the promo media > are judged on the dev store by exactly what its r2.dev address sends`]:
          'to deeply equal',
      },
    },
    {
      name: 'missing-page-skipped',
      file: 'scripts/holding-dev.ts',
      anchor: '    if (!files.has(path))\n',
      replacement: '    if (false)\n',
      red: {
        [`${BUILD} refuses a build missing a page that holds the media`]:
          'to throw',
      },
    },
    {
      name: 'unlisted-file-unchecked',
      file: 'scripts/holding-dev.ts',
      anchor:
        '      devMedia(text, MEDIA_ADDRESSES[path] ?? 0, path, from, to),\n',
      replacement:
        '      path in MEDIA_ADDRESSES\n        ? devMedia(text, MEDIA_ADDRESSES[path] ?? 0, path, from, to)\n        : text,\n',
      red: {
        [`${BUILD} refuses a page that gained a media address, rather than ship one still loading production’s`]:
          'to throw',
      },
    },
    {
      name: 'scripts-not-rewritten',
      file: 'scripts/holding-dev.ts',
      anchor: '/\\.(?:html|js|css)$/',
      replacement: '/\\.(?:html|css)$/',
      red: {
        [`${BUILD} rewrites _astro/a.js, which could name the media host`]:
          'expected false to be true',
      },
    },
    {
      name: 'csp-count-wrong',
      file: 'scripts/holding-dev.ts',
      anchor: '  _headers: 2,\n',
      replacement: '  _headers: 1,\n',
      red: {
        [`${BUILD} holds media addresses on both home pages and in the headers only`]:
          'to deeply equal',
        [`${BUILD} moves every media address in the build to the dev host`]:
          'moved 2 media addresses, expected 1',
      },
    },
    {
      name: 'absent-header-let-through',
      file: 'scripts/verify-prod.ts',
      anchor: '          : `${label}: ${name} is ${served}, expected none`;\n',
      replacement: '          : undefined;\n',
      red: {
        [`${WHOLE} names a header the host must not send`]: 'to deeply equal',
      },
    },
    {
      name: 'whole-file-headers-dropped',
      file: 'scripts/verify-prod.ts',
      anchor: '    ...hostHeaderChecks(url, answer, host),\n',
      replacement: '',
      red: {
        [`${WHOLE} passes when it is 200 of its type, byte for byte the tracked file, with the host’s headers`]:
          'verify-prod/media-checks',
        [`${WHOLE} names a missing Cross-Origin-Resource-Policy, which would let any site embed it`]:
          'to deeply equal',
        [`${WHOLE} names a missing nosniff`]: 'to deeply equal',
        [`${WHOLE} names a header the host must not send`]: 'to deeply equal',
      },
    },
    {
      name: 'range-headers-dropped',
      file: 'scripts/verify-prod.ts',
      anchor:
        '    typeCheck(label, answer, source.type),\n    ...hostHeaderChecks(label, answer, host),\n',
      replacement: '    typeCheck(label, answer, source.type),\n',
      red: {
        [`${RANGE} passes when it is 206 of exactly those two bytes, of its type, with the host’s headers`]:
          'verify-prod/media-range-checks',
        [`${RANGE} names a missing header`]: 'to deeply equal',
      },
    },
    {
      name: 'past-end-headers-dropped',
      file: 'scripts/verify-prod.ts',
      anchor: '    },\n    ...hostHeaderChecks(label, answer, host),\n',
      replacement: '    },\n',
      red: {
        [`${PAST} passes when it is 416 naming the tracked size, with the host’s headers`]:
          'verify-prod/media-past-end-checks',
        [`${PAST} names a missing header`]: 'to deeply equal',
      },
    },
    {
      name: 'media-host-moved',
      file: 'apps/site/src/media.ts',
      anchor: "export const MEDIA_ORIGIN = 'https://media.shyden.co.uk';\n",
      replacement: "export const MEDIA_ORIGIN = 'https://media.example';\n",
      red: {
        [`${MEDIA} › the promo media > are served from media.shyden.co.uk, on the same site as both pages that show them`]:
          'https://media.example',
        [`${MEDIA} › the promo media > name each file at its address on the media host`]:
          'https://media.example',
        [`${MEDIA} › the promo media > are judged on production by both headers of the zone rule, and a 416 that names the size`]:
          'to deeply equal',
      },
    },
    {
      name: 'csp-widened-to-self',
      file: 'apps/site/holding/public/_headers',
      anchor: 'media-src https://media.shyden.co.uk;',
      replacement: "media-src 'self' https://media.shyden.co.uk;",
      red: {
        [`${CONFIG} › the holding page’s security headers (#621 AC2) > sets a content security policy with no inline script or style, taking images and media from the media host alone (#713), on every path`]:
          "media-src 'self'",
      },
    },
  ],
});
