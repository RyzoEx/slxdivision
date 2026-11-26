(() => {
  const {catalog,element,money,productStatus} = window.slx;
  catalog().then(({ ready,sales,products }) => {
    if (!ready) return;
    const byId = new Map(products.map(item => [item.id,item]));
    for (const container of document.querySelectorAll('[data-catalog-item]')) {
      const item = byId.get(container.dataset.catalogItem);
      if (!item) continue;
      container.querySelector('[data-stock]').textContent = productStatus[item.status];
      const price = container.querySelector('[data-display-price]');
      price.hidden = !sales || item.price === null;
      if (!price.hidden) {
        price.textContent = money(item.price);
        container.dataset.price = item.price;
      }
      const cover = container.querySelector('.inventory-photo img, .product-photo img');
      if (sales && item.photo && cover) {
        const first = container.querySelector('[data-gallery-src]');
        const alt = `Image of ${item.name}`;
        if (first) {
          first.dataset.gallerySrc = item.photo;
          first.dataset.galleryAlt = alt;
          first.dataset.galleryLabel = '';
          first.setAttribute('aria-label', alt);
          const thumbnail = first.querySelector('img');
          thumbnail.src = item.photo;
          thumbnail.alt = alt;
        }
        if (!first || first.getAttribute('aria-pressed') === 'true') {
          cover.src = item.photo;
          cover.alt = alt;
          const caption = container.querySelector('[data-gallery-caption]');
          if (caption) caption.hidden = true;
        }
      }
      const variants = container.querySelector('[data-choices]');
      if (!variants) continue;
      variants.replaceChildren();
      for (const [key,label,options] of [['size','Size',item.sizes],['color','Color',item.colors]]) {
        if (!options.length) continue;
        const select = element('select',{});
        select.dataset.variant = key;
        select.append(new Option('Select',''),...options.map(option=>new Option(option,option)));
        variants.append(element('label',{},label,select));
      }
      const add = container.querySelector('[data-cart-add]');
      if (add) {
        add.hidden = item.status === 'sold-out';
        add.textContent = sales && item.status === 'available' ? 'Add to cart' : 'Save to shopping list';
      }
      container.querySelector('[data-notify]').hidden = item.status !== 'coming-soon';
    }
  });
  for (const section of document.querySelectorAll('.inventory')) {
    const grid = section.querySelector('[data-inventory-grid]');
    const filter = section.querySelector('[data-filter]');
    const sort = section.querySelector('[data-sort]');
    if (!grid || !filter || !sort) continue;
    const cards = [...grid.children];
    function update() {
      const ordered = [...cards];
      if (sort.value) {
        const direction = sort.value === 'low' ? 1 : -1;
        ordered.sort((a, b) => {
          if (!a.dataset.price) return Number(Boolean(b.dataset.price));
          if (!b.dataset.price) return -1;
          return direction * (Number(a.dataset.price) - Number(b.dataset.price));
        });
      }
      for (const card of ordered) {
        card.hidden = Boolean(filter.value && filter.value !== card.dataset.category);
        grid.append(card);
      }
      section.querySelector('[data-filter-empty]').hidden = cards.some(card => !card.hidden);
    }
    for (const control of [filter, sort]) control.addEventListener('change', update);
  }

  const product = document.querySelector('[data-product-page]');
  if (!product) return;
  const frame = product.querySelector('.product-photo');
  if (!frame) return;
  const image = frame.querySelector('img');
  const caption = product.querySelector('[data-gallery-caption]');
  const zoom = product.querySelector('[data-photo-zoom]');
  const thumbnails = [...product.querySelectorAll('[data-gallery-src]')];
  function setZoom(active) {
    frame.toggleAttribute('data-zoom', active);
    zoom.setAttribute('aria-pressed', String(active));
    zoom.textContent = active ? 'Reset image zoom' : 'Enlarge image';
  }
  zoom.addEventListener('click', () => setZoom(!frame.hasAttribute('data-zoom')));
  for (const button of thumbnails) {
    button.addEventListener('click', () => {
      setZoom(false);
      image.src = button.dataset.gallerySrc;
      image.alt = button.dataset.galleryAlt;
      caption.textContent = button.dataset.galleryLabel;
      caption.hidden = !caption.textContent;
      for (const option of thumbnails) option.setAttribute('aria-pressed', String(option === button));
    });
  }
})();
