const { faqList, socialLinks, escape } = require('./site-shell.cjs');
const { grid, collectionsPage } = require('./inventory-pages.cjs');
const empty = (text = 'Пока одягу нема') =>
  `<section class="shell empty-page"><p>${escape(text)}</p></section>`;
function lookbook(collections) {
  const editions = collections.filter(collection => collection.lookbook?.length);
  if (!editions.length) return empty('Фотографій поки немає.');
  return editions.map(collection => `<section class="shell inventory">
    <h2><a href="collection-${collection.id}.html">${escape(collection.name)}</a></h2>
    <div class="inventory-grid lookbook-grid">${collection.lookbook.map(image =>
      `<a class="inventory-photo" href="${escape(image.src)}"><img src="${escape(image.src)}" alt="${escape(image.alt)}" loading="lazy" decoding="async"></a>`).join('')}</div>
  </section>`).join('');
}

module.exports = ({ settings, catalog }) => ({
  'account.html': {
    title: 'Мій кабінет', desc: 'Вхід та історія замовлень SLX.', private:true, script:'account.js',
    content: '<section class="shell account-panel" id="slx-account"><p role="status">Завантажуємо кабінет…</p></section>',
  },
  'shop.html': {
    title: 'Shop', desc: 'Каталог SLX.',
    content: grid(catalog.activeProducts, { tools: true }),
  },
  'collections.html': {
    title: 'Collections', desc: 'Колекції SLX.',
    content: collectionsPage(catalog.collections.filter(collection => !collection.archived), catalog.products),
  },
  'about.html': {
    title: 'About SLX', desc: 'SLX — незалежний бренд вуличного одягу.',
    content: `<div class="shell story-grid"><article><h2>Незалежний вуличний одяг</h2><p>Ми запускаємо SLX як незалежний бренд вуличного одягу. Нам близькі андеграунд нульових, вільний крій і графіка старих музичних обкладинок.</p><a class="detail-link" href="founders.html">Засновники SLX</a></article><img src="assets/brand/logo.webp" alt="Орбітальна емблема SLX" width="1035" height="754"></div>`,
  },
  'founders.html': {
    title: 'Founders', desc: 'Про заснування SLX.',
    content: `<section class="shell story-grid"><article><h2>Засновники SLX</h2><p>SLX заснували вдвох як незалежний проєкт вуличного одягу.</p></article></section>`,
  },
  'lookbook.html': {
    title: 'Lookbook', desc: 'Лукбук SLX.',
    content: lookbook(catalog.collections),
  },
  'archive.html': {
    title: 'Archive', desc: 'Архів SLX.',
    content: catalog.collections.some(collection => collection.archived)
      ? collectionsPage(catalog.collections.filter(collection => collection.archived), catalog.products)
      : empty('Архів поки порожній.'),
  },
  'contact.html': {
    title: 'Contact', desc: 'Контакти SLX та новини бренду.',
    content: `<section class="shell story-grid"><article><h2>Зв’язок зі SLX</h2><p>${settings.email ? `<a href="mailto:${escape(settings.email)}">${escape(settings.email)}</a>` : 'Контактну адресу опублікуємо перед запуском.'}</p><div class="footer-social">${socialLinks(settings)}</div></article><article><h2>Новини SLX</h2><button class="primary" type="button" data-notify="newsletter">Підписатися</button></article></section>`,
  },
  'faq.html': {
    title: 'FAQ', desc: 'Запитання про запуск SLX.',
    content: `<section class="shell faq-section">${faqList()}</section>`,
  },
});
