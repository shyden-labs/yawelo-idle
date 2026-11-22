/**
 * The support pages' own script (#860). Shows the page's "did not load" line
 * when ShyDesk's piece never defined its element by the time the page
 * finished loading, and keeps the ticket's `#t=` token on the language
 * switch's link, which a plain link would drop.
 */
const failed = document.querySelector<HTMLElement>('[data-support-failed]');
window.addEventListener('load', () => {
  if (failed !== null && customElements.get('shydesk-support') === undefined)
    failed.hidden = false;
});

function carryFragment(): void {
  const link = document.querySelector<HTMLAnchorElement>(
    'a[data-language-switch]',
  );
  if (link === null) return;
  const url = new URL(link.href);
  url.hash = window.location.hash;
  link.href = url.href;
}

carryFragment();
window.addEventListener('hashchange', carryFragment);
