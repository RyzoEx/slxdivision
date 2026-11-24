(() => {
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
  const image = frame.querySelector('img');
  const zoom = product.querySelector('[data-photo-zoom]');
  const thumbnails = [...product.querySelectorAll('[data-gallery-src]')];
  function setZoom(active) {
    frame.toggleAttribute('data-zoom', active);
    zoom.setAttribute('aria-pressed', String(active));
    zoom.textContent = active ? 'Зменшити фото' : 'Наблизити фото';
  }
  zoom.addEventListener('click', () => setZoom(!frame.hasAttribute('data-zoom')));
  for (const button of thumbnails) {
    button.addEventListener('click', () => {
      setZoom(false);
      image.src = button.dataset.gallerySrc;
      image.alt = button.dataset.galleryAlt;
      for (const option of thumbnails) option.setAttribute('aria-pressed', String(option === button));
    });
  }
})();
