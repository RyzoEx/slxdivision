import source from '../content/catalog.json' with { type:'json' };
import { basisPoints, money, requireThat, text } from './security.mjs';
import { supabaseConfig } from './supabase.mjs';

export const statuses = ['new','availability_check','awaiting_payment','paid','sent_to_manufacturer','in_production','shipped','delivered','cancelled','returned','defective','unclaimed'];
const edges = {
  new:['availability_check','cancelled'],
  availability_check:['awaiting_payment','cancelled'],
  awaiting_payment:['paid','cancelled'],
  paid:['sent_to_manufacturer','cancelled','returned'],
  sent_to_manufacturer:['in_production','defective','cancelled'],
  in_production:['shipped','defective','cancelled'],
  shipped:['delivered','unclaimed','defective','returned'],
  delivered:['returned','defective'],
  defective:['returned','in_production','cancelled'],
  unclaimed:['returned','shipped'],
  cancelled:[], returned:[],
};
export const costKeys = ['garment','printing','fulfillment','shipping','payment_fee','return_reserve','tax'];
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const codePattern = /^[A-Z0-9-]{3,24}$/;
const list = (value, limit = 24) => {
  requireThat(Array.isArray(value) && value.length <= limit,400,'Некоректний список варіантів.');
  const values = value.map(item => text(item,50,true));
  requireThat(new Set(values).size === values.length,400,'Варіанти мають бути унікальними.');
  return values;
};
const unarchived = new Set(source.collections.filter(c => c.published !== false && !c.archived).map(c => c.id));
export const productsSource = source.products.filter(p => p.published !== false && unarchived.has(p.collection));
export const collectionsSource = source.collections.filter(c => c.published !== false);

