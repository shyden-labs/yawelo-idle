import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The built holding home pages take the poster and the video from the media
 * host (#713), which answers byte ranges, not from the page's own origin,
 * whose asset router does not. Predicted before the first run. Each row puts
 * one address back on the page's own origin, as before #713.
 */

const HOLDING = 'apps/site/test/holding.test.ts';
const HOMES = ['index.html', 'id/index.html'];
const ATTRIBUTES =
  'gives the promo video exactly these attributes: muted, looped, inline, with controls and a poster, started by the play rule';
const SOURCES = 'offers MP4 first, then WebM, both from the media host (#713)';
const onEvery = (title: string, text: string): Record<string, string> =>
  Object.fromEntries(
    HOMES.map((page) => [
      `${HOLDING} › the holding home page ${page} > ${title}`,
      text,
    ]),
  );

export default mutationFile({
  targets: [HOLDING],
  mutations: [
    {
      name: 'poster-from-the-page-origin',
      file: 'apps/site/src/layouts/Holding.astro',
      anchor: "poster={mediaUrl('yawelo-idle-promo-poster.jpg')}",
      replacement: 'poster="/media/yawelo-idle-promo-poster.jpg"',
      red: onEvery(
        ATTRIBUTES,
        'https://media.shyden.co.uk/yawelo-idle-promo-poster.jpg',
      ),
    },
    {
      name: 'mp4-from-the-page-origin',
      file: 'apps/site/src/layouts/Holding.astro',
      anchor:
        '<source src={mediaUrl(\'yawelo-idle-promo.mp4\')} type="video/mp4" />',
      replacement:
        '<source src="/media/yawelo-idle-promo.mp4" type="video/mp4" />',
      red: onEvery(SOURCES, 'to deeply equal'),
    },
  ],
});
