import nodemailer from 'nodemailer';

const smtpHosts = new Map([
  ['gmail.com','smtp.gmail.com'],
  ['meta.ua','smtp.meta.ua'],
  ['ukr.net','smtp.ukr.net'],
]);

function smtpHost(env) {
  const sender = /^[^\s@]+@([^\s@]+)$/.exec(env.SLX_SMTP_USER ?? '');
  if (!sender || !env.SLX_SMTP_PASSWORD?.trim()) return undefined;
  const domain = sender[1].toLowerCase();
  if (domain === 'gmail.com' && !/^[a-z0-9]{16}$/i.test(env.SLX_SMTP_PASSWORD)) return undefined;
  return smtpHosts.get(domain);
}

export function launchMailReady(env) {
  return env.VERCEL_ENV === 'production' && env.SLX_UNSUBSCRIBE_SECRET?.length >= 32
    && Boolean(env.SLX_EVENT_WEBHOOK?.startsWith('https://') || smtpHost(env));
}

const escape = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function launchTemplate(event, productName) {
  const origin=escape(new URL(event.url).origin);
  return `<div lang="en" style="background:#0a0a0a;color:#f6f6f6;padding:28px;font:16px Arial,sans-serif"><div style="max-width:540px;margin:auto">
  <img src="${origin}/assets/brand/logo.webp" alt="SLX Division" width="100" style="height:auto">
  <p style="color:#bbb;letter-spacing:.14em">SLX DIVISION · HEAVY DANGELS</p><h1>${escape(productName)}</h1>
  <p>You asked to hear when this design became available.</p>
  <p><a style="color:#f6f6f6" href="${escape(event.url)}">View the design</a></p>
  <p><a style="color:#bbb" href="${escape(event.unsubscribe)}">Unsubscribe or delete your signup</a></p></div></div>`;
}

export function launchMail(env, fetcher) {
  if (env.SLX_EVENT_WEBHOOK?.startsWith('https://')) {
    return async event => {
      const headers = { 'Content-Type':'application/json', 'Idempotency-Key':event.id };
      if (env.SLX_EVENT_TOKEN) headers.Authorization = `Bearer ${env.SLX_EVENT_TOKEN}`;
      const response = await fetcher(env.SLX_EVENT_WEBHOOK, {
        method:'POST', headers, redirect:'error', signal:AbortSignal.timeout(7000), body:JSON.stringify(event),
      });
      if (!response.ok) throw new Error('Delivery rejected');
    };
  }
  const transport = nodemailer.createTransport({
    host:smtpHost(env), port:465, secure:true,
    auth:{user:env.SLX_SMTP_USER,pass:env.SLX_SMTP_PASSWORD},
    connectionTimeout:7000, greetingTimeout:7000, socketTimeout:10000,
  });
  return async (event, productName) => {
    const info = await transport.sendMail({
      from:{name:'SLX Division',address:env.SLX_SMTP_USER},
      to:{address:event.email},
      messageId:`<slx-${event.id}@${new URL(event.url).hostname}>`,
      subject:`SLX Division · ${productName} is available`,
      html:launchTemplate(event,productName),
      text:[
        `You asked to hear when ${productName} became available.`,
        `View the design: ${event.url}`,
        `Unsubscribe or delete your signup: ${event.unsubscribe}`,
      ].join('\n\n'),
    });
    if (!info.accepted.length) throw new Error('Delivery rejected');
  };
}
