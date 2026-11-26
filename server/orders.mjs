import source from '../content/catalog.json' with { type:'json' };
import { basisPoints, money, requireThat, text } from './security.mjs';
import { supabaseConfig } from './supabase.mjs';
import { calculatePrice, commissionAmount, manufacturerData } from './pricing.mjs';
import { recordSettlement } from './shared-funds.mjs';
import { orderEvent } from './telegram.mjs';
import spreadshop from '../spreadshop/config.cjs';

export const statuses = ['new','availability_check','awaiting_payment','paid','sent_to_manufacturer','in_production','preparing_shipment','shipped','delivered','completed','cancelled','return_requested','returned','defective','unclaimed'];
export const launchChecks = ['prices_ready','sample_ready','terms_ready','seller_ready','payment_ready','manufacturer_ready'];
const edges = {
  new:['availability_check','cancelled'],
  availability_check:['awaiting_payment','cancelled'],
  awaiting_payment:['paid','cancelled'],
  paid:['sent_to_manufacturer','cancelled','returned'],
  sent_to_manufacturer:['in_production','defective','cancelled'],
  in_production:['preparing_shipment','shipped','defective','cancelled'],
  preparing_shipment:['shipped','defective','cancelled'],
  shipped:['delivered','unclaimed','defective','returned'],
  delivered:['completed','return_requested','returned','defective'],
  completed:['return_requested','returned'],
  return_requested:['returned'],
  defective:['returned','in_production','cancelled'],
  unclaimed:['returned','shipped'],
  cancelled:[], returned:[],
};
export const costKeys = ['garment','printing','fulfillment','other','shipping','payment_fee','return_reserve','tax'];
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
      manufacturerId:row?.manufacturerId ?? null, pricing:row?.pricing ?? null,
    };
  });
}
export function readyForSale(config, items, env) {
  const active = items.filter(item => item.status === 'available');
  const { address, authKey } = supabaseConfig(env);
  return !spreadshop.usesSpreadshop(env) && env.SLX_ALLOW_LIVE_ORDERS === '1' && env.VERCEL_ENV === 'production'
    && Boolean(address && authKey) && env.SLX_CUSTOMER_OTP_ENABLED === '1'
    && launchChecks.every(key=>config[key]===true) && active.length > 0
    && active.every(item => item.price > 0 && item.sizes.length > 0 && item.colors.length > 0
      && item.manufacturerId && item.pricing?.retail===item.price && item.pricing.advance>0 && item.pricing.advance<item.price);
}
export const manualPrepaymentAllowed = (config,items,env) =>
  env.SLX_ALLOW_MANUAL_PREPAYMENT === '1' && config.sales && readyForSale(config,items,env);
export async function setProduct(db, actor, data, env) {
  requireThat(productsSource.some(item => item.id === data.id),404,'Річ відсутня у Git-каталозі.');
  requireThat(['coming-soon','available','sold-out'].includes(data.status),400,'Некоректний статус речі.');
  const photo = text(data.photo,100);
  requireThat(!photo || /^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(photo),400,'Некоректне зображення.');
  const record = { status:data.status, price:money(data.price,true), sizes:list(data.sizes), colors:list(data.colors), photo };
  return db.transaction(async tx => {
    const config = await settings(tx,true);
    await updateProductData(tx,data.id,record);
    if (config.sales) requireThat(readyForSale(config,await catalog(tx),env),409,'Спочатку вимкніть продажі в налаштуваннях.');
    await audit(tx,actor,'product.update',data.id);
    return record;
  });
}
async function updateProductData(tx,id,record) {
  await tx.query(`INSERT INTO slx_products AS existing(id,data) VALUES ($1,$2::jsonb)
    ON CONFLICT(id) DO UPDATE SET data=existing.data || EXCLUDED.data`,[id,JSON.stringify(record)]);
}

