const { escape } = require('./site-shell.cjs');

const status = {
  'coming-soon': 'Coming soon',
  available: 'Available',
  'sold-out': 'Sold out',
};
const productUrl = item => `product-${item.id}.html`;
const collectionUrl = item => `collection-${item.id}.html`;
const photo = (image, loading = 'lazy') => image ? `<img src="${escape(image.src)}" alt="${escape(image.alt)}"
  ${image.width ? `width="${image.width}" height="${image.height}"` : ''} loading="${loading}" decoding="async">` : '';
const imageLabel = image => image?.kind === 'artwork' ? 'Original print artwork' : image?.kind === 'mockup' ? 'Design visualisation' : '';
const empty = '<section class="shell empty-page"><p>No items yet.</p></section>';
const options = (values, label) => `<option value="">${label}</option>${values.map(value =>
  `<option value="${escape(value)}">${escape(value)}</option>`).join('')}`;

function grid(items, { tools = false, archived = false } = {}) {
  if (!items.length) return empty;
  const categories = [...new Set(items.map(item => item.category))].sort((a, b) => a.localeCompare(b, 'uk'));
  return `<section class="shell inventory" aria-label="Clothing">
    ${tools ? `<div class="inventory-controls">
      <label>Category <select data-filter>${options(categories, 'All categories')}</select></label>
      <label>Sort <select data-sort><option value="">Catalog order</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
    </div><p class="muted inventory-empty" data-filter-empty hidden>No items in this category.</p>` : ''}
    <div class="inventory-grid" data-inventory-grid>${items.map(item => `
      <article class="inventory-card" ${archived ? '' : `data-catalog-item="${item.id}"`} data-category="${escape(item.category)}">
        <a href="${productUrl(item)}">
          ${item.photos.length ? `<div class="inventory-photo${item.photos[0].kind === 'artwork' ? ' inventory-artwork' : ''}">${photo(item.photos[0])}${photo(item.photos[1])}</div>` : ''}
          <div class="inventory-card-title"><h2>${escape(item.name)}</h2><span data-stock>${archived ? 'Archive' : status[item.status === 'available' ? 'coming-soon' : item.status]}</span></div>
          <p data-display-price hidden></p>
        </a>
        ${archived ? '' : `<button class="text-button" type="button" data-favorite="${item.id}" aria-pressed="false">Save to favorites</button>`}
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

function productPage(item, collection, related, spreadshop) {
  const specs = Object.entries(item.specifications ?? {});
  const cover = item.photos[0];
  const caption = imageLabel(cover);
  return {
    title: item.name,
    seoTitle: `${item.name} — ${collection.name}`,
    desc: item.description,
    image: item.photos[0],
    searchImages: item.photos,
    trail: [...collectionTrail(collection), [collection.name,collectionUrl(collection)]],
    content: `<section class="shell product-layout" data-product-page="${item.id}" ${collection.archived ? '' : `data-catalog-item="${item.id}"`}>
      <div>
        ${cover ? `<div class="product-photo">${photo(item.artwork ?? cover, 'eager')}<button class="photo-zoom" type="button" data-photo-zoom aria-pressed="false">Enlarge image</button></div>` : '<p class="muted">Product photography will follow.</p>'}
        <p class="muted product-image-note" data-gallery-caption${caption ? '' : ' hidden'}>${caption}</p>
        ${item.photos.length > 1 ? `<div class="gallery-thumbnails" role="group" aria-label="Gallery views">${item.photos.map((image, index) =>
          `<button type="button" data-gallery-src="${escape(image.src)}" data-gallery-alt="${escape(image.alt)}" data-gallery-label="${imageLabel(image)}" aria-label="${escape(image.alt)}" aria-pressed="${index === 0}">${photo(image)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="product-info">
        <a class="detail-link" href="${collectionUrl(collection)}">${escape(collection.name)}</a>
        <p class="muted" data-stock>${collection.archived ? 'Archive' : status[item.status === 'available' ? 'coming-soon' : item.status]}</p>
        <p class="product-price" data-display-price hidden></p>
        <p>${escape(item.description)}</p>
        ${!collection.archived ? `<div class="product-variants">
          <div class="variant-choices" data-choices>
            ${item.sizes?.length ? `<label>Size <select data-variant="size">${options(item.sizes, 'Select a size')}</select></label>` : ''}
            ${item.colors?.length ? `<label>Color <select data-variant="color">${options(item.colors, 'Select a color')}</select></label>` : ''}
          </div>
          <button class="primary" type="button" data-notify="${item.id}" ${item.status === 'sold-out' ? 'hidden' : ''}>Notify me at launch</button>
          ${spreadshop ? '<a class="secondary" href="shop.html#spreadshop">Spreadshop catalog</a>'
            : `<button class="secondary" type="button" data-cart-add="${item.id}" ${item.status === 'sold-out' ? 'hidden' : ''}>Save to shopping list</button>`}
          <button class="text-button" type="button" data-favorite="${item.id}" aria-pressed="false">Save to favorites</button>
          <p role="status" data-cart-message></p>
        </div>
        <section class="made-to-order" aria-label="Made to order">
          <h2>Made to Order</h2>
          ${spreadshop ? '<p>Spreadshop makes its catalog items to order and handles payment, shipping and returns. See the Spreadshop catalog for variants and prices in GBP.</p>'
            : '<p>SLX makes items after order confirmation to avoid excess stock.</p><p>For direct orders, SLX confirms size availability, total cost and production timing before payment. A deposit starts production and the balance is payable on delivery through Nova Poshta.</p>'}
          <a class="detail-link" href="payment-delivery-returns.html">Payment, shipping and returns</a>
        </section>` : ''}
        ${specs.length ? `<details><summary>Details</summary><dl>${specs.map(([label, value]) =>
          `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></details>` : ''}
      </div>
    </section>${related.length ? `<h2 class="shell related-title">More from the collection</h2>${grid(related, { archived: collection.archived })}` : ''}`,
  };
}

function collectionTrail(collection) {
  return collection.archived ? [['Archive','archive.html']] : [['Collections','collections.html']];
}

function inventoryPages({ collections, products }, {spreadshop} = {}) {
  const pages = {};
  for (const collection of collections) {
    const entries = products.filter(item => item.collection === collection.id);
    const cover = collection.cover ?? entries[0]?.photos[0];
    pages[collectionUrl(collection)] = {
      title: collection.name,
      seoTitle: `${collection.name} — streetwear collection`,
      desc: collection.description ?? `Collection ${collection.name} by SLX.`,
      image: cover,
      searchImages: [...(collection.cover ? [collection.cover] : []), ...entries.flatMap(item => item.photos.slice(0,2))],
      trail: collectionTrail(collection),
      content: `<div data-collection-event="${collection.id}"></div>${collection.description ? `<p class="shell collection-description">${escape(collection.description)}</p>` : ''}
        ${collection.cover ? `<div class="shell collection-cover">${photo(collection.cover, 'eager')}</div>` : ''}
        ${grid(entries, { tools: true, archived: collection.archived })}`,
    };
    for (const item of entries) {
      pages[productUrl(item)] = productPage(item, collection, entries.filter(other => other !== item).slice(0, 3),spreadshop);
    }
  }
  return pages;
}

module.exports = { grid, collectionsPage, inventoryPages };
