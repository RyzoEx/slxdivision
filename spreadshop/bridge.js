(() => {
  const frame = document.querySelector('.spreadshop-frame');
  if (!frame) return;
  const origin = new URL(frame.src).origin;
  const status = document.querySelector('[data-spreadshop-status]');
  const heading = status.querySelector('[data-spreadshop-heading]');
  const message = status.querySelector('[data-spreadshop-message]');
  const previewNote = document.querySelector('.spreadshop-preview-note');
  const fallback = document.querySelector('.spreadshop-fallback');

  function show(state) {
    const ready = state === 'ready';
    const inactive = state === 'inactive';
    frame.toggleAttribute('inert',!ready);
    status.hidden = ready;
    if (previewNote) previewNote.hidden = !ready;
    if (fallback) fallback.hidden = inactive;
    if (ready) return;
    heading.lang = inactive ? 'en' : 'en';
    heading.textContent = inactive ? 'COMING SOON' : 'Catalog temporarily unavailable';
    message.textContent = inactive
      ? 'Sales have yet to open.'
      : 'Explore the SLX artwork below or try again later.';
  }

  const timeout = setTimeout(() => show('unavailable'),15000);
  window.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'slx-spreadshop-click' && !frame.hasAttribute('inert')) {
      window.dispatchEvent(new Event('slx:spreadshop-click'));
      return;
    }
    if (event.data?.type !== 'slx-spreadshop-state') return;
    const {state,height} = event.data;
    if (!['ready','inactive','unavailable'].includes(state)) return;
    if (!Number.isInteger(height) || height < 200 || height > 5000) return;
    clearTimeout(timeout);
    frame.height = String(height);
    show(state);
  });
})();
