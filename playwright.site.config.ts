import { siteSmokeConfig } from './tests/site/smoke-config';

/** The site's browser suite (#827): see tests/site/smoke-config.ts. */
export default siteSmokeConfig(process.env);
