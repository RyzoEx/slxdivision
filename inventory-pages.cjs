const { escape } = require('./site-shell.cjs');

const status = {
  'coming-soon': 'Скоро',
  available: 'У наявності',
  'sold-out': 'Розпродано',
};
const formatPrice = value => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const productUrl = item => `product-${item.id}.html`;
const collectionUrl = item => `collection-${item.id}.html`;
const photo = (image, loading = 'lazy') => `<img src="${escape(image.src)}" alt="${escape(image.alt)}" loading="${loading}" decoding="async">`;
const empty = '<section class="shell empty-page"><p>Пока одягу нема</p></section>';
const options = (values, label) => `<option value="">${label}</option>${values.map(value =>
  `<option value="${escape(value)}">${escape(value)}</option>`).join('')}`;

function grid(items, { tools = false, archived = false } = {}) {
  if (!items.length) return empty;
  const categories = [...new Set(items.map(item => item.category))].sort((a, b) => a.localeCompare(b, 'uk'));
  return `<section class="shell inventory" aria-label="Одяг">
    ${tools ? `<div class="inventory-controls">
      <label>Категорія <select data-filter>${options(categories, 'Усі категорії')}</select></label>
      <label>Сортування <select data-sort><option value="">За каталогом</option><option value="low">Від дешевших</option><option value="high">Від дорожчих</option></select></label>
    </div><p class="muted inventory-empty" data-filter-empty hidden>Речей у цій категорії немає.</p>` : ''}
    <div class="inventory-grid" data-inventory-grid>${items.map(item => `
      <article class="inventory-card" data-category="${escape(item.category)}"${item.price ? ` data-price="${item.price}"` : ''}>
        <a href="${productUrl(item)}">
          <div class="inventory-photo">${photo(item.photos[0])}${item.photos[1] ? photo(item.photos[1]) : ''}</div>
          <div class="inventory-card-title"><h2>${escape(item.name)}</h2><span>${archived ? 'Архів' : status[item.status]}</span></div>
          ${item.price ? `<p>${formatPrice(item.price)}</p>` : ''}
        </a>
      </article>`).join('')}</div>
  </section>`;
}

function collectionsPage(collections, products) {
  if (!collections.length) return empty;
  return `<section class="shell inventory"><div class="inventory-grid">${collections.map(collection => {
    const cover = collection.cover ?? products.find(item => item.collection === collection.id)?.photos[0];
    return `<article class="inventory-card"><a href="${collectionUrl(collection)}">
      ${cover ? `<div class="inventory-photo">${photo(cover)}</div>` : ''}
      <div class="inventory-card-title"><h2>${escape(collection.name)}</h2></div>
      ${collection.description ? `<p>${escape(collection.description)}</p>` : ''}
    </a></article>`;
  }).join('')}</div></section>`;
}

function productPage(item, collection, related, url) {
  const canOrder = !collection.archived && item.status === 'available' && item.orderUrl;
  const specs = Object.entries(item.specifications ?? {});
  const structured = canOrder && url('') ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    image: item.photos.map(image => url(image.src)),
    description: item.description,
    brand: { '@type': 'Brand', name: 'SLX' },
    offers: { '@type': 'Offer', url: item.orderUrl, priceCurrency: 'UAH', price: item.price, availability: 'https://schema.org/InStock' },
  } : null;
  return {
    title: item.name,
    desc: item.description,
    image: item.photos[0],
    structured,
    content: `<section class="shell product-layout" data-product-page="${item.id}">
      <div>
        <div class="product-photo">${photo(item.photos[0], 'eager')}<button class="photo-zoom" type="button" data-photo-zoom aria-pressed="false">Наблизити фото</button></div>
        ${item.photos.length > 1 ? `<div class="gallery-thumbnails" role="group" aria-label="Ракурси">${item.photos.map((image, index) =>
          `<button type="button" data-gallery-src="${escape(image.src)}" data-gallery-alt="${escape(image.alt)}" aria-label="${escape(image.alt)}" aria-pressed="${index === 0}">${photo(image)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="product-info">
        <a class="detail-link" href="${collectionUrl(collection)}">${escape(collection.name)}</a>
        <p class="muted">${collection.archived ? 'Архів' : status[item.status]}</p>
        ${item.price ? `<p class="product-price">${formatPrice(item.price)}</p>` : ''}
        <p>${escape(item.description)}</p>
        ${canOrder ? `
          ${item.sizes?.length ? `<p><strong>Розміри</strong> ${item.sizes.map(escape).join(' · ')}</p>` : ''}
          ${item.colors?.length ? `<p><strong>Кольори</strong> ${item.colors.map(escape).join(' · ')}</p>` : ''}
          <a class="primary" href="${escape(item.orderUrl)}">Замовити</a>` : ''}
        ${!collection.archived && item.status === 'coming-soon' ? `<div class="product-variants">
          ${item.sizes?.length ? `<label>Розмір <select data-variant="size">${options(item.sizes, 'Обрати розмір')}</select></label>` : ''}
          ${item.colors?.length ? `<label>Колір <select data-variant="color">${options(item.colors, 'Обрати колір')}</select></label>` : ''}
          <button class="primary" type="button" data-notify="${item.id}">Повідомити про запуск</button>
        </div>` : ''}
        ${!collection.archived && item.status === 'available' && !canOrder ? `<a class="detail-link" href="contact.html">Контакти для замовлення</a>` : ''}
        ${specs.length ? `<details><summary>Характеристики</summary><dl>${specs.map(([label, value]) =>
          `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></details>` : ''}
      </div>
    </section>${related.length ? `<h2 class="shell related-title">Інші речі з колекції</h2>${grid(related, { archived: collection.archived })}` : ''}`,
  };
}

function inventoryPages({ collections, products }, origin) {
  const pages = {};
  for (const collection of collections) {
    const entries = products.filter(item => item.collection === collection.id);
    const cover = collection.cover ?? entries[0]?.photos[0];
    pages[collectionUrl(collection)] = {
      title: collection.name,
      desc: collection.description ?? `Колекція ${collection.name} від SLX.`,
      image: cover,
      content: `${collection.description ? `<p class="shell collection-description">${escape(collection.description)}</p>` : ''}
        ${collection.cover ? `<div class="shell collection-cover">${photo(collection.cover, 'eager')}</div>` : ''}
        ${grid(entries, { tools: true, archived: collection.archived })}`,
    };
    for (const item of entries) {
      const url = target => origin ? `${origin}/${target}` : '';
      pages[productUrl(item)] = productPage(item, collection, entries.filter(other => other !== item).slice(0, 3), url);
    }
  }
  return pages;
}

module.exports = { grid, collectionsPage, inventoryPages };