export async function settings(db, lock = false) {
  const {rows} = await db.query('SELECT data FROM slx_settings WHERE id=1' + (lock ? ' FOR UPDATE' : ''));
  return rows[0].data;
}
export async function catalog(db) {
  const {rows} = await db.query('SELECT id,data FROM slx_products');
  const changes = new Map(rows.map(row => [row.id,row.data]));
  return productsSource.map(sourceItem => {
    const row = changes.get(sourceItem.id);
    return {
      id: sourceItem.id, name: sourceItem.name, category: sourceItem.category,
      collection: sourceItem.collection,
      status: row?.status ?? sourceItem.status, price: row?.price ?? (sourceItem.price ? sourceItem.price * 100 : null),
      sizes: row?.sizes ?? sourceItem.sizes ?? [], colors: row?.colors ?? sourceItem.colors ?? [],
      photo: row?.photo ?? '', src: sourceItem.photos[0].src,
    };
  });
}
export function readyForSale(config, items, env) {
  const active = items.filter(item => item.status === 'available');
  const { address, authKey } = supabaseConfig(env);
  return env.SLX_ALLOW_LIVE_ORDERS === '1' && env.VERCEL_ENV === 'production'
    && Boolean(address && authKey)
    && config.manufacturer_ready && config.terms_ready && active.length > 0
    && active.every(item => item.price > 0 && item.sizes.length > 0 && item.colors.length > 0);
}
export async function setProduct(db, actor, data, env) {
  requireThat(productsSource.some(item => item.id === data.id),404,'Річ відсутня у Git-каталозі.');
  requireThat(['coming-soon','available','sold-out'].includes(data.status),400,'Некоректний статус речі.');
  const photo = text(data.photo,100);
  requireThat(!photo || /^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(photo),400,'Некоректне зображення.');
  const record = { status:data.status, price:money(data.price,true), sizes:list(data.sizes), colors:list(data.colors), photo };
  return db.transaction(async tx => {
    const config = await settings(tx,true);
    await tx.query('INSERT INTO slx_products VALUES ($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[data.id,JSON.stringify(record)]);
    if (config.sales) requireThat(readyForSale(config,await catalog(tx),env),409,'Спочатку вимкніть продажі в налаштуваннях.');
    await audit(tx,actor,'product.update',data.id);
    return record;
  });
}
export async function audit(db, actor, action, subject) {
  await db.query('INSERT INTO slx_audit(actor_id,action,subject) VALUES ($1,$2,$3)',[actor.id,action,subject]);
}

export async function createOrder(db, actor, mode, data, env) {
  requireThat(uuid(data.requestId),400,'Повторіть оформлення замовлення.');
  requireThat(Array.isArray(data.items) && data.items.length > 0 && data.items.length <= 20,400,'Додайте від 1 до 20 позицій.');
  return db.transaction(async tx => {
    const config = await settings(tx,true);
    const previous = (await tx.query('SELECT id,status,mode,user_id FROM slx_orders WHERE id=$1',[data.requestId])).rows[0];
    if (previous) {
      requireThat(previous.user_id === actor.id && previous.mode === mode,409,'Запит уже використано.');
      return {id:previous.id,status:previous.status,mode};
    }
    const items = await catalog(tx);
    if (mode === 'live') requireThat(config.sales && readyForSale(config,items,env),409,'Продажі ще не відкрито.');
    const itemsById = new Map(items.map(item => [item.id,item]));
    const cart = data.items.map(row => {
      requireThat(row && Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= 10,400,'Кількість має бути від 1 до 10.');
      const item = itemsById.get(row.id);
      requireThat(item,400,'Річ відсутня в каталозі.');
      const size = text(row.size,50,mode === 'live');
      const color = text(row.color,50,mode === 'live');
      requireThat(!item.sizes.length || item.sizes.includes(size),400,'Оберіть доступний розмір.');
      requireThat(!item.colors.length || item.colors.includes(color),400,'Оберіть доступний колір.');
      if (mode === 'live') requireThat(item.status === 'available' && item.price > 0,409,'Річ зараз недоступна.');
      const price = mode === 'test' ? (row.testPrice === undefined ? item.price : money(row.testPrice,true)) : item.price;
      return {id:item.id,name:item.name,quantity:row.quantity,size,color,price};
    });
    const subtotal = cart.some(item => item.price === null) ? null : cart.reduce((sum,item) => sum + item.price*item.quantity,0);
    let referral = null;
    const code = text(data.referral,24).toUpperCase();
    if (code) {
      requireThat(codePattern.test(code),400,'Некоректний код SLX Circle.');
      referral = (await tx.query('SELECT code,bps FROM slx_referrals WHERE mode=$1 AND code=$2 AND active',[mode,code])).rows[0];
      requireThat(referral,400,'Код SLX Circle недоступний.');
    }
    const delivery = mode === 'test' ? { name:'Тестове замовлення' } : {
      name:text(data.delivery?.name,100,true), phone:text(data.delivery?.phone,24,true),
      city:text(data.delivery?.city,100,true), point:text(data.delivery?.point,120,true),
    };
    if (mode === 'live') requireThat(/^\+?[\d ()-]{7,24}$/.test(delivery.phone),400,'Перевірте номер телефону.');
    await tx.query(`INSERT INTO slx_orders(id,mode,user_id,status,items,delivery,subtotal,referral_code,referral_bps)
      VALUES ($1,$2,$3,'new',$4::jsonb,$5::jsonb,$6,$7,$8)`,
    [data.requestId,mode,actor.id,JSON.stringify(cart),JSON.stringify(delivery),subtotal,referral?.code ?? null,referral?.bps ?? null]);
    await tx.query("INSERT INTO slx_order_events(order_id,actor_id,status) VALUES ($1,$2,'new')",[data.requestId,actor.id]);
    return {id:data.requestId,status:'new',mode};
  });
}

export async function listOrders(db, mode) {
  const { rows } = await db.query(`SELECT o.*,u.email,COALESCE((
    SELECT jsonb_agg(jsonb_build_object('status',e.status,'at',e.created_at) ORDER BY e.id)
    FROM slx_order_events e WHERE e.order_id=o.id),'[]') AS events
    FROM slx_orders o LEFT JOIN slx_users u ON u.id=o.user_id
    WHERE o.mode=$1 ORDER BY o.created_at DESC LIMIT 100`,[mode]);
  return rows.map(order => ({
    ...order,
    ...(mode === 'test' ? {email:null} : {}),
    allowed: [order.status,...edges[order.status].filter(status => mode === 'test' || status !== 'paid')],
  }));
}

export async function changeOrder(db, actor, mode, data) {
  requireThat(uuid(data.id),400,'Некоректний номер замовлення.');
  return db.transaction(async tx => {
    const order = (await tx.query('SELECT * FROM slx_orders WHERE id=$1 AND mode=$2 FOR UPDATE',[data.id,mode])).rows[0];
    requireThat(order,404,'Замовлення не знайдено.');
    requireThat(data.expectedStatus === order.status,409,'Замовлення вже оновлено. Перезавантажте список.');
    const next = data.status ?? order.status;
    requireThat(next === order.status || edges[order.status].includes(next),409,'Цей перехід між статусами недоступний.');
    requireThat(next !== 'paid' || order.status === 'paid' || mode === 'test',409,'Оплати реальних замовлень вимкнено.');
    if (next === 'paid') requireThat(order.subtotal !== null,409,'Для тестової оплати вкажіть тестову ціну при створенні замовлення.');
    const manufacturing = { ...order.manufacturing };
    for (const [key,max] of [['technology',80],['notes',600],['tracking',64]]) {
      if (data[key] !== undefined) manufacturing[key] = text(data[key],max);
    }
    if (next === 'shipped') requireThat(manufacturing.tracking,400,'Вкажіть номер ТТН.');
    const financials = { ...order.financials };
    if (Object.hasOwn(data,'costs')) {
      requireThat(['owner','manager'].includes(actor.role),403,'Недостатньо прав для змін витрат.');
      requireThat(data.costs && typeof data.costs === 'object' && !Array.isArray(data.costs),400,'Перевірте витрати.');
      for (const key of costKeys) if (Object.hasOwn(data.costs,key)) financials[key] = money(data.costs[key],true);
    }
    const changed = next !== order.status;
    await tx.query(`UPDATE slx_orders SET status=$3,manufacturing=$4::jsonb,financials=$5::jsonb,
      paid_at=CASE WHEN $3='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END,
      closed_at=CASE WHEN $3='delivered' THEN COALESCE(closed_at,now()) ELSE closed_at END,
      refunded_at=CASE WHEN paid_at IS NOT NULL AND $3 IN ('returned','cancelled')
        THEN COALESCE(refunded_at,now()) ELSE refunded_at END WHERE id=$1 AND mode=$2`,
    [data.id,mode,next,JSON.stringify(manufacturing),JSON.stringify(financials)]);
    if (changed) {
      await tx.query('INSERT INTO slx_order_events(order_id,actor_id,status) VALUES ($1,$2,$3)',[data.id,actor.id,next]);
      if (next === 'delivered' && order.paid_at && order.referral_code) {
        const earned = Math.round(Number(order.subtotal) * order.referral_bps / 10000);
        await tx.query("INSERT INTO slx_referral_entries(order_id,kind,amount) VALUES ($1,'credit',$2) ON CONFLICT DO NOTHING",[data.id,earned]);
      }
      if (['returned','cancelled'].includes(next)) {
        await tx.query(`INSERT INTO slx_referral_entries(order_id,kind,amount)
          SELECT order_id,'reversal',amount FROM slx_referral_entries
          WHERE order_id=$1 AND kind='credit' ON CONFLICT DO NOTHING`,[data.id]);
      }
    }
    await audit(tx,actor,'order.update',data.id);
    return {id:data.id,status:next};
  });
}

export async function setReferral(db, actor, mode, data) {
  const code = text(data.code,24,true).toUpperCase();
  requireThat(codePattern.test(code),400,'Код має містити 3–24 літери, цифри або дефіси.');
  const label = text(data.label,100,true);
  const bps = basisPoints(data.bps ?? (await settings(db)).referral_bps);
  const active = data.active !== false;
  const existing = (await db.query('SELECT 1 FROM slx_referrals WHERE mode=$1 AND code=$2',[mode,code])).rows[0];
  requireThat(data.edit === true ? existing : !existing,409,existing ? 'Цей код уже існує.' : 'Код не знайдено.');
  try {
    if (data.edit === true) await db.query('UPDATE slx_referrals SET label=$3,bps=$4,active=$5 WHERE mode=$1 AND code=$2',[mode,code,label,bps,active]);
    else await db.query('INSERT INTO slx_referrals(mode,code,label,bps,active) VALUES ($1,$2,$3,$4,$5)',[mode,code,label,bps,active]);
  } catch (error) {
    if (error.code === '23505') requireThat(false,409,'Цей код уже існує.');
    throw error;
  }
  await audit(db,actor,'referral.update',`${mode}:${code}`);
  return { code,label,bps,active };
}

export async function referrals(db, mode) {
  const { rows: codes } = await db.query('SELECT code,label,bps,active FROM slx_referrals WHERE mode=$1 ORDER BY code',[mode]);
  const { rows: history } = await db.query(`SELECT e.order_id,o.referral_code,e.kind,e.amount,e.created_at
    FROM slx_referral_entries e JOIN slx_orders o ON o.id=e.order_id
    WHERE o.mode=$1 ORDER BY e.created_at DESC LIMIT 300`,[mode]);
  return { codes,history };
}

export async function updateSettings(db, actor, data, env) {
  for (const key of ['sales','manufacturer_ready','terms_ready']) requireThat(typeof data[key] === 'boolean',400,'Підтвердьте умови запуску.');
  const config = {
    sales:data.sales, manufacturer_ready:data.manufacturer_ready, terms_ready:data.terms_ready,
    founder_share_bps:basisPoints(data.founder_share_bps), referral_bps:basisPoints(data.referral_bps),
  };
  return db.transaction(async tx => {
    await settings(tx,true);
    if (config.sales) requireThat(readyForSale(config,await catalog(tx),env),409,'Для продажів потрібні налаштований production, підтверджені умови й хоча б одна доступна річ із ціною, розміром та кольором.');
    await tx.query('UPDATE slx_settings SET data=$1::jsonb WHERE id=1',[JSON.stringify(config)]);
    await audit(tx,actor,'settings.update','store');
    return config;
  });
}
