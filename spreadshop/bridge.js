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
    const offline = state === 'offline';
    const loading = state === 'loading';
    frame.toggleAttribute('inert',!ready);
    status.hidden = ready;
    if (previewNote) previewNote.hidden = !ready;
    if (fallback) fallback.hidden = inactive || offline || loading;
    if (ready) return;
    heading.textContent = inactive ? 'COMING SOON' : offline ? 'You’re offline' : loading ? 'Loading catalog' : 'Catalog temporarily unavailable';
    message.textContent = inactive
      ? 'Sales have yet to open.'
      : offline ? 'You can still browse any SLX artwork already loaded. Reconnect to check the catalogue.'
        : loading ? 'Connecting to Spreadshop…' : 'Explore the SLX artwork below or try again later.';
  }

  const deferFailure = () => setTimeout(() => show(navigator.onLine ? 'unavailable' : 'offline'),15000);
  let timeout = deferFailure();
  window.addEventListener('offline',()=>{clearTimeout(timeout);show('offline');});
  window.addEventListener('online',()=>{clearTimeout(timeout);show('loading');frame.src=frame.src;timeout=deferFailure();});
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
    show(navigator.onLine ? state : 'offline');
  });
})();
