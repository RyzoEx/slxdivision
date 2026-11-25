import { timingSafeEqual } from 'node:crypto';

const headings = {
  new:'Нова заявка SLX', paid:'Передоплату перевірено', cancelled:'Замовлення скасовано',
  return_requested:'Запит на повернення', returned:'Повернення оформлено',
};
const statusNames = {
  availability_check:'перевірка наявності', awaiting_payment:'очікує передоплати', sent_to_manufacturer:'передано виробнику',
  in_production:'у виробництві', preparing_shipment:'готується до відправлення', shipped:'відправлено',
  delivered:'доставлено', completed:'завершено', defective:'брак', unclaimed:'не отримано',
};
const kyiv = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv',dateStyle:'short'});
const uah = new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH'});

export function telegramReady(env) {
  return env.VERCEL_ENV==='production' && /^\d+:[A-Za-z0-9_-]{20,}$/.test(env.SLX_TELEGRAM_BOT_TOKEN ?? '')
    && /^-?\d{1,20}$/.test(env.SLX_TELEGRAM_CHAT_ID ?? '');
}

export function cronAuthorized(env,header) {
  if (!env.CRON_SECRET || env.CRON_SECRET.length<16) return false;
  const expected=Buffer.from('Bearer '+env.CRON_SECRET), actual=Buffer.from(header ?? '');
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}

async function enqueue(db,key,message) {
  await db.query('INSERT INTO slx_telegram_outbox(event_key,message) VALUES ($1,$2) ON CONFLICT DO NOTHING',[key,message]);
}

export async function orderEvent(tx,orderId,mode,actorId,status) {
  const {rows:[event]}=await tx.query(
    'INSERT INTO slx_order_events(order_id,actor_id,status) VALUES ($1,$2,$3) RETURNING id',[orderId,actorId,status]);
  if (mode==='live') {
    const label=headings[status] ?? `Статус замовлення SLX: ${statusNames[status]}`;
    await enqueue(tx,`order:${event.id}`,`${label}\nЗамовлення ${orderId.slice(0,8).toUpperCase()}`);
  }
}

export async function dailyDigest(db,report,date=new Date()) {
  const day=new Date(kyiv.format(date)+'T00:00:00.000Z');
  day.setUTCDate(day.getUTCDate()-1);
  const previous=day.toISOString().slice(0,10);
  const [{totals},{rows:[count]}]=await Promise.all([report(previous),db.query(`SELECT COUNT(*)::int AS orders
    FROM slx_orders WHERE mode='live' AND (closed_at AT TIME ZONE 'Europe/Kyiv')::date=$1::date`,[previous])]);
  await enqueue(db,`daily:${previous}`,`SLX · ${previous}\nЗавершені замовлення: ${count.orders}\nВиручка: ${uah.format(totals.revenue/100)}\nПрибуток: ${uah.format(totals.profit/100)}`);
}

export async function deliverTelegram(db,env,fetcher) {
  if (!telegramReady(env)) return 0;
  let sent=0;
  try {
    const {rows}=await db.query(`UPDATE slx_telegram_outbox SET claimed_at=now()
      WHERE event_key IN (SELECT event_key FROM slx_telegram_outbox WHERE sent_at IS NULL
        AND (claimed_at IS NULL OR claimed_at < now()-interval '10 minutes')
        ORDER BY created_at,event_key FOR UPDATE SKIP LOCKED LIMIT 5)
      RETURNING event_key,message`);
    await Promise.all(rows.map(async row=>{
      try {
        const response=await fetcher(`https://api.telegram.org/bot${env.SLX_TELEGRAM_BOT_TOKEN}/sendMessage`,{
          method:'POST',headers:{'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(4500),
          body:JSON.stringify({chat_id:env.SLX_TELEGRAM_CHAT_ID,text:row.message}),
        });
        if (!response.ok || !(await response.json()).ok) return;
        await db.query('UPDATE slx_telegram_outbox SET sent_at=now() WHERE event_key=$1',[row.event_key]);
        sent++;
      } catch { /* Retried after the claim expires. */ }
    }));
  } catch { console.error('SLX Telegram queue unavailable'); }
  return sent;
}
