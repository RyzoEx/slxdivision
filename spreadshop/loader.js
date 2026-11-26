(() => {
  const mount = document.querySelector('[data-spreadshop-mount]');
  const { shopName, shopPrefix, shopScript, shopLocale, parentOrigin } = mount.dataset;
  window.spread_shop_config = {
    shopName, prefix:shopPrefix, baseId:mount.id, locale:shopLocale,
    updateMetadata:false, usePushState:false,
  };
  const placeholder = document.querySelector('#spreadshop-message');
  let state = 'loading';
  let lastHeight = 0;

  function report(nextState) {
    const height = Math.max(200,Math.min(5000,Math.ceil(mount.getBoundingClientRect().height)));
    if (nextState === state && (state !== 'ready' || height === lastHeight)) return;
    state = nextState;
    lastHeight = height;
    window.parent.postMessage({type:'slx-spreadshop-state',state,height},parentOrigin);
  }

  const resize = new ResizeObserver(() => { if (state === 'ready') report('ready'); });
  resize.observe(mount);
  const script = document.createElement('script');
  script.src = shopScript;
  const timeout = setTimeout(() => report('unavailable'), 12000);
  const observer = new MutationObserver(() => {
    const text = mount.textContent.replace(/\s+/g,' ');
    if (/\b(?:this shop is not active|this shop has not been activated)\b/i.test(text)) {
      clearTimeout(timeout);
      report('inactive');
      return;
    }
    // The SDK replaces the loading placeholder with a shop page on successful render.
    if (!placeholder.isConnected && mount.querySelector('#sprd-content, .sprd-product-list, .sprd-detail-info')) {
      clearTimeout(timeout);
      report('ready');
    }
  });
  observer.observe(mount,{childList:true,subtree:true,characterData:true});
  script.addEventListener('error', () => {
    clearTimeout(timeout);
    report('unavailable');
  },{once:true});
  document.head.append(script);
})();
