const { shop } = require('./config.cjs');
const { escape } = require('../site-shell.cjs');

function storefront({preview=false,frame=null}) {
  const sandbox = preview ? 'allow-scripts allow-same-origin'
    : 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';
  return `<section class="shell spreadshop-panel" id="spreadshop" aria-labelledby="spreadshop-title">
    <div class="spreadshop-intro">
      <div><p class="spreadshop-currency">GBP · £</p><h2 id="spreadshop-title">Spreadshop catalog</h2></div>
      <div><p>Spreadshop handles production, payment, shipping and returns.</p>
      <a class="detail-link" href="payment-delivery-returns.html">Payment, shipping and returns</a></div>
    </div>
    <div class="spreadshop-stage">
      <div class="spreadshop-status" data-spreadshop-status>
        <div>
          <h3 lang="en" data-spreadshop-heading>COMING SOON</h3>
          <p role="status" data-spreadshop-message>${frame ? 'Loading the Spreadshop catalog…' : 'Sales have yet to open. Get notified when the catalog launches.'}</p>
          <button class="primary" type="button" data-notify="newsletter">Notify me at launch</button>
        </div>
        <img src="assets/brand/logo.webp" width="1035" height="754" alt="">
      </div>
      ${frame ? `<iframe class="spreadshop-frame" src="${escape(frame)}" title="SLX catalog on Spreadshop"
        sandbox="${sandbox}" referrerpolicy="strict-origin" inert></iframe>` : ''}
    </div>
    ${frame && preview ? '<p class="spreadshop-preview-note" hidden>Local preview · Checkout disabled</p>' : ''}
    ${frame && !preview ? `<a class="detail-link spreadshop-fallback" href="${shop.prefix}/" target="_blank" rel="noopener noreferrer" hidden>Open SLX on Spreadshop</a>` : ''}
  </section>`;
}

module.exports = {storefront};
