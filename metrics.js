(() => {
  const key = 'slx-funnel-v1';
  const stages = ['landing_view', 'drop_click', 'newsletter_request', 'product_notify_request'];
  window.slxMetric = event => {
    if (!stages.includes(event)) return;
    try {
      if (localStorage.getItem('slx-analytics-consent-v1') !== 'granted') return;
      if (sessionStorage.getItem(`${key}-${event}`)) return;
      const totals = JSON.parse(localStorage.getItem(key) ?? '{}');
      totals[event] = (totals[event] ?? 0) + 1;
      localStorage.setItem(key, JSON.stringify(totals));
      sessionStorage.setItem(`${key}-${event}`, '1');
    } catch {}
  };
  if (document.querySelector('.brand-hero')) {
    window.slxMetric('landing_view');
    window.addEventListener('slx:analytics-consent',()=>window.slxMetric('landing_view'));
  }
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-metric]');
    if (action) window.slxMetric(action.dataset.metric);
  });
  const report = document.querySelector('#metrics-report');
  if (!report) return;
  let totals = {};
  try { totals = JSON.parse(localStorage.getItem(key) ?? '{}'); } catch {}
  for (const item of report.querySelectorAll('[data-total]')) {
    item.textContent = totals[item.dataset.total] ?? 0;
  }
  if (totals.landing_view) {
    report.querySelector('#local-ctr').textContent = new Intl.NumberFormat('uk-UA', {
      style: 'percent', maximumFractionDigits: 1,
    }).format((totals.drop_click ?? 0) / totals.landing_view);
  }
})();
