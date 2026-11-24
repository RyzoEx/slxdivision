import catalog from '../content/catalog.json' with { type: 'json' };

export default {
  async fetch(request) {
    const response = (status, error) => Response.json(error ? { error } : { ok: true }, {
      status, headers: { 'Cache-Control': 'no-store' },
    });
    if (request.method !== 'POST') return response(405, 'Method not allowed');
    const site = new URL(request.url);
    if (request.headers.get('origin') !== site.origin) return response(403, 'Invalid origin');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return response(415, 'JSON required');
    if (Number(request.headers.get('content-length')) > 2048) return response(413, 'Request too large');
    let webhook;
    try { webhook = new URL(process.env.SLX_SUBSCRIBE_WEBHOOK); }
    catch { return response(503, 'Subscription is unavailable'); }
    if (webhook.protocol !== 'https:' || webhook.username || webhook.password) {
      return response(503, 'Subscription is unavailable');
    }
    let input;
    try {
      const text = await request.text();
      if (text.length > 2048) return response(413, 'Request too large');
      input = JSON.parse(text);
    } catch { return response(400, 'Invalid request'); }
    const { email, product, size, color } = input ?? {};
    const item = catalog.products.find(entry => entry.id === product && entry.published !== false
      && entry.status === 'coming-soon'
      && catalog.collections.some(collection => collection.id === entry.collection && collection.published !== false && !collection.archived));
    const validRequest = product === 'newsletter'
      ? size === '' && color === ''
      : item && (size === '' || item.sizes?.includes(size)) && (color === '' || item.colors?.includes(color));
    if (typeof email !== 'string' || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !validRequest) {
      return response(400, 'Invalid subscription');
    }
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.SLX_SUBSCRIBE_TOKEN) headers.Authorization = `Bearer ${process.env.SLX_SUBSCRIBE_TOKEN}`;
      const result = await globalThis.fetch(webhook, {
        method: 'POST', headers, body: JSON.stringify({ email, product, size, color }),
        redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      return result.ok ? response(200) : response(502, 'Subscription was not accepted');
    } catch { return response(502, 'Subscription was not accepted'); }
  },
};
