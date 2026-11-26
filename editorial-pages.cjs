const { faqList, socialLinks, escape } = require('./site-shell.cjs');
const { grid, collectionsPage } = require('./inventory-pages.cjs');
const { storefront } = require('./spreadshop/storefront.cjs');
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

module.exports = ({ settings, catalog, spreadshop }) => ({
  'account.html': {
    title: 'Мій кабінет', desc: 'Вхід та історія замовлень SLX.', noindex:true, script:'account.js',
    content: '<section class="shell account-panel" id="slx-account"><p role="status">Завантажуємо кабінет…</p></section>',
  },
  'shop.html': {
    title: 'Shop', seoTitle:'Каталог вуличного одягу',
    desc: 'Вуличний одяг SLX Division. Перегляньте футболки з принтами, кепку та шапку з колекції Heavy DAngels.',
    content: spreadshop
      ? `${storefront(spreadshop)}<h2 class="shell related-title">Дизайни SLX</h2>${grid(catalog.activeProducts,{tools:true})}`
      : grid(catalog.activeProducts, { tools: true }),
  },
  'collections.html': {
    title: 'Collections', seoTitle:'Колекції вуличного одягу',
    desc: 'Колекції SLX Division, незалежного українського бренду вуличного одягу. Перегляньте Heavy DAngels та речі з дропу.',
    content: collectionsPage(catalog.collections.filter(collection => !collection.archived), catalog.products),
  },
  'about.html': {
    title: 'About SLX', seoTitle:'Про бренд',
    desc: 'SLX Division — незалежний український бренд вуличного одягу. Його естетика поєднує андеграунд нульових, вільний крій і графіку музичних обкладинок.',
    content: `<div class="shell story-grid"><article><h2>Незалежний вуличний одяг</h2><p>Ми запускаємо SLX як незалежний бренд вуличного одягу. Нам близькі андеграунд нульових, вільний крій і графіка старих музичних обкладинок.</p><p>Ми розробляємо принти самостійно й плануємо виготовляти речі після підтвердження замовлення.</p><a class="detail-link" href="payment-delivery-returns.html#made-to-order">Як ми працюємо</a><p><a class="detail-link" href="founders.html">Засновники SLX</a></p></article><img src="assets/brand/logo.webp" alt="Орбітальна емблема SLX" width="1035" height="754"></div>`,
  },
  'founders.html': {
    title: 'Founders', desc: 'Про заснування SLX.',
    content: `<section class="shell story-grid"><article><h2>Засновники SLX</h2><p>SLX заснували вдвох як незалежний проєкт вуличного одягу.</p></article></section>`,
  },
  'lookbook.html': {
    title: 'Lookbook', seoTitle:'Лукбук колекцій',
    desc: 'Фотографії колекцій вуличного одягу SLX Division.',
    noindex: !catalog.collections.some(collection => collection.lookbook?.length),
    content: lookbook(catalog.collections),
  },
  'archive.html': {
    title: 'Archive', seoTitle:'Архів колекцій',
    desc: 'Архів попередніх колекцій вуличного одягу SLX Division.',
    noindex: !catalog.collections.some(collection => collection.archived),
    content: catalog.collections.some(collection => collection.archived)
      ? collectionsPage(catalog.collections.filter(collection => collection.archived), catalog.products)
      : empty('Архів поки порожній.'),
  },
  'contact.html': {
    title: 'Contact', desc: 'Контакти SLX та новини бренду.',
    content: `<section class="shell story-grid"><article><h2>Зв’язок зі SLX</h2><p>${settings.email ? `<a href="mailto:${escape(settings.email)}">${escape(settings.email)}</a>` : 'Контактну адресу опублікуємо перед запуском.'}</p><div class="footer-social">${socialLinks(settings)}</div></article><article><h2>Новини SLX</h2><button class="primary" type="button" data-notify="newsletter">Підписатися</button></article></section>`,
  },
  'faq.html': {
    title: 'FAQ', seoTitle:'Часті запитання',
    desc: 'Відповіді на запитання про колекції SLX Division, запуск продажів і сповіщення про наявність.',
    content: `<section class="shell faq-section">${spreadshop
      ? '<div class="faq-list"><details><summary>Де оформити замовлення?</summary><p>Товари з каталогу партнера оформлюються через Spreadshop.</p></details><details><summary>У якій валюті вказано ціни?</summary><p>Ціни в каталозі Spreadshop вказані у фунтах стерлінгів (GBP).</p></details><details><summary>Хто доставляє й оформлює повернення?</summary><p>За доставку та повернення відповідає Spreadshop.</p></details></div>'
      : faqList()}<p><a class="detail-link" href="payment-delivery-returns.html">Оплата, доставка та повернення</a></p></section>`,
  },
  'payment-delivery-returns.html': {
    title: 'Оплата, доставка та повернення',
    desc: spreadshop ? 'Оформлення, оплата, доставка та повернення для товарів Spreadshop.' : 'Як SLX Division планує виготовляти речі на замовлення, підтверджувати передоплату, відправляти Новою поштою й обробляти повернення.',
    content: spreadshop ? `<div class="shell story-grid"><article><h2>Оформлення й оплата</h2><p>Товари Spreadshop оформлюються й оплачуються через Spreadshop. Ціни каталогу вказані у фунтах стерлінгів (GBP).</p><a class="detail-link" href="shop.html#spreadshop">Каталог Spreadshop</a></article>
      <article><h2>Доставка та повернення</h2><p>Доступні країни, строки та вартість доставки визначає Spreadshop під час оформлення. За уточненнями щодо замовлення й повернення звертайтеся до підтримки Spreadshop.</p></article></div>`
      : `<p class="shell collection-description">SLX готується до запуску. Остаточні ціни, строки виготовлення та умови опублікуємо до відкриття продажів. Зараз можна підписатися на сповіщення на сторінці виробу.</p>
    <div class="shell story-grid">
      <article id="made-to-order"><h2>Як ми працюємо</h2><p>Ви обираєте виріб і розмір та надсилаєте заявку. Ми перевіряємо доступність, остаточну вартість і строк виготовлення. Робота над виробом починається після підтвердження заявки та отримання часткової передоплати.</p></article>
      <article id="payment"><h2>Оплата</h2><p>Під час оформлення заявки кошти не списуються. Перед оплатою ми повідомляємо повну вартість, розмір передоплати й залишок до сплати при отриманні.</p></article>
      <article id="delivery"><h2>Доставка Новою поштою</h2><p>Під час оформлення ви вказуєте місто й відділення або поштомат. Доставка розраховується за тарифами Нової пошти. Після відправлення номер ТТН з’явиться в кабінеті.</p><p>Якщо виготовлення затримується, ми повідомимо новий строк і узгодимо з вами подальші дії.</p></article>
      <article id="returns"><h2>Скасування та повернення</h2><p>Якщо потрібно скасувати заявку до початку виробництва або під час виготовлення, зверніться до SLX з номером замовлення. Так само можна повідомити про відмову від посилки, виробничий брак, помилково надіслану річ або бажання повернути товар.</p><p>Порядок скасування, строки та умови повернення коштів опублікуємо до запуску.</p><a class="detail-link" href="contact.html">Перейти до контактів</a></article>
    </div>`,
  },
});
