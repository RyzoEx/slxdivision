const { faqList, socialLinks, escape } = require('./site-shell.cjs');
const launchSignup = require('./signup-config.cjs');
const { grid, collectionsPage } = require('./inventory-pages.cjs');
const { storefront } = require('./spreadshop/storefront.cjs');
const empty = (text = 'No items yet.') =>
  `<section class="shell empty-page"><p>${escape(text)}</p></section>`;
function lookbook(collections) {
  const editions = collections.filter(collection => collection.lookbook?.length);
  if (!editions.length) return empty('No photographs yet.');
  return editions.map(collection => `<section class="shell inventory">
    <h2><a href="collection-${collection.id}.html">${escape(collection.name)}</a></h2>
    <div class="inventory-grid lookbook-grid">${collection.lookbook.map(image =>
      `<a class="inventory-photo" href="${escape(image.src)}"><img src="${escape(image.src)}" alt="${escape(image.alt)}" loading="lazy" decoding="async"></a>`).join('')}</div>
  </section>`).join('');
}

module.exports = ({ settings, catalog, spreadshop }) => ({
  'account.html': {
    title: 'My account', desc: 'Sign in and view your order history at SLX.', noindex:true, analytics:false, script:'account.js',
    content: '<section class="shell account-panel" id="slx-account"><p role="status">Loading your account…</p></section>',
  },
  'privacy.html': {
    title:'Privacy policy',
    desc:'How SLX Division uses personal data, cookies and Google Analytics, and how to change your choices.',
    content:`<section class="shell faq-section privacy-content">
      <h2>Information you give SLX</h2><p>When you contact us, subscribe for updates or use your account, SLX uses the information you provide to respond, send requested updates or run your account. You can unsubscribe using the link in the email. For questions about your data, <a class="detail-link" href="contact.html">contact SLX</a>.</p>
      <h2>Essential cookies and browser storage</h2><p>The site saves your analytics preference in your browser. Sign-in, the cart and favorites may use cookies or browser storage. SLX local metrics require analytics consent.</p>
      <h2>Google Analytics 4</h2><p>With your consent, Google Analytics measures public page visits, product and collection views, artwork opens, teaser plays, social and Spreadshop clicks, and campaign sources. Google receives browser details and analytics cookie identifiers. SLX analytics cookies expire after up to 90 days. SLX does not send form entries, account or order data, customer names, emails or phone numbers to analytics. Ad personalization is disabled.</p>
      <p>Use Cookie settings to reject analytics or withdraw consent. Withdrawal stops new events and removes accessible SLX analytics cookies. See the <a class="detail-link" href="cookie-policy.html">Cookie policy</a> and the <a class="detail-link" href="https://policies.google.com/privacy?hl=en">Google Privacy Policy</a>.</p>
      <h2>Notifications and deletion</h2><p>When signup is available, SLX stores your email, the selected design, and the date and version of your consent. News and marketing require separate consent. Use a link in a notification to withdraw or delete the related signup. You can also ask SLX through its contact page. SLX checks that you control the address before deleting a record on request.</p>
      <h2>Spreadshop</h2><p>Spreadshop has its own privacy terms and cookie settings. Your SLX analytics preference controls the SLX tag. See the purchase data terms on Spreadshop.</p>
      <button class="secondary" type="button" data-cookie-settings>Cookie settings</button>
    </section>`,
  },
  'cookie-policy.html': {
    title:'Cookie policy',desc:'Browser storage and analytics preferences on SLX Division.',
    content:'<section class="shell faq-section privacy-content"><h2>Store preferences</h2><p>The cart, favourites and your analytics choice use browser storage. An authenticated session uses a cookie to keep you signed in.</p><h2>Optional analytics</h2><p>The SLX analytics tag requires both release approval and your consent. Analytics consent is currently available in the development test flow. You can change your preference in Cookie settings.</p><button class="secondary" type="button" data-cookie-settings>Cookie settings</button><p><a class="detail-link" href="privacy.html">Privacy policy</a></p></section>',
  },
  'terms.html': {
    title:'Terms of use',desc:'Terms for the SLX Division pre-launch website.',
    content:'<section class="shell faq-section privacy-content"><h2>Pre-launch website</h2><p>SLX Division displays artwork and collection information. Purchases are unavailable during pre-launch and no product availability or launch date is guaranteed.</p><h2>Partner shop</h2><p>If partner sales open, Spreadshop provides the official catalogue, checkout, payment, delivery and returns under its published terms. See <a class="detail-link" href="payment-delivery-returns.html">Payment, shipping and returns</a>.</p><h2>Questions</h2><p>Use the official channels on the <a class="detail-link" href="contact.html">Contact page</a>.</p></section>',
  },
  'shop.html': {
    title: 'Shop', seoTitle:'Streetwear shop',
    desc: 'Explore original print artwork, tees and accessories from Heavy DAngels.',
    content: spreadshop
      ? `${storefront(spreadshop)}<h2 class="shell related-title">Designs by SLX</h2>${grid(catalog.activeProducts,{tools:true})}`
      : grid(catalog.activeProducts, { tools: true }),
  },
  'collections.html': {
    title: 'Collections', seoTitle:'Streetwear collections',
    desc: 'Explore Heavy DAngels, the first drop from independent Ukrainian streetwear label SLX Division.',
    content: collectionsPage(catalog.collections.filter(collection => !collection.archived), catalog.products),
  },
  'about.html': {
    title: 'About SLX', seoTitle:'About the brand',
    desc: 'SLX Division is an independent Ukrainian streetwear label influenced by underground Y2K, loose fits and record sleeve graphics.',
    content: `<div class="shell story-grid"><article><h2>Independent Ukrainian streetwear</h2><p>SLX is an independent label influenced by underground Y2K, loose cuts and the graphics of old record sleeves.</p><p>We develop our own prints and plan to make pieces after order confirmation.</p><a class="detail-link" href="payment-delivery-returns.html#made-to-order">How it works</a><p><a class="detail-link" href="founders.html">Founders of SLX</a></p></article><img src="assets/brand/logo.webp" alt="Orbital emblem of SLX" width="1035" height="754"></div>`,
  },
  'founders.html': {
    title: 'Founders', desc: 'The founding of SLX.',
    content: `<section class="shell story-grid"><article><h2>Founders of SLX</h2><p>SLX was founded by two people as an independent streetwear project.</p></article></section>`,
  },
  'lookbook.html': {
    title: 'Lookbook', seoTitle:'Collection lookbook',
    desc: 'Photography and lookbooks from SLX Division.',
    noindex: !catalog.collections.some(collection => collection.lookbook?.length),
    content: lookbook(catalog.collections),
  },
  'archive.html': {
    title: 'Archive', seoTitle:'Collection archive',
    desc: 'Past collections from SLX Division.',
    noindex: !catalog.collections.some(collection => collection.archived),
    content: catalog.collections.some(collection => collection.archived)
      ? collectionsPage(catalog.collections.filter(collection => collection.archived), catalog.products)
      : empty('The archive is empty for now.'),
  },
  'contact.html': {
    title: 'Contact', desc: launchSignup ? 'Contact SLX and sign up for brand updates.' : 'Find official SLX Division contact and social channels.',
    content: `<section class="shell story-grid"><article><h2>Contact SLX</h2><p>${settings.email ? `<a href="mailto:${escape(settings.email)}">${escape(settings.email)}</a>` : 'Contact details will be added before launch.'}</p><div class="footer-social" data-social-links>${socialLinks(settings)}</div></article>${launchSignup ? '<article><h2>Updates from SLX</h2><button class="primary" type="button" data-notify="newsletter">Subscribe</button></article>' : ''}</section>`,
  },
  'faq.html': {
    title: 'FAQ', seoTitle:'Frequently asked questions',
    desc: 'Find answers about SLX releases, collections and launch updates.',
    content: `<section class="shell faq-section">${spreadshop
      ? '<div class="faq-list"><details><summary>Where can I order?</summary><p>Orders in the partner catalog are placed through Spreadshop.</p></details><details><summary>What currency is used?</summary><p>The Spreadshop catalog uses British pounds (GBP).</p></details><details><summary>Who handles shipping and returns?</summary><p>Shipping and returns are handled by Spreadshop.</p></details></div>'
      : faqList()}<p><a class="detail-link" href="payment-delivery-returns.html">Payment, shipping and returns</a></p></section>`,
  },
  'payment-delivery-returns.html': {
    title: 'Payment, shipping and returns',
    desc: spreadshop ? 'Payment, shipping and returns for items sold through Spreadshop.' : 'How SLX plans to confirm direct orders, collect deposits, ship via Nova Poshta, and handle returns.',
    content: spreadshop ? `<div class="shell story-grid"><article id="made-to-order"><h2>Production and payment</h2><p>SLX creates the designs. Spreadshop produces its catalog items to order and takes payment. Catalog prices are in British pounds (GBP).</p><a class="detail-link" href="shop.html#spreadshop">Catalog on Spreadshop</a></article>
      <article><h2>Shipping and returns</h2><p>Spreadshop handles shipping and returns. Available destinations, costs and delivery estimates are shown at checkout. To change or return an order, contact support using your order email and include your order number.</p></article></div>`
      : `<p class="shell collection-description">SLX is preparing to launch. We will publish confirmed prices, timing and terms before sales open.${launchSignup ? ' You can register for updates on each product page.' : ''}</p>
    <div class="shell story-grid">
      <article id="made-to-order"><h2>How it works</h2><p>Choose a piece and size and submit a request. SLX checks availability, price and timing. Production starts after confirmation and a deposit.</p></article>
      <article id="payment"><h2>Payment</h2><p>There is no charge when you submit a request. We confirm the total, deposit and amount due on delivery before payment.</p></article>
      <article id="delivery"><h2>Nova Poshta shipping</h2><p>Select a city and branch or parcel locker. Nova Poshta rates apply. Tracking appears in your account after dispatch.</p><p>If production is delayed, we will give you an updated estimate and discuss the next steps.</p></article>
      <article id="returns"><h2>Cancellation and returns</h2><p>To discuss cancellation, manufacturing defects, incorrect items or returns, contact SLX with your order number.</p><p>Cancellation, return and refund terms will be published before launch.</p><a class="detail-link" href="contact.html">Contact SLX</a></article>
    </div>`,
  },
});
