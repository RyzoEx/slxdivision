(() => {
  const currency = new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH'});
  const orderStatus = {
    new:'Нове', availability_check:'Перевірка наявності', awaiting_payment:'Очікує оплати',
    paid:'Оплачено', sent_to_manufacturer:'Передано виробнику', in_production:'У виробництві',
    shipped:'Відправлено', delivered:'Доставлено', cancelled:'Скасовано', returned:'Повернено',
    defective:'Брак', unclaimed:'Не отримано',
  };
  const productStatus = {'coming-soon':'Скоро',available:'У наявності','sold-out':'Розпродано'};
  function endpoint(op, params = {}) { return '/api/commerce?' + new URLSearchParams({op,...params}); }
  async function api(op, {params, body} = {}) {
    const response = await fetch(endpoint(op,params), {
      ...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}),
      credentials:'same-origin',
    });
    const output = await response.json().catch(()=>({}));
    if (!response.ok) {
      const error = new Error(output.error || 'Сервіс тимчасово недоступний.');
      error.status = response.status;
      throw error;
    }
    return output;
  }
  const element = (tag, props, ...children) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children.flat().filter(child=>child !== null && child !== undefined));
    return node;
  };
  const money = amount => amount === null || amount === undefined ? '—' : currency.format(Number(amount)/100);
  function local(key, validate) {
    return {
      read() {
        try {
          const data = JSON.parse(localStorage.getItem(key) ?? '[]');
          return Array.isArray(data) ? data.filter(validate) : [];
        } catch { return []; }
      },
      write(data) { try { localStorage.setItem(key,JSON.stringify(data)); } catch { return false; } return true; },
    };
  }
  const cart = local('slx-cart-v2', line => typeof line?.id==='string' && typeof line.size==='string'
    && typeof line.color==='string' && Number.isInteger(line.quantity) && line.quantity>0 && line.quantity<=10);
  const favorites = local('slx-favorites-v1', id => typeof id==='string');
  let catalogPromise;
  function catalog() { return catalogPromise ??= api('catalog').catch(()=>({ready:false,sales:false,products:[]})); }
  window.slx = { api, endpoint, element, money, orderStatus, productStatus, cart, favorites, catalog };
})();
