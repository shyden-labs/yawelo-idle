/**
 * The holding page's one script (#621): it runs only for /media/*
 * (`run_worker_first` in wrangler.jsonc) and answers in byte ranges, which the
 * plain assets do not (media.ts). Every page is still a static file.
 */
import { mediaResponse, type Assets } from './media.ts';

interface Env {
  ASSETS: Assets;
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> =>
    mediaResponse(request, env.ASSETS),
};
