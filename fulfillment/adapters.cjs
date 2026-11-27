const spreadshop = require('../spreadshop/config.cjs');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const checkoutHost = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.fourthwall\.com$/;
const demoProduct = {
  name:'Blind Seraph Tee',
  variants:[
    {id:'00000000-0000-4000-8000-000000000001',label:'Black / M'},
    {id:'00000000-0000-4000-8000-000000000002',label:'Black / L'},
  ],
};

function fourthwall(env, fetcher) {
  const token = env.SLX_FOURTHWALL_STOREFRONT_TOKEN;
  const slug = env.SLX_FOURTHWALL_PRODUCT_SLUG;
  const host = env.SLX_FOURTHWALL_CHECKOUT_HOST;
  const configured = Boolean(token || slug || host);
  return {
    id:'fourthwall',
    checkoutMode:'dry-run',
    async product() {
      if (!configured) return {...demoProduct,source:'fixture'};
      if (!/^ptkn_[\w-]+$/.test(token ?? '') || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug ?? '') || !checkoutHost.test(host ?? '')) {
        throw new Error('Invalid Fourthwall Preview configuration');
      }
      const url = new URL('https://storefront-api.fourthwall.com/v1/products/' + slug);
      url.searchParams.set('storefront_token',token);
      const response = await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(5000)});
      if (!response.ok) throw new Error('Fourthwall product unavailable');
      const data = await response.json();
      if (data.slug !== slug || data.type === 'BUNDLE' || typeof data.name !== 'string' || !Array.isArray(data.variants)) {
        throw new Error('Unexpected Fourthwall product response');
      }
      const variants = data.variants.filter(variant=>uuid.test(variant.id ?? '')
        && (variant.stock?.type === 'UNLIMITED' || (variant.stock?.type === 'LIMITED' && variant.stock.inStock > 0)))
        .map(variant=>({id:variant.id,label:variant.attributes?.description || variant.name || 'Standard'}));
      return {name:data.name,variants,source:'fourthwall'};
    },
    checkoutRequest(variantId, quantity) {
      if (!uuid.test(variantId ?? '') || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        throw new RangeError('Invalid cart item');
      }
      const url = new URL('/cart/checkout','https://' + (configured ? host : 'example.invalid'));
      url.searchParams.set('products',variantId + ':' + quantity);
      url.searchParams.set('currency','USD');
      return url.href;
    },
  };
}

function fulfillmentAdapter(provider, env = process.env, fetcher = fetch) {
  if (provider === 'spreadshop') {
    return {id:provider,checkoutMode:'hosted-shop',shop:spreadshop.shop,launchApproved:spreadshop.launchApproved(env)};
  }
  if (provider === 'fourthwall') return fourthwall(env,fetcher);
  return null;
}

function fourthwallPreview(env = process.env, local = false) {
  return env.VERCEL_ENV === 'preview'
    ? env.VERCEL_GIT_COMMIT_REF === 'codex/fourthwall'
    : local && !env.VERCEL && !env.VERCEL_ENV;
}

module.exports = {fulfillmentAdapter,fourthwallPreview};
