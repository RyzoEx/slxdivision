(() => {
  const mount = document.querySelector('#spreadshop-mount');
  const { shopId, shopPrefix, shopScript, shopLocale, parentOrigin } = mount.dataset;
  window.spread_shop_config = {
    shopName:shopId, prefix:shopPrefix, baseId:mount.id, locale:shopLocale,
    updateMetadata:false, usePushState:false,
  };
  let lastHeight;
  function sendHeight() {
    const height = Math.max(200,Math.min(5000,Math.ceil(mount.getBoundingClientRect().height+32)));
    if (height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({type:'slx-spreadshop-height',height},parentOrigin);
  }
  new ResizeObserver(sendHeight).observe(mount);
  const placeholder = document.querySelector('#spreadshop-message');
  const failure = 'Каталог Spreadshop зараз недоступний. Спробуйте пізніше.';
  const script = document.createElement('script');
  script.src = shopScript;
  const timeout = setTimeout(() => {
    if (placeholder.isConnected) placeholder.textContent = failure;
  }, 12000);
  script.addEventListener('error', () => {
    clearTimeout(timeout);
    if (placeholder.isConnected) placeholder.textContent = failure;
  });
  document.head.append(script);
})();
