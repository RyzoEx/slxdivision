const launchSignup = require('./signup-config.cjs');

const icon = (path) => `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" aria-hidden="true">${path}</svg>`;
const icons = {
  menu: icon('<path d="M3 8h18M3 16h18"/>'),
  search: icon('<circle cx="10.5" cy="10.5" r="6.3"/><path d="m15 15 5 5"/>'),
  profile: icon('<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-6 14-6 14 0"/>'),
  favorite: icon('<path d="M12 20s-8-4.8-8-10.2a4.2 4.2 0 0 1 8-1.6 4.2 4.2 0 0 1 8 1.6C20 15.2 12 20 12 20z"/>'),
  cart: icon('<path d="M4.5 8h15l1 13h-17zM8 9V6a4 4 0 0 1 8 0v3"/>'),
};
const links = [
  ['Shop', 'shop.html'], ['Collections', 'collections.html'], ['About', 'about.html'],
  ['Founders', 'founders.html'], ['Lookbook', 'lookbook.html'], ['Archive', 'archive.html'],
  ['Contact', 'contact.html'], ['FAQ', 'faq.html'],
  ['Payment, shipping and returns', 'payment-delivery-returns.html'],
  ['Privacy policy', 'privacy.html'],
  ['Cookie policy', 'cookie-policy.html'],
  ['Terms of use', 'terms.html'],
];
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
function navLinks(entries) {
  return entries.map(([label, url]) => `<a href="${url}">${label}</a>`).join('');
}

function header(home = false) {
  return `<header class="header shop-header"><div class="shell header-inner">
    <nav class="shop-nav" aria-label="Main navigation">${navLinks(links.slice(0, 3))}</nav>
    <button class="icon-button mobile-menu-trigger" type="button" data-panel="menu" aria-label="Menu" aria-haspopup="dialog">${icons.menu}</button>
    <a class="brand chrome-brand" href="${home ? '#top' : '/'}" aria-label="SLX home"><img src="assets/brand/logo-480.webp" width="86" height="63" alt="SLX"></a>
    <div class="header-actions">
      <button class="icon-button" type="button" data-panel="search" aria-label="Search" aria-haspopup="dialog">${icons.search}</button>
      <button class="icon-button profile-trigger" type="button" data-panel="profile" aria-label="Account" aria-haspopup="dialog">${icons.profile}</button>
      <button class="icon-button" type="button" data-panel="favorites" aria-label="Favorites" aria-haspopup="dialog">${icons.favorite}</button>
      <button class="icon-button" type="button" data-panel="cart" aria-label="Cart" aria-haspopup="dialog">${icons.cart}<span class="cart-count" hidden></span></button>
    </div>
  </div></header>`;
}

function socialLinks(settings = {}) {
  return ['YouTube','Pinterest','TikTok','Instagram','Telegram'].map(label => {
    const value = settings.social?.[label];
    let url;
    try { url = new URL(value); } catch {}
    return url?.protocol === 'https:' && !url.username && !url.password
      ? `<a href="${escape(url.href)}" rel="noopener noreferrer" data-social-platform="${label.toLowerCase()}">${label}</a>`
      : '';
  }).join('');
}

function footer(settings) {
  const email = settings.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)
    ? `<a href="mailto:${escape(settings.email)}">${escape(settings.email)}</a>`
    : '<span class="muted">Contact details will be added before launch.</span>';
  return `<footer class="footer site-footer"><div class="shell">
    <div class="footer-top">
      <div><a class="brand chrome-brand footer-brand" href="/" aria-label="SLX home"><img src="assets/brand/logo-480.webp" width="100" height="73" alt="SLX" loading="lazy"></a>
      <p>Independent Ukrainian streetwear.</p></div>
      <nav aria-label="Site links">${navLinks(links)}</nav>
      <div class="footer-social" data-social-links aria-label="Contact and social media">${socialLinks(settings)}${email}</div>
      ${launchSignup ? '<div class="footer-subscribe"><p>SLX updates</p><button class="primary" type="button" data-notify="newsletter">Subscribe</button></div>' : ''}
    </div>
    <div class="footer-bottom"><span>© SLX 2026</span><button class="text-button" type="button" data-cookie-settings>Cookie settings</button><a href="#top">Back to top</a></div>
  </div></footer>`;
}

const faq = [
  ['When does the drop launch?', `A launch date has yet to be announced.${launchSignup ? ' Subscribe in the footer for updates.' : ''}`],
  ['Can I order now?', `Orders will open after pre-launch.${launchSignup ? ' You can sign up for updates on each product page.' : ''}`],
  ['What does made to order mean?', 'Production starts after order confirmation. Size, price and timing are confirmed before payment.'],
  ['When is a deposit due?', 'There is no charge for submitting a request. After confirmation, a deposit starts production and the balance is payable on delivery.'],
  ['What are the shipping and return terms?', 'For direct orders, we plan to use Nova Poshta. Final shipping and return terms will be published before sales open.'],
];
const faqList = () => `<div class="faq-list">${faq.map(([question, answer]) =>
  `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div>`;

module.exports = { header, footer, links, navLinks, escape, socialLinks, faqList };
