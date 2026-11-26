(() => {
  const id = 'G-FS55E1QPDN';
  const mode = document.querySelector('meta[name="slx-analytics"]')?.content;
  const live = mode === 'live' && location.origin === 'https://slxdivision.vercel.app';
  const debug = mode === 'debug' && ['localhost','127.0.0.1'].includes(location.hostname);
  const key = 'slx-analytics-consent-v1';
  const disabled = `ga-disable-${id}`;
  const denied = {analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
  let choice;
  try { choice = localStorage.getItem(key); } catch {}
  let started = false;
  const destinations = new Set(['slxdivision.myspreadshop.co.uk']);

  function pageLocation() {
    const url = new URL(location.pathname === '/index.html' ? '/' : location.pathname, location.origin);
    const query = new URLSearchParams(location.search);
    const campaignIds = (document.querySelector('meta[name="slx-campaign-ids"]')?.content ?? '').split(',');
    const publicTags = new Set(['google','instagram','facebook','tiktok','telegram','youtube','newsletter','slx','organic','social',
      'email','referral','creator','cpc','paid_social','drop001','heavy-dangels',...campaignIds]);
    for (const param of ['utm_source','utm_medium','utm_campaign','utm_id','utm_content','utm_term']) {
      const value = query.get(param)?.toLowerCase();
      if (value && publicTags.has(value)) url.searchParams.set(param,value);
    }
    return url.href;
  }

  function start() {
    if (started || choice !== 'granted' || !(live || debug)) return;
    started = true;
    window[disabled] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    const gtag = window.gtag;
    gtag('consent','default',denied);
    gtag('consent','update',{...denied,analytics_storage:'granted'});
    gtag('js',new Date());
    let referrer = '';
    try {
      const source = new URL(document.referrer);
      if (['https:','http:'].includes(source.protocol)) referrer = source.origin + '/';
    } catch {}
    gtag('set',{page_location:pageLocation(),page_referrer:referrer,ads_data_redaction:true});
    gtag('config',id,{
      send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
      cookie_domain:'none',cookie_expires:7776000,cookie_update:false,
      ...(debug ? {debug_mode:true} : {}),
    });
    send('page_view');
    const item = document.querySelector('[data-product-page]');
    if (item) send('view_item',{items:[{item_id:item.dataset.productPage,item_name:document.querySelector('main h1').textContent}]});
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.append(script);
  }

  function send(event, params = {}) {
    if (choice !== 'granted' || !started) return;
    window.gtag('event',event,{...params,send_to:id});
  }

  function clearCookies() {
    for (const name of document.cookie.split(';').map(pair=>pair.split('=')[0].trim())) {
      if (name === '_ga' || name === `_ga_${id.slice(2)}`) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${location.hostname}; SameSite=Lax`;
      }
    }
  }

  function apply(value) {
    choice = value;
    window.dispatchEvent(new Event('slx:analytics-consent'));
    if (choice === 'granted') {
      start();
      return;
    }
    window[disabled] = true;
    clearCookies();
    if (started) location.reload();
  }

  const panel = document.createElement('section');
  panel.className = 'cookie-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby','cookie-title');
  panel.innerHTML = `<h2 id="cookie-title">Cookies аналітики</h2>
    <p>Дозволити Google Analytics вимірювати відвідування SLX? Ваш вибір не впливає на роботу магазину.</p>
    <div class="cookie-actions">
      <button class="secondary" type="button" data-consent="denied">Відхилити</button>
      <button class="secondary" type="button" data-consent="granted">Дозволити</button>
      <a class="detail-link" href="/privacy.html">Політика приватності</a>
    </div>`;
  document.body.append(panel);
  panel.hidden = !(live || debug) || ['granted','denied'].includes(choice);
  apply(choice);

  panel.addEventListener('click',event=>{
    const button = event.target.closest('[data-consent]');
    if (!button) return;
    try { localStorage.setItem(key,button.dataset.consent); } catch {}
    panel.hidden = true;
    apply(button.dataset.consent);
  });
  window.addEventListener('storage',event=>{
    if (event.key !== key && event.key !== null) return;
    panel.hidden = !(live || debug) || ['granted','denied'].includes(event.newValue);
    apply(event.newValue);
  });
  document.addEventListener('click',event=>{
    const target = event.target.closest('[data-cookie-settings], a[href]');
    if (!target) return;
    if (target.matches('[data-cookie-settings]')) {
      panel.hidden = false;
      panel.querySelector('button').focus();
    } else if (target.protocol === 'https:' && destinations.has(target.hostname)) {
      send('spreadshop_click',{destination:'spreadshop',placement:'storefront'});
    }
  },true);
  window.addEventListener('slx:spreadshop-click',()=>{
    send('spreadshop_click',{destination:'spreadshop',placement:'embedded_catalog'});
  });
})();
