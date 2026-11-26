const { shop } = require('./config.cjs');
const { escape } = require('../site-shell.cjs');

function storefront({preview=false,frame=null}) {
  const sandbox = preview ? 'allow-scripts allow-same-origin'
    : 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';
  return `<section class="shell spreadshop-panel" id="spreadshop" aria-labelledby="spreadshop-title">
    <div class="spreadshop-intro">
      <div><p class="spreadshop-currency">GBP · £</p><h2 id="spreadshop-title">Каталог Spreadshop</h2></div>
      <div><p>Spreadshop виготовляє вироби, приймає оплату, доставляє замовлення й оформлює повернення.</p>
      <a class="detail-link" href="payment-delivery-returns.html">Оплата, доставка та повернення</a></div>
    </div>
    <div class="spreadshop-stage">
      <div class="spreadshop-status" data-spreadshop-status>
        <div>
          <h3 lang="en" data-spreadshop-heading>COMING SOON</h3>
          <p role="status" data-spreadshop-message>${frame ? 'Завантажуємо каталог Spreadshop…' : 'Продажі ще не почалися. Повідомимо, коли каталог відкриється.'}</p>
          <button class="primary" type="button" data-notify="newsletter">Повідомити про запуск</button>
        </div>
        <img src="assets/brand/logo.webp" width="1035" height="754" alt="">
      </div>
      ${frame ? `<iframe class="spreadshop-frame" src="${escape(frame)}" title="Каталог SLX у Spreadshop"
        sandbox="${sandbox}" referrerpolicy="strict-origin" inert></iframe>` : ''}
    </div>
    ${frame && preview ? '<p class="spreadshop-preview-note" hidden>Локальне прев’ю · Оформлення вимкнене</p>' : ''}
    ${frame && !preview ? `<a class="detail-link spreadshop-fallback" href="${shop.prefix}/" target="_blank" rel="noopener noreferrer" hidden>Відкрити магазин у Spreadshop</a>` : ''}
  </section>`;
}

module.exports = {storefront};
