(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'drawer';
  dialog.setAttribute('aria-labelledby', 'panel-title');
  dialog.innerHTML = '<div class="drawer-top"><h2 id="panel-title"></h2><button type="button" class="close-button" aria-label="Close" autofocus></button></div><div class="drawer-body"></div>';
  document.body.append(dialog);
  const content = dialog.querySelector('.drawer-body');
  const {api,element,money,cart:cartStore,favorites:favoriteStore,catalog} = window.slx;
  const products = window.SLX_CATALOG ?? [];
  const spreadshop = document.querySelector('meta[name="slx-fulfillment"]')?.content === 'spreadshop';
  const productById = new Map(products.map(item => [item.id, item]));
  let source;
  let cartRender = 0;
  let checkoutIntent;

  function open(kind, title, trigger) {
    source = trigger;
    cartRender++;
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
    const panel = open('menu', 'Menu', trigger);
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Mobile navigation');
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
    const panel = open('search', 'Search', trigger);
    panel.innerHTML = '<label for="shop-search" class="visually-hidden">Search items</label><input id="shop-search" type="search" placeholder="Search items" autocomplete="off"><div aria-live="polite"></div>';
    const input = panel.querySelector('input');
    const results = panel.querySelector('[aria-live]');
    const update = () => {
      const query = input.value.trim().toLowerCase();
      const found = products.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(query));
      results.replaceChildren();
      if (!found.length) results.textContent = products.length ? 'No matching items.' : 'No items yet.';
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
    const panel = open('profile', 'Account', trigger);
    panel.append(element('a',{href:'account.html',className:'primary'},'My account'));
  }

  function cart(trigger) {
    open('cart', 'Cart', trigger);
    if (spreadshop) {
      content.append(element('p',{className:'muted'},'Spreadshop handles the basket and checkout.'),
        element('a',{href:'shop.html#spreadshop',className:'primary'},'Spreadshop catalog'));
      return;
    }
    renderCart();
  }

  const cartCount = () => spreadshop ? 0 : cartStore.read().reduce((count,row)=>count + row.quantity,0);
  function badges() {
    const count = cartCount();
    for (const badge of document.querySelectorAll('.cart-count')) {
      badge.textContent = count;
      badge.hidden = !count;
      badge.parentElement.setAttribute('aria-label',count ? `Cart (${count})` : 'Cart');
    }
    const saved = new Set(favoriteStore.read());
    for (const button of document.querySelectorAll('[data-favorite]')) {
      const active = saved.has(button.dataset.favorite);
      button.setAttribute('aria-pressed',String(active));
      button.textContent = active ? 'Saved' : 'Save to favorites';
    }
  }

  function productLink(id, label) {
    return element('a',{className:'utility-link',href:`product-${id}.html`},label);
  }

  function favorites(trigger) {
    const panel = open('favorites','Favorites',trigger);
    const entries = favoriteStore.read().filter(id=>productById.has(id));
    if (!entries.length) panel.append('Your saved items will appear here.');
    for (const id of entries) {
      const remove = element('button',{type:'button',className:'text-button'},'Remove');
      remove.addEventListener('click',()=>{
        favoriteStore.write(favoriteStore.read().filter(value=>value!==id));
        badges();
        favorites(trigger);
        panel.querySelector('button')?.focus();
      });
      panel.append(element('div',{className:'cart-line'},productLink(id,productById.get(id).name),remove));
    }
  }

  async function renderCart() {
    const view = ++cartRender;
    const lines = cartStore.read();
    content.replaceChildren();
    if (!lines.length) {
      content.append(element('p',{},products.length ? 'Your cart is empty.' : 'No items yet.'),
        element('a',{className:'detail-link',href:'shop.html'},'Browse the catalog'));
      return;
    }
    const data = await catalog();
    if (view!==cartRender || !dialog.open || dialog.dataset.kind!=='cart') return;
    const mapped = new Map((data.ready ? data.products : products).map(item=>[item.id,item]));
    let total = 0;
    let advance = 0;
    let complete = data.sales;
    for (const [index,line] of lines.entries()) {
      const item = mapped.get(line.id);
      const enabled = item?.status === 'available' && item.price > 0
        && item.sizes.includes(line.size) && item.colors.includes(line.color);
      complete &&= Boolean(enabled);
      if (enabled) {
        total += item.price*line.quantity;
        advance += item.advance*line.quantity;
      }
      const quantity = element('input',{type:'number',min:'1',max:'10',value:String(line.quantity)});
      quantity.setAttribute('aria-label',`Quantity: ${item?.name ?? line.id}`);
      quantity.addEventListener('change',()=>{
        const current = cartStore.read();
        if (current[index]?.id === line.id && quantity.validity.valid && Number.isInteger(quantity.valueAsNumber)) {
          current[index].quantity = quantity.valueAsNumber;
          cartStore.write(current);
        }
        badges(); renderCart();
      });
      const remove = element('button',{className:'text-button',type:'button'},'Remove');
      remove.addEventListener('click',()=>{
        const current = cartStore.read();
        if (current[index]?.id===line.id) current.splice(index,1);
        cartStore.write(current); badges(); renderCart();
      });
      content.append(element('div',{className:'cart-line'},
        element('div',{},item ? productLink(line.id,item.name) : 'Item no longer available',
          element('span',{className:'muted'},[line.size,line.color].filter(Boolean).join(' · ')),
          data.sales && !enabled ? element('p',{className:'muted'},'Choose a different option or remove the item.') : null),
        element('div',{className:'cart-actions'},quantity,remove)));
    }
    if (!data.sales) {
      content.append(element('p',{className:'muted'},'Pre-launch. Items are saved in your shopping list.'),
        element('a',{className:'detail-link',href:'payment-delivery-returns.html'},'Payment, shipping and returns'));
      return;
    }
    if (!complete) return;
    content.append(element('p',{},`Subtotal: ${money(total)}`),
      element('p',{},`Deposit: ${money(advance)}`),
      element('p',{},`Balance on delivery: ${money(total-advance)}`),
      element('p',{className:'muted'},'Shipping is charged at Nova Poshta rates.'));
    const checkout = element('button',{type:'button',className:'primary'},'Start order request');
    content.append(checkout);
    checkout.addEventListener('click',async()=>{
      checkout.disabled = true;
      const account = await api('account').catch(()=>({user:null}));
      if (view!==cartRender) return;
      if (account.user?.role!=='customer') {
        checkout.replaceWith(element('a',{href:'account.html',className:'primary'},'Sign in to continue'));
        return;
      }
      const form = element('form',{className:'interest-form'});
      for (const [name,label,options] of [
        ['name','Full name',{required:true,autocomplete:'name',maxLength:100}],
        ['phone','Phone number',{required:true,type:'tel',autocomplete:'tel',maxLength:24}],
        ['contact','Email or Telegram',{required:true,value:account.user.email,maxLength:180}],
        ['city','City',{required:true,maxLength:100}],
        ['point','Nova Poshta branch or parcel locker',{required:true,maxLength:120}],
        ['referral','Contributor code',{maxLength:24}],
      ]) {
        form.append(element('label',{},label,element('input',{name,...options})));
      }
      const payment=element('select',{name:'payment',required:true},new Option('Deposit and balance on delivery','advance_and_on_delivery'));
      form.append(element('label',{},'Order note',element('textarea',{name:'comment',maxLength:600})),
        element('label',{},'Payment method',payment),
        element('a',{href:'payment-delivery-returns.html',target:'_blank',rel:'noopener',className:'detail-link'},'Payment, shipping and returns'),
        element('label',{className:'ops-check'},element('input',{type:'checkbox',name:'termsAccepted',required:true}),'I have read the terms'));
      const send = element('button',{type:'submit',className:'primary'},'Submit without payment');
      const result = element('p',{});
      result.setAttribute('role','status');
      form.append(send,result);
      checkout.replaceWith(form);
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        send.disabled = true;
        const {referral,termsAccepted,...fields} = Object.fromEntries(new FormData(form));
        const delivery={...fields,termsAccepted:termsAccepted==='on'};
        const fingerprint = JSON.stringify({lines,referral,delivery});
        if (checkoutIntent?.fingerprint !== fingerprint) checkoutIntent = {fingerprint,id:crypto.randomUUID()};
        try {
          await api('order',{body:{requestId:checkoutIntent.id,items:lines,delivery,referral}});
          checkoutIntent = undefined;
          cartStore.write([]); badges();
          if (view!==cartRender) return;
          content.replaceChildren(element('p',{},'Request received.'),element('a',{href:'account.html',className:'detail-link'},'My orders'));
        } catch (error) { result.textContent = error.message; send.disabled = false; }
      });
    });
  }

  function subscribe(trigger) {
    const product = trigger.dataset.notify;
    const item = productById.get(product);
    const variants = trigger.closest('.product-variants');
    const size = variants?.querySelector('[data-variant="size"]')?.value ?? '';
    const color = variants?.querySelector('[data-variant="color"]')?.value ?? '';
    const panel = open('newsletter', item ? 'Notify me at launch' : 'SLX updates', trigger);
    panel.innerHTML = `<form class="interest-form">
      <label for="notify-email">Email</label><input id="notify-email" name="email" type="email" maxlength="180" autocomplete="email" required>
      <label hidden>Website <input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="ops-check"><input type="checkbox" name="consent" required><span>I agree to receive these emails. <a class="detail-link" href="/privacy.html" target="_blank" rel="noopener">Privacy policy</a></span></label>
      <button class="primary" type="submit">Subscribe</button><p class="muted interest-note"></p><p role="status"></p>
    </form>`;
    const form = panel.querySelector('form');
    const button = form.querySelector('button');
    const status = form.querySelector('[role="status"]');
    if (item) {
      const selection = document.createElement('p');
      selection.textContent = [item.name, size, color].filter(Boolean).join(' · ');
      form.before(selection);
    }
    panel.querySelector('.interest-note').textContent = item
      ? 'We will email you about this item.'
      : 'We will email you SLX updates.';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const email = form.elements.email.value.trim().toLowerCase();
      const record = { product, email, size, color, consent:form.elements.consent.checked, website:form.elements.website.value };
      button.disabled = true;
      try {
        const saved = await api('interest',{body:record});
        if (saved.ok !== true) throw new Error('The request could not be saved.');
        window.slxMetric?.(item ? 'product_notify_request' : 'newsletter_request');
        status.textContent = 'Request received.';
        form.reset();
      } catch (error) {
        status.textContent = error.status === 429 ? 'Too many attempts. Try again later.'
          : error.status === 400 ? 'Check your email, selection and consent.'
          : 'Sign-up could not be saved. Please try again later.';
      }
      finally { button.disabled = false; }
    });
    form.elements.email.focus();
  }

  const panels = { menu, search, profile, cart, favorites };
  document.addEventListener('click', event => {
    const panel = event.target.closest('button[data-panel]');
    const subscribeButton = event.target.closest('button[data-notify]');
    if (panel) panels[panel.dataset.panel]?.(panel);
    if (subscribeButton) subscribe(subscribeButton);
    const favorite = event.target.closest('button[data-favorite]');
    if (favorite) {
      const id = favorite.dataset.favorite;
      const saved = favoriteStore.read();
      favoriteStore.write(saved.includes(id) ? saved.filter(value=>value!==id) : [...saved,id]);
      badges();
    }
    const add = event.target.closest('button[data-cart-add]');
    if (add) {
      const section = add.closest('.product-variants');
      const size = section.querySelector('[data-variant="size"]');
      const color = section.querySelector('[data-variant="color"]');
      const message = section.querySelector('[data-cart-message]');
      if ((size && !size.value) || (color && !color.value)) {
        message.textContent = 'Choose an available size and color.';
        (size && !size.value ? size : color).focus();
        return;
      }
      const entry = {id:add.dataset.cartAdd,size:size?.value ?? '',color:color?.value ?? '',quantity:1};
      const lines = cartStore.read();
      const existing = lines.find(row=>row.id===entry.id && row.size===entry.size && row.color===entry.color);
      if (existing) existing.quantity = Math.min(10,existing.quantity+1);
      else if (lines.length<20) lines.push(entry);
      else { message.textContent = 'Your cart already has 20 items.'; return; }
      message.textContent = cartStore.write(lines) ? 'Added to cart.' : 'This browser could not save your cart.';
      badges();
    }
  });
  dialog.querySelector('.close-button').addEventListener('click', () => dialog.close());
  let outside;
  dialog.addEventListener('pointerdown', event => { outside = event.target === dialog; });
  dialog.addEventListener('click', event => { if (outside && event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => source?.focus({ preventScroll: true }));
  window.addEventListener('storage', () => { badges(); if (!spreadshop && dialog.open && dialog.dataset.kind==='cart') renderCart(); });
  badges();
})();
