(() => {
  let hasSeenIntro = false;
  try { hasSeenIntro = sessionStorage.getItem('slx-intro-seen') === '1'; } catch {}
  if (!hasSeenIntro && !location.hash && !location.search && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('intro-pending');
  }
})();
