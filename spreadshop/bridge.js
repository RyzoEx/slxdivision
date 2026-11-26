(() => {
  const frame = document.querySelector('.spreadshop-frame');
  if (!frame) return;
  const origin = new URL(frame.src).origin;
  window.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== frame.contentWindow || event.data?.type !== 'slx-spreadshop-height') return;
    const height = event.data.height;
    if (Number.isInteger(height) && height >= 160 && height <= 5000) frame.height = String(height);
  });
})();
