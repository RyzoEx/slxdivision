const { shop } = require('./config.cjs');
const { escape } = require('../site-shell.cjs');

function storefront({preview=false,approved=false,frame=null}) {
  const sandbox = preview ? 'allow-scripts allow-same-origin'
    : 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';
  return `<section class="shell spreadshop-panel" id="spreadshop" aria-labelledby="spreadshop-title">
    <div class="spreadshop-intro">
      <div><p class="spreadshop-currency">GBP · £</p><h2 id="spreadshop-title">Каталог Spreadshop</h2></div>
      <div><p>Spreadshop виготовляє вироби, приймає оплату, доставляє замовлення й оформлює повернення.</p>
      <a class="detail-link" href="payment-delivery-returns.html">Оплата, доставка та повернення</a></div>
    </div>
    ${frame ? `<iframe class="spreadshop-frame" src="${escape(frame)}" title="Каталог SLX у Spreadshop"
      sandbox="${sandbox}" referrerpolicy="strict-origin"></iframe>`
    : '<p class="spreadshop-status">Передзапуск. Оформлення замовлень ще закрито.</p>'}
    ${approved ? `<a class="detail-link" href="${shop.prefix}/" target="_blank" rel="noopener noreferrer">Відкрити магазин у Spreadshop</a>` : ''}
  </section>`;
}

module.exports = {storefront};
