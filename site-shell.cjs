const icon = (path) => `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" aria-hidden="true">${path}</svg>`;
const icons = {
  menu: icon('<path d="M3 8h18M3 16h18"/>'),
  search: icon('<circle cx="10.5" cy="10.5" r="6.3"/><path d="m15 15 5 5"/>'),
  profile: icon('<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-6 14-6 14 0"/>'),
  cart: icon('<path d="M4.5 8h15l1 13h-17zM8 9V6a4 4 0 0 1 8 0v3"/>'),
};
const links = [
  ['Shop', 'shop.html'], ['Collections', 'collections.html'], ['About', 'about.html'],
  ['Founders', 'founders.html'], ['Lookbook', 'lookbook.html'], ['Archive', 'archive.html'],
  ['Contact', 'contact.html'], ['FAQ', 'faq.html'],
];
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
function navLinks(entries) {
  return entries.map(([label, url]) => `<a href="${url}">${label}</a>`).join('');
}

function header(home = false) {
  return `<header class="header shop-header"><div class="shell header-inner">
    <nav class="shop-nav" aria-label="Основна навігація">${navLinks(links.slice(0, 3))}</nav>
    <button class="icon-button mobile-menu-trigger" type="button" data-panel="menu" aria-label="Меню" aria-haspopup="dialog">${icons.menu}</button>
    <a class="brand chrome-brand" href="${home ? '#top' : 'index.html'}" aria-label="SLX — на початок"><img src="assets/brand/logo.webp" width="86" height="63" alt="SLX"></a>
    <div class="header-actions">
      <button class="icon-button" type="button" data-panel="search" aria-label="Пошук" aria-haspopup="dialog">${icons.search}</button>
      <button class="icon-button profile-trigger" type="button" data-panel="profile" aria-label="Профіль" aria-haspopup="dialog">${icons.profile}</button>
      <button class="icon-button" type="button" data-panel="cart" aria-label="Кошик" aria-haspopup="dialog">${icons.cart}</button>
    </div>
  </div></header>`;
}

function socialLinks(settings = {}) {
  return ['Instagram', 'TikTok', 'Telegram'].map(label => {
    const value = settings[label.toLowerCase()];
    let url;
    try { url = new URL(value); } catch {}
    return url?.protocol === 'https:'
      ? `<a href="${escape(url.href)}" rel="noopener noreferrer">${label}</a>`
      : `<span class="muted">${label}</span>`;
  }).join('');
}

function footer(settings) {
  const email = settings.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)
    ? `<a href="mailto:${escape(settings.email)}">${escape(settings.email)}</a>`
    : '<span class="muted">Контакт опублікуємо перед запуском.</span>';
  return `<footer class="footer site-footer"><div class="shell">
    <div class="footer-top">
      <div><a class="brand chrome-brand footer-brand" href="index.html" aria-label="SLX — головна"><img src="assets/brand/logo.webp" width="100" height="73" alt="SLX"></a>
      <p>Незалежний вуличний одяг.<br>Максим і Даня.</p></div>
      <nav aria-label="Розділи сайту">${navLinks(links)}</nav>
      <div class="footer-social" aria-label="Контакти та соціальні мережі">${socialLinks(settings)}${email}</div>
      <div class="footer-subscribe"><p>Новини SLX</p><button class="primary" type="button" data-notify="newsletter">Підписатися</button></div>
    </div>
    <div class="footer-bottom"><span>© SLX 2026</span><a href="#top">На початок</a></div>
  </div></footer>`;
}

const faq = [
  ['Коли з’явиться одяг?', 'Дату старту ще не оголосили. У футері можна підписатися на новини SLX.'],
  ['Чи можна замовити річ зараз?', 'На сторінці речі вказано її статус і доступний спосіб замовлення.'],
  ['Які будуть умови доставки й повернення?', 'Умови опублікуємо до відкриття продажів.'],
];
const faqList = () => `<div class="faq-list">${faq.map(([question, answer]) =>
  `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div>`;

module.exports = { header, footer, links, navLinks, escape, socialLinks, faqList };
