# Promo media

The holding page's promo video and its poster (#713). These tracked files are the source of truth. The pages load them from Cloudflare R2, which answers byte-range requests (206), so Safari and other players can fetch and seek the video the standard way. They are not shipped with the page build.

The video is not licensed for reuse (see `LICENSE-CONTENT.md`).

| File                           | Content type |
| ------------------------------ | ------------ |
| `yawelo-idle-promo-poster.jpg` | `image/jpeg` |
| `yawelo-idle-promo.mp4`        | `video/mp4`  |
| `yawelo-idle-promo.webm`       | `video/webm` |

`apps/site/src/media.ts` lists the same files and names the media host. Its test fails if this folder and that list disagree.

## Where they are served

- **Production:** bucket `yawelo-idle-media` in the main Cloudflare account, on the custom domain `https://media.shyden.co.uk`. A response-header rule on the `shyden.co.uk` zone, scoped to that host, adds `Cross-Origin-Resource-Policy: same-site` and `X-Content-Type-Options: nosniff`. So yawelo-idle.shyden.co.uk and shyden.co.uk can show the files, and other sites cannot.
- **Dev copy:** bucket `yawelo-idle-media-dev` in the main Cloudflare account, on the custom domain `https://dev-media.shyden.co.uk` (#768), set up like production's. A second response-header rule on the zone, scoped to that host alone, adds the same two headers. Indonesian providers block every free `r2.dev` address (Telkomsel and Biznet, even through Cloudflare's DNS), so dev keeps to our own domain. Both dev pages that show the files are on `shyden.co.uk`: the front door `dev.yawelo-idle.shyden.co.uk` and the phone-check copy `dev-holding.yawelo-idle.shyden.co.uk`. `scripts/holding-dev.ts` points the dev copy's pages and CSP at this host, and the dev verify expects the same answers as production (`DEV_MEDIA` in `apps/site/src/media.ts`).

## Uploading a new or changed file

Shyden uploads by hand (2026-10-20, "By hand + checklist"). No repository credential can write to either bucket.

1. Commit the new file here, with the same name as in the table, or add a row to the table and to `PROMO` in `apps/site/src/media.ts`.
2. In the Cloudflare dashboard, open **R2 → `yawelo-idle-media`** (main account) and upload the file under exactly that name. Then do the same in **R2 → `yawelo-idle-media-dev`** (same account).
3. In both buckets, check that the object's content type matches the table. If it doesn't, set it in the object's metadata.
4. Merge into `develop`. The dev deploy's verify downloads every file from the dev store, and the release's verify from the media host, and each compares it byte for byte with the copy here. It also checks the range answers (206 for `bytes=0-1`, 416 for a range past the end) and the headers. A missed or wrong upload turns the deploy red and names the file.
