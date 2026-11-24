(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'drawer';
  dialog.setAttribute('aria-labelledby', 'panel-title');
  dialog.innerHTML = '<div class="drawer-top"><h2 id="panel-title"></h2><button type="button" class="close-button" aria-label="Закрити" autofocus></button></div><div class="drawer-body"></div>';
  document.body.append(dialog);
  const content = dialog.querySelector('.drawer-body');
  const newsletterKey = 'slx-interest-v1';
  const products = window.SLX_CATALOG ?? [];
  const productById = new Map(products.map(item => [item.id, item]));
  let source;

  function addresses() {
    try {
      const records = JSON.parse(localStorage.getItem(newsletterKey) ?? '[]');
      return Array.isArray(records)
        ? records.filter(record => typeof record?.email === 'string'
          && (record.product === 'newsletter' || productById.has(record.product)))
        : [];
    } catch { return []; }
  }

  function open(kind, title, trigger) {
    source = trigger;
    dialog.dataset.kind = kind;
    dialog.querySelector('h2').textContent = title;
    content.replaceChildren();
    if (!dialog.open) dialog.showModal();
    return content;
  }

  const pages = [['Shop','shop.html'], ['Collections','collections.html'], ['About','about.html'],
    ['Founders','founders.html'], ['Lookbook','lookbook.html'], ['Archive','archive.html'],
    ['Contact','contact.html'], ['FAQ','faq.html']];

  function menu(trigger) {
    const panel = open('menu', 'Меню', trigger);
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Мобільна навігація');
    for (const [name, href] of pages) {
      const link = document.createElement('a');
      link.href = href;
      link.className = 'utility-link';
      link.textContent = name;
      nav.append(link);
    }
    panel.append(nav);
  }

  function search(trigger) {
    const panel = open('search', 'Пошук', trigger);
    panel.innerHTML = '<label for="shop-search" class="visually-hidden">Пошук речей</label><input id="shop-search" type="search" placeholder="Пошук речей" autocomplete="off"><div aria-live="polite"></div>';
    const input = panel.querySelector('input');
    const results = panel.querySelector('[aria-live]');
    const update = () => {
      const query = input.value.trim().toLowerCase();
      const found = products.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(query));
      results.replaceChildren();
      if (!found.length) results.textContent = products.length ? 'Нічого не знайдено.' : 'Пока одягу нема';
      for (const item of found) {
        const link = document.createElement('a');
        link.className = 'utility-link';
        link.href = `product-${item.id}.html`;
        link.textContent = item.name;
        results.append(link);
      }
    };
    input.addEventListener('input', update);
    update();
    input.focus();
  }

  function profile(trigger) {
    const panel = open('profile', 'Профіль', trigger);
    const saved = addresses();
    if (!saved.length) panel.textContent = 'Збережених заявок ще немає.';
    for (const record of saved) {
      const row = document.createElement('p');
      row.textContent = [productById.get(record.product)?.name ?? 'Новини SLX', record.size, record.color].filter(Boolean).join(' · ');
      panel.append(row);
    }
  }

  function cart(trigger) {
    const panel = open('cart', 'Кошик', trigger);
    if (products.length) panel.innerHTML = '<p>Замовлення оформлюються за посиланням на сторінці речі.</p><a class="detail-link" href="shop.html">До каталогу</a>';
    else panel.textContent = 'Пока одягу нема';
  }

  function subscribe(trigger) {
    const product = trigger.dataset.notify;
    const item = productById.get(product);
    const variants = trigger.closest('.product-variants');
    const size = variants?.querySelector('[data-variant="size"]')?.value ?? '';
    const color = variants?.querySelector('[data-variant="color"]')?.value ?? '';
    const panel = open('newsletter', item ? 'Повідомити про запуск' : 'Новини SLX', trigger);
    const live = document.querySelector('meta[name="slx-subscription"]')?.content === 'live';
    panel.innerHTML = '<form class="interest-form"><label for="notify-email">Email</label><input id="notify-email" name="email" type="email" maxlength="200" autocomplete="email" required><button class="primary" type="submit">Підписатися</button><p class="muted interest-note"></p><p role="status"></p></form>';
    const form = panel.querySelector('form');
    const button = form.querySelector('button');
    const status = form.querySelector('[role="status"]');
    if (item) {
      const selection = document.createElement('p');
      selection.textContent = [item.name, size, color].filter(Boolean).join(' · ');
      form.before(selection);
    }
    panel.querySelector('.interest-note').textContent = live
      ? 'Використаємо email для новин SLX.'
      : 'Демо: заявка зберігається в цьому браузері.';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const email = form.elements.email.value.trim().toLowerCase();
      const record = { product, email, size, color };
      button.disabled = true;
      try {
        if (live) {
          const result = await fetch('/api/subscribe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
          });
          if (!result.ok) throw new Error('Subscription failed');
        }
        const records = addresses().filter(entry => !(entry.email === email && entry.product === product
          && entry.size === size && entry.color === color));
        try { localStorage.setItem(newsletterKey, JSON.stringify([...records, record])); }
        catch (error) { if (!live) throw error; }
        window.slxMetric?.(item ? 'product_notify_request' : 'newsletter_request');
        status.textContent = live ? 'Заявку прийнято.' : 'Заявку збережено в цьому браузері.';
        form.reset();
      } catch { status.textContent = 'Не вдалося зберегти заявку. Спробуй ще раз.'; }
      finally { button.disabled = false; }
    });
    form.elements.email.focus();
  }

  const panels = { menu, search, profile, cart };
  document.addEventListener('click', event => {
    const panel = event.target.closest('button[data-panel]');
    const subscribeButton = event.target.closest('button[data-notify]');
    if (panel) panels[panel.dataset.panel]?.(panel);
    if (subscribeButton) subscribe(subscribeButton);
  });
  dialog.querySelector('.close-button').addEventListener('click', () => dialog.close());
  let outside;
  dialog.addEventListener('pointerdown', event => { outside = event.target === dialog; });
  dialog.addEventListener('click', event => { if (outside && event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => source?.focus({ preventScroll: true }));
})();
