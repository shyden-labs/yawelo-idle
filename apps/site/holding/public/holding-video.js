// The promo video's play rule (#621). It is muted and loops, so a browser
// allows it to start on its own, but a visitor who asked their device for
// reduced motion sees the still poster and presses play themselves. External,
// not inline, so the page's Content-Security-Policy needs no inline script.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

for (const video of document.querySelectorAll('video[data-autoplay]')) {
  if (!reduceMotion.matches) {
    // A browser may still refuse to autoplay (a power-saving mode, say); the
    // poster and the controls stay, so the visitor can start it.
    video.play().catch(() => undefined);
  }
}
