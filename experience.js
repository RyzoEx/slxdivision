(() => {
  const root = document.documentElement;
  if (!root.classList.contains('intro-pending')) return;
  const intro = document.querySelector('#site-intro');
  const dismiss = () => {
    root.classList.remove('intro-pending');
    if (intro.open) intro.close();
  };
  intro.showModal();
  try { sessionStorage.setItem('slx-intro-seen', '1'); } catch {}
  intro.querySelector('button').addEventListener('click', dismiss);
  intro.addEventListener('close', dismiss);
  setTimeout(dismiss, 720);
})();
