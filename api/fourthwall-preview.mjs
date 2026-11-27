import adapters from '../fulfillment/adapters.cjs';

const json = (data,status = 200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});

export function fourthwallPreviewHandler(env = process.env, {local = false,fetcher = fetch} = {}) {
  return async request => {
    if (!adapters.fourthwallPreview(env,local)) return json({error:'Not found.'},404);
    if (request.method !== 'GET') return json({error:'Use GET.'},405);
    const params = new URL(request.url).searchParams;
    const op = params.get('op') ?? 'product';
    if (!['product','checkout'].includes(op)) return json({error:'Not found.'},404);
    const quantity = Number(params.get('quantity'));
    const adapter = adapters.fulfillmentAdapter('fourthwall',env,fetcher);
    try {
      const product = await adapter.product();
      if (op === 'product') return json(product);
      const variant = product.variants.find(item=>item.id === params.get('variant'));
      if (!variant || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        return json({error:'Choose an available variant and a quantity from 1 to 5.'},400);
      }
      return json({dryRun:true,checkoutUrl:adapter.checkoutRequest(variant.id,quantity)});
    } catch {
      return json({error:'Fourthwall preview is temporarily unavailable.'},502);
    }
  };
}

export default {fetch:fourthwallPreviewHandler()};
