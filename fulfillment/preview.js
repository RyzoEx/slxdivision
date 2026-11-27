(() => {
  const section = document.querySelector('[data-fourthwall-preview]');
  if (!section) return;
  const form = section.querySelector('[data-add-item]');
  const input = form.elements.variant;
  const add = form.querySelector('button');
  const remove = section.querySelector('[data-remove-item]');
  const checkout = section.querySelector('[data-preview-checkout]');
  const status = section.querySelector('[data-fourthwall-status]');
  const line = section.querySelector('[data-cart-line]');
  const source = section.querySelector('[data-catalog-source]');
  let cart;

  async function request(params) {
    const response = await fetch('/api/fourthwall-preview?' + new URLSearchParams(params));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }

  request({op:'product'}).then(product=>{
    section.querySelector('[data-product-name]').textContent = product.name;
    source.textContent = product.source === 'fixture' ? 'Test catalog · no real listing' : 'Fourthwall catalog · checkout dry run';
    input.replaceChildren(...product.variants.map(variant=>new Option(variant.label,variant.id)));
    input.disabled = add.disabled = !product.variants.length;
    if (!product.variants.length) status.textContent = 'No variants are available for this product.';
  }).catch(()=>{source.textContent = 'Preview catalog unavailable.';});

  function render() {
    line.textContent = cart ? cart.label + ' × ' + cart.quantity : 'Your test cart is empty.';
    remove.disabled = checkout.disabled = !cart;
    status.textContent = '';
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    cart = {variant:input.value,quantity:form.elements.quantity.value,label:input.selectedOptions[0].textContent};
    render();
  });
  remove.addEventListener('click',()=>{cart = null;render();});
  checkout.addEventListener('click',async ()=>{
    const item = cart;
    checkout.disabled = true;
    try {
      const result = await request({op:'checkout',variant:item.variant,quantity:item.quantity});
      if (cart === item) status.textContent = result.checkoutUrl;
    } catch (error) {
      if (cart === item) status.textContent = error.message;
    } finally {
      if (cart === item) checkout.disabled = false;
    }
  });
})();