export async function setPricing(db,actor,data,env) {
  requireThat(productsSource.some(item=>item.id===data.id),404,'Річ відсутня в каталозі.');
  return db.transaction(async tx=>{
    const config=await settings(tx,true);
    const calculation=calculatePrice(data.values,config.reserve_bps ?? 0);
    if (data.preview===true) return calculation;
    const manufacturerId=data.manufacturerId || null;
    if (manufacturerId) {
      requireThat(uuid(manufacturerId),400,'Оберіть виробника.');
      requireThat((await tx.query('SELECT 1 FROM slx_manufacturers WHERE id=$1',[manufacturerId])).rows.length,404,'Виробника не знайдено.');
    }
    await updateProductData(tx,data.id,{pricing:calculation.values,manufacturerId});
    if (config.sales) requireThat(readyForSale(config,await catalog(tx),env),409,'Спочатку вимкніть робочі замовлення.');
    await audit(tx,actor,'pricing.update',data.id);
    return calculation;
  });
}

export async function setManufacturer(db,actor,data) {
  requireThat(uuid(data.id),400,'Некоректний ідентифікатор виробника.');
  const record=manufacturerData(data);
  return db.transaction(async tx=>{
    await tx.query(`INSERT INTO slx_manufacturers(id,data) VALUES ($1,$2::jsonb)
      ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`,[data.id,JSON.stringify(record)]);
    await audit(tx,actor,'manufacturer.update',data.id);
    return {id:data.id,...record};
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
      const advance = item.pricing?.advance ?? null;
      if (mode==='test' && price!==null && advance!==null) {
        return {id:item.id,name:item.name,quantity:row.quantity,size,color,price,advance:Math.min(price,advance)};
      }
      return {id:item.id,name:item.name,quantity:row.quantity,size,color,price,advance,manufacturerId:item.manufacturerId};
    });
    const subtotal = cart.some(item => item.price === null) ? null : cart.reduce((sum,item) => sum + item.price*item.quantity,0);
    let referral = null;
    const code = text(data.referral,24).toUpperCase();
    if (code) {
      requireThat(codePattern.test(code),400,'Некоректний код SLX Circle.');
      referral = (await tx.query('SELECT code,bps,fixed_amount FROM slx_referrals WHERE mode=$1 AND code=$2 AND active',[mode,code])).rows[0];
      requireThat(referral,400,'Код SLX Circle недоступний.');
    }
    const delivery = mode === 'test' ? { name:'Тестове замовлення' } : {
      name:text(data.delivery?.name,100,true), phone:text(data.delivery?.phone,24,true),
      city:text(data.delivery?.city,100,true), point:text(data.delivery?.point,120,true),
      contact:text(data.delivery?.contact,180,true), comment:text(data.delivery?.comment,600),
      payment:'advance_and_on_delivery', termsVersion:'made-to-order-v1',
    };
    if (mode === 'live') {
      requireThat(/^\+?[\d ()-]{7,24}$/.test(delivery.phone),400,'Перевірте номер телефону.');
      requireThat(/^(?:@[a-z0-9_]{5,32}|[^\s@]+@[^\s@]+\.[^\s@]+)$/i.test(delivery.contact),400,'Вкажіть email або Telegram.');
      requireThat(data.delivery?.payment===delivery.payment && data.delivery?.termsAccepted===true,400,'Ознайомтеся з умовами оформлення.');
    }
    const advance=cart.every(line=>line.advance!==null) ? cart.reduce((sum,line)=>sum+line.advance*line.quantity,0) : null;
    await tx.query(`INSERT INTO slx_orders(id,mode,user_id,status,items,delivery,subtotal,advance,referral_code,referral_bps,referral_fixed)
      VALUES ($1,$2,$3,'new',$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10)`,
    [data.requestId,mode,actor.id,JSON.stringify(cart),JSON.stringify(delivery),subtotal,advance,
      referral?.code ?? null,referral?.bps ?? null,referral?.fixed_amount ?? null]);
    await orderEvent(tx,data.requestId,mode,actor.id,'new');
    return {id:data.requestId,status:'new',mode};
  });
}

export async function listOrders(db, mode, allowManual=false) {
  const { rows } = await db.query(`SELECT o.*,u.email,COALESCE((
    SELECT jsonb_agg(jsonb_build_object('status',e.status,'at',e.created_at) ORDER BY e.id)
    FROM slx_order_events e WHERE e.order_id=o.id),'[]') AS events
    FROM slx_orders o LEFT JOIN slx_users u ON u.id=o.user_id
    WHERE o.mode=$1 ORDER BY o.created_at DESC LIMIT 100`,[mode]);
  return rows.map(order => ({
    ...order,
    ...(mode === 'test' ? {email:null} : {}),
    allowed: [order.status,...edges[order.status].filter(status => mode === 'test' || status !== 'paid' || allowManual)],
  }));
}

