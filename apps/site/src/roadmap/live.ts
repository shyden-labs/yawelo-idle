/**
 * The roadmap's live socket (#829): the Worker's `/api/roadmap/live` sends
 * the current snapshot on connect and each new version after it.
 */

/** The live socket's address for the page at `href`. */
export function liveUrl(href: string): string {
  const url = new URL('/api/roadmap/live', href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * Whether `next` should replace `shown`: the JSON read and the socket race,
 * so a snapshot older than the one on the page is dropped.
 */
export function newer(
  shown: { version: number } | null,
  next: { version: number },
): boolean {
  return shown === null || next.version > shown.version;
}
