const { escape } = require('./site-shell.cjs');

const status = {
  'coming-soon': 'Скоро',
  available: 'У наявності',
  'sold-out': 'Розпродано',
};
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
      <article class="inventory-card" ${archived ? '' : `data-catalog-item="${item.id}"`} data-category="${escape(item.category)}">
        <a href="${productUrl(item)}">
          <div class="inventory-photo">${photo(item.photos[0])}${item.photos[1] ? photo(item.photos[1]) : ''}</div>
          <div class="inventory-card-title"><h2>${escape(item.name)}</h2><span data-stock>${archived ? 'Архів' : status[item.status === 'available' ? 'coming-soon' : item.status]}</span></div>
          <p data-display-price hidden></p>
        </a>
        ${archived ? '' : `<button class="text-button" type="button" data-favorite="${item.id}" aria-pressed="false">В обране</button>`}
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

function productPage(item, collection, related) {
  const specs = Object.entries(item.specifications ?? {});
  return {
    title: item.name,
    seoTitle: `${item.name} — ${collection.name}`,
    desc: item.description,
    image: item.photos[0],
    searchImages: item.photos,
    trail: [...collectionTrail(collection), [collection.name,collectionUrl(collection)]],
    content: `<section class="shell product-layout" data-product-page="${item.id}" ${collection.archived ? '' : `data-catalog-item="${item.id}"`}>
      <div>
        <div class="product-photo">${photo(item.photos[0], 'eager')}<button class="photo-zoom" type="button" data-photo-zoom aria-pressed="false">Наблизити фото</button></div>
        ${item.photos.length > 1 ? `<div class="gallery-thumbnails" role="group" aria-label="Ракурси">${item.photos.map((image, index) =>
          `<button type="button" data-gallery-src="${escape(image.src)}" data-gallery-alt="${escape(image.alt)}" aria-label="${escape(image.alt)}" aria-pressed="${index === 0}">${photo(image)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="product-info">
        <a class="detail-link" href="${collectionUrl(collection)}">${escape(collection.name)}</a>
        <p class="muted" data-stock>${collection.archived ? 'Архів' : status[item.status === 'available' ? 'coming-soon' : item.status]}</p>
        <p class="product-price" data-display-price hidden></p>
        <p>${escape(item.description)}</p>
        ${!collection.archived ? `<div class="product-variants">
          <div class="variant-choices" data-choices>
            ${item.sizes?.length ? `<label>Розмір <select data-variant="size">${options(item.sizes, 'Обрати розмір')}</select></label>` : ''}
            ${item.colors?.length ? `<label>Колір <select data-variant="color">${options(item.colors, 'Обрати колір')}</select></label>` : ''}
          </div>
          <button class="primary" type="button" data-notify="${item.id}" ${item.status === 'sold-out' ? 'hidden' : ''}>Повідомити про запуск</button>
          <button class="secondary" type="button" data-cart-add="${item.id}" ${item.status === 'sold-out' ? 'hidden' : ''}>До списку покупок</button>
          <button class="text-button" type="button" data-favorite="${item.id}" aria-pressed="false">В обране</button>
          <p role="status" data-cart-message></p>
        </div>` : ''}
        ${specs.length ? `<details><summary>Характеристики</summary><dl>${specs.map(([label, value]) =>
          `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></details>` : ''}
      </div>
    </section>${related.length ? `<h2 class="shell related-title">Інші речі з колекції</h2>${grid(related, { archived: collection.archived })}` : ''}`,
  };
}

function collectionTrail(collection) {
  return collection.archived ? [['Архів','archive.html']] : [['Колекції','collections.html']];
}

function inventoryPages({ collections, products }) {
  const pages = {};
  for (const collection of collections) {
    const entries = products.filter(item => item.collection === collection.id);
    const cover = collection.cover ?? entries[0]?.photos[0];
    pages[collectionUrl(collection)] = {
      title: collection.name,
      seoTitle: `${collection.name} — колекція вуличного одягу`,
      desc: collection.description ?? `Колекція ${collection.name} від SLX.`,
      image: cover,
      searchImages: [...(collection.cover ? [collection.cover] : []), ...entries.flatMap(item => item.photos.slice(0,2))],
      trail: collectionTrail(collection),
      content: `${collection.description ? `<p class="shell collection-description">${escape(collection.description)}</p>` : ''}
        ${collection.cover ? `<div class="shell collection-cover">${photo(collection.cover, 'eager')}</div>` : ''}
        ${grid(entries, { tools: true, archived: collection.archived })}`,
    };
    for (const item of entries) {
      pages[productUrl(item)] = productPage(item, collection, entries.filter(other => other !== item).slice(0, 3));
    }
  }
  return pages;
}

module.exports = { grid, collectionsPage, inventoryPages };