export async function changeOrder(db, actor, mode, data, env={}) {
  requireThat(uuid(data.id),400,'Некоректний номер замовлення.');
  return db.transaction(async tx => {
    const config=await settings(tx,true);
    const order = (await tx.query('SELECT * FROM slx_orders WHERE id=$1 AND mode=$2 FOR UPDATE',[data.id,mode])).rows[0];
    requireThat(order,404,'Замовлення не знайдено.');
    if (actor.role==='customer') requireThat(mode==='live' && order.user_id===actor.id && data.status==='return_requested',404,'Замовлення не знайдено.');
    requireThat(data.expectedStatus === order.status,409,'Замовлення вже оновлено. Перезавантажте список.');
    const next = data.status ?? order.status;
    requireThat(next === order.status || edges[order.status].includes(next),409,'Цей перехід між статусами недоступний.');
    if (next!==order.status && (['paid','completed'].includes(next) || (order.paid_at && ['returned','cancelled'].includes(next)))) {
      requireThat(['owner','manager'].includes(actor.role),403,'Недостатньо прав для підтвердження розрахунків.');
    }
    if (next === 'paid' && next!==order.status) {
      requireThat(order.subtotal !== null,409,'Вкажіть суму замовлення перед підтвердженням надходження.');
      if (mode==='live') requireThat(manualPrepaymentAllowed(config,await catalog(tx),env),409,'Робочий облік передоплати вимкнено.');
    }
    const manufacturing = { ...order.manufacturing };
    for (const [key,max] of [['technology',80],['notes',600],['tracking',64]]) {
      if (data[key] !== undefined) manufacturing[key] = text(data[key],max);
    }
    if (next === 'shipped') requireThat(manufacturing.tracking,400,'Вкажіть номер ТТН.');
    const financials = { ...order.financials };
    const finished = ['cancelled','returned'].includes(order.status) || Boolean(order.closed_at);
    if (Object.hasOwn(data,'costs')) {
      requireThat(['owner','manager'].includes(actor.role),403,'Недостатньо прав для змін витрат.');
      requireThat(!finished,409,'Витрати вже зафіксовано.');
      requireThat(data.costs && typeof data.costs === 'object' && !Array.isArray(data.costs),400,'Перевірте витрати.');
      for (const key of costKeys) if (Object.hasOwn(data.costs,key)) financials[key] = money(data.costs[key],true);
    }
    const changed = next !== order.status;
    const resolution={...order.resolution};
    if (Object.hasOwn(data,'reason')) resolution.reason=text(data.reason,500,actor.role==='customer');
    if (changed && mode==='live' && next==='paid') {
      const received=money(data.advanceReceived);
      requireThat(received>0 && received===Number(order.advance),400,'Підтвердьте отриману передоплату в сумі замовлення.');
      resolution.advanceReceived=received;
      resolution.advanceReference=text(data.advanceReference,120,true);
    }
    const refunded=changed && ['returned','cancelled'].includes(next) && Boolean(order.paid_at);
    if (refunded) {
      const received=Number(order.closed_at ? order.subtotal : order.advance ?? order.subtotal);
      resolution.refund=money(data.refund ?? (mode==='test' ? received : null));
      requireThat(resolution.refund<=received,400,'Сума повернення не може перевищувати отриману оплату.');
    }
    if (next==='completed' && changed) {
      requireThat(order.paid_at && order.subtotal!==null,409,'Спочатку підтвердьте надходження.');
      if (mode==='live') {
        const received=money(data.balanceReceived);
        requireThat(received===Number(order.subtotal)-Number(order.advance ?? 0),400,'Підтвердьте залишок, отриманий після доставки.');
        resolution.balanceReceived=received;
      }
    }
    await tx.query(`UPDATE slx_orders SET status=$3,manufacturing=$4::jsonb,financials=$5::jsonb,resolution=$6::jsonb,
      paid_at=CASE WHEN $3='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END,
      closed_at=CASE WHEN $3='completed' THEN COALESCE(closed_at,now()) ELSE closed_at END,
      refunded_at=CASE WHEN $7 THEN COALESCE(refunded_at,now()) ELSE refunded_at END WHERE id=$1 AND mode=$2`,
    [data.id,mode,next,JSON.stringify(manufacturing),JSON.stringify(financials),JSON.stringify(resolution),refunded]);
    if (changed) {
      await orderEvent(tx,data.id,mode,actor.id,next);
      const expenses=costKeys.reduce((sum,key)=>sum+Number(financials[key] ?? 0),0);
      if (next==='completed' && !order.closed_at) {
        const earned=order.referral_code ? commissionAmount(Number(order.subtotal),
          {bps:order.referral_bps,fixed:order.referral_fixed===null ? null : Number(order.referral_fixed)}) : 0;
        if (order.referral_code) {
          await tx.query("INSERT INTO slx_referral_entries(order_id,kind,amount) VALUES ($1,'credit',$2) ON CONFLICT DO NOTHING",[data.id,earned]);
        }
        await recordSettlement(tx,actor,order,'completion',Number(order.subtotal)-expenses-earned,config);
      }
      if (['returned','cancelled'].includes(next)) {
        const {rows:[reversal]}=await tx.query(`INSERT INTO slx_referral_entries(order_id,kind,amount)
          SELECT order_id,'reversal',amount FROM slx_referral_entries
          WHERE order_id=$1 AND kind='credit' ON CONFLICT DO NOTHING RETURNING amount`,[data.id]);
        if (refunded) {
          const retained=order.closed_at ? 0 : Number(order.advance ?? order.subtotal)-expenses;
          await recordSettlement(tx,actor,order,'refund',retained-resolution.refund+Number(reversal?.amount ?? 0),config);
        }
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
  const fixed = money(data.fixed,true);
  const active = data.active !== false;
  const existing = (await db.query('SELECT 1 FROM slx_referrals WHERE mode=$1 AND code=$2',[mode,code])).rows[0];
  requireThat(data.edit === true ? existing : !existing,409,existing ? 'Цей код уже існує.' : 'Код не знайдено.');
  try {
    if (data.edit === true) await db.query('UPDATE slx_referrals SET label=$3,bps=$4,active=$5,fixed_amount=$6 WHERE mode=$1 AND code=$2',[mode,code,label,bps,active,fixed]);
    else await db.query('INSERT INTO slx_referrals(mode,code,label,bps,active,fixed_amount) VALUES ($1,$2,$3,$4,$5,$6)',[mode,code,label,bps,active,fixed]);
  } catch (error) {
    if (error.code === '23505') requireThat(false,409,'Цей код уже існує.');
    throw error;
  }
  await audit(db,actor,'referral.update',`${mode}:${code}`);
  return { code,label,bps,active,fixed_amount:fixed };
}

export async function referrals(db, mode) {
  const { rows: codes } = await db.query('SELECT code,label,bps,active,fixed_amount FROM slx_referrals WHERE mode=$1 ORDER BY code',[mode]);
  const { rows: history } = await db.query(`SELECT e.order_id,o.referral_code,e.kind,e.amount,e.created_at
    FROM slx_referral_entries e JOIN slx_orders o ON o.id=e.order_id
    WHERE o.mode=$1 ORDER BY e.created_at DESC LIMIT 300`,[mode]);
  return { codes,history };
}

export async function updateSettings(db, actor, data, env) {
  return db.transaction(async tx => {
    const previous=await settings(tx,true);
    requireThat(typeof data.sales==='boolean',400,'Оберіть режим магазину.');
    const checks=Object.fromEntries(launchChecks.map(key=>{
      const value=data[key] ?? previous[key] ?? false;
      requireThat(typeof value==='boolean',400,'Перевірте чекліст запуску.');
      return [key,value];
    }));
    const config={...checks,sales:data.sales,referral_bps:basisPoints(data.referral_bps ?? previous.referral_bps),
      reserve_bps:basisPoints(data.reserve_bps ?? previous.reserve_bps ?? 0),
      fund_goal:Object.hasOwn(data,'fund_goal') ? money(data.fund_goal,true) : previous.fund_goal ?? null};
    if (config.sales) requireThat(readyForSale(config,await catalog(tx),env),409,'Потрібні всі підтвердження запуску, виробник і затверджений розрахунок для кожного доступного товару.');
    await tx.query('UPDATE slx_settings SET data=$1::jsonb WHERE id=1',[JSON.stringify(config)]);
    await audit(tx,actor,'settings.update','store');
    return config;
  });
}
