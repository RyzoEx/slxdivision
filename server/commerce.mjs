import { adminPage } from './admin-shell.mjs';
import { changeRole, login, logout, requestOtp, verifyOtp } from './auth.mjs';
import { audit, catalog, changeOrder, collectionsSource, createOrder, listOrders, productsSource, readyForSale,
  launchChecks, manualPrepaymentAllowed, referrals, setManufacturer, setPricing, setProduct, setReferral, settings, statuses, updateSettings, uuid } from './orders.mjs';
import { csv, report } from './finance.mjs';
import { manufacturers } from './pricing.mjs';
import { funds, transferFunds } from './shared-funds.mjs';
import { cronAuthorized, dailyDigest, deliverTelegram, telegramReady } from './telegram.mjs';
import { interest, notifyLaunch, unsubscribe } from './interests.mjs';
import { launchMailReady } from './launch-mail.mjs';
import { currentUser, Failure, isAdmin, newId, readJson, requireThat, text, throttle } from './security.mjs';

const baseHeaders = { 'Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff' };
function json(data, status = 200, headers = {}) {
  return Response.json(data,{status,headers:{...baseHeaders,...headers}});
}
const manager = user => user && ['owner','manager'].includes(user.role);
const imageKey = /^[a-f0-9-]{36}\.(png|jpg|webp)$/;
const fileTypes = {
  png: { mime:'image/png', check:b=>b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) },
  jpg: { mime:'image/jpeg', check:b=>b.subarray(0,3).equals(Buffer.from('ffd8ff','hex')) },
  webp: { mime:'image/webp', check:b=>b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP' },
};
function exposeOrder(order,user) {
  if (manager(user)) return order;
  const {financials,subtotal,advance,referral_bps,referral_code,referral_fixed,resolution,items,...rest} = order;
  return {...rest,items:items.map(({price,advance,...item})=>item)};
}
function adminMetadata(user, config, items, env, auth) {
  return {
    user, statuses, sales:config.sales && readyForSale(config,items,env), modeReady:readyForSale(config,items,env),
    storageReady:auth.storageReady, canNotify:launchMailReady(env),
    telegramReady:telegramReady(env),
  };
}

export function commerce({ db, auth, env=process.env, local=false, fetcher=fetch }) {
  return async request => {
    const url = new URL(request.url);
    const op = url.pathname === '/admin' ? 'admin-page' : url.pathname === '/api/telegram-daily' ? 'telegram-cron' : url.searchParams.get('op');
    const get = request.method === 'GET';
    const origin = url.origin;
    const secure = !local || url.protocol === 'https:';
    try {
      if (op === 'catalog' && get && !db) return json({ready:false,sales:false,products:[]});
      if (op==='telegram-cron') {
        requireThat(get && cronAuthorized(env,request.headers.get('authorization')),401,'Потрібна авторизація.');
        if (!db || !telegramReady(env)) return json({configured:false});
        await dailyDigest(db,day=>report(db,'live',day,day));
        return json({sent:await deliverTelegram(db,env,fetcher)});
      }
      requireThat(db,503,'База даних SLX ще не налаштована.');
      const user = await currentUser(db,request,secure);
      if (op === 'admin-page' && get) {
        return new Response(adminPage(isAdmin(user)),{
          status:user && !isAdmin(user) ? 403 : 200,
          headers:{...baseHeaders,'Content-Type':'text/html; charset=utf-8',
            'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"},
        });
      }
      if (op === 'catalog' && get) {
        const [config,products] = await Promise.all([settings(db),catalog(db)]);
        const sales = config.sales && readyForSale(config,products,env);
        return json({ready:true,sales,products:products.map(({pricing,manufacturerId,...item}) => ({
          ...item,price:sales ? item.price : null,status:!sales && item.status==='available' ? 'coming-soon' : item.status,
          ...(sales && item.status==='available' ? {advance:pricing.advance} : {}),
          photo:item.photo ? `/api/commerce?op=media&key=${item.photo}` : '',
        }))});
      }
      if (op === 'media' && get) {
        const key = url.searchParams.get('key');
        requireThat(imageKey.test(key ?? '') && (await catalog(db)).some(item=>item.photo===key),404,'Зображення не знайдено.');
        const file = await auth.download(key);
        requireThat(file.ok,404,'Зображення не знайдено.');
        return new Response(file.body,{headers:{'Content-Type':fileTypes[key.split('.').at(-1)].mime,'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
      }
      if (op === 'account' && get) {
        const authReady = auth.authReady && env.SLX_CUSTOMER_OTP_ENABLED === '1';
        if (!user) return json({user:null,orders:[],authReady});
        const {rows:orders} = await db.query(`SELECT id,status,items,subtotal,advance,created_at,
          CASE WHEN EXISTS(SELECT 1 FROM slx_order_events WHERE order_id=slx_orders.id AND status='shipped')
            THEN manufacturing->>'tracking' END AS tracking,
          (SELECT jsonb_agg(jsonb_build_object('status',status,'at',created_at) ORDER BY id) FROM slx_order_events WHERE order_id=slx_orders.id) AS events
          FROM slx_orders WHERE mode='live' AND user_id=$1 ORDER BY created_at DESC LIMIT 100`,[user.id]);
        return json({user,authReady,orders:orders.map(order=>({...order,items:order.items.map(({manufacturerId,...item})=>item)}))});
      }

      const mode = url.searchParams.get('mode') ?? 'test';
      if (op?.startsWith('admin-')) {
        requireThat(isAdmin(user),user ? 403 : 401,'Потрібен адміністративний доступ.');
        requireThat(mode==='test' || mode==='live',400,'Некоректний режим.');
      }
      if (op === 'admin-summary' && get) {
        const [config,items,{rows}] = await Promise.all([settings(db),catalog(db),db.query('SELECT status,COUNT(*)::int AS count FROM slx_orders WHERE mode=$1 GROUP BY status',[mode])]);
        return json({...adminMetadata(user,config,items,env,auth),counts:rows,products:items.length});
      }
      if (op === 'admin-products' && get) {
        requireThat(manager(user),403,'Недостатньо прав.');
        const [items,partners,config]=await Promise.all([catalog(db),manufacturers(db),settings(db)]);
        return json({products:items,manufacturers:partners.map(({id,name})=>({id,name})),reserveBps:config.reserve_bps ?? 0,
          storageReady:auth.storageReady,canNotify:launchMailReady(env)});
      }
      if (op==='admin-manufacturers' && get) {
        requireThat(manager(user),403,'Недостатньо прав.');
        return json({manufacturers:await manufacturers(db)});
      }
      if (op==='admin-funds' && get) {
        requireThat(manager(user),403,'Недостатньо прав.');
        return json(await funds(db,mode,await settings(db)));
      }
      if (op === 'admin-collections' && get) {
        requireThat(manager(user),403,'Недостатньо прав.');
        const {rows} = await db.query('SELECT id,data FROM slx_collections');
        const notes = new Map(rows.map(row => [row.id,row.data.notes]));
        return json({collections:collectionsSource.map(({id,name,archived})=>({id,name,archived,notes:notes.get(id) ?? '',
          count:productsSource.filter(item=>item.collection===id).length}))});
      }
      if (['admin-orders','admin-manufacturing'].includes(op) && get) {
        const items=mode==='test' && manager(user) || mode==='live' && env.SLX_ALLOW_MANUAL_PREPAYMENT==='1' ? await catalog(db) : [];
        const allowManual=mode==='live' && items.length>0 && manualPrepaymentAllowed(await settings(db),items,env);
        const [orders,partners]=await Promise.all([listOrders(db,mode,allowManual),manufacturers(db)]);
        return json({orders:orders.map(order=>exposeOrder(order,user)),manufacturers:partners.map(({id,name})=>({id,name})),
          ...(mode==='test' && manager(user) ? {products:items} : {})});
      }
      if (op === 'admin-customers' && get) {
        requireThat(manager(user),403,'Недостатньо прав.');
        if (mode === 'test') return json({customers:[]});
        const {rows} = await db.query(`SELECT u.id,u.email,u.created_at,
          (SELECT COUNT(*)::int FROM slx_orders WHERE user_id=u.id AND mode='live') AS orders
          FROM slx_users u WHERE role='customer' AND active ORDER BY created_at DESC LIMIT 150`);
        return json({customers:rows});
      }
      if (['admin-finance','admin-finance-csv'].includes(op) && get) {
        requireThat(manager(user),403,'Недостатньо прав.');
        const data = await report(db,mode,url.searchParams.get('from'),url.searchParams.get('to'));
        return op==='admin-finance' ? json(data) : new Response(csv(data),{headers:{...baseHeaders,
          'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename=slx-${mode}-${data.from}-${data.to}.csv`}});
      }
      if (op === 'admin-referrals' && get) {
        requireThat(manager(user),403,'Недостатньо прав.');
        return json({...await referrals(db,mode),bps:(await settings(db)).referral_bps});
      }
      if (op === 'admin-settings' && get) {
        requireThat(user.role==='owner',403,'Налаштування доступні лише власнику.');
        const {rows:staff} = await db.query("SELECT id,email,role,active FROM slx_users WHERE role<>'customer' ORDER BY email");
        const config = await settings(db);
        return json({config,staff,launchChecks,telegramReady:telegramReady(env),envAllowsSales:env.VERCEL_ENV === 'production' && env.SLX_ALLOW_LIVE_ORDERS==='1'});
      }

      requireThat(request.method==='POST',404,'Маршрут не знайдено.');
      requireThat(request.headers.get('origin')===origin,403,'Запит має надходити із сайту SLX.');
      const data = await readJson(request,op==='admin-upload' ? 2000000 : undefined);
      const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.slice(0,80) || 'local';
      if (op==='login') return json({ok:true},200,{'Set-Cookie':await login(db,auth,data,ip,secure)});
      if (op==='otp' || op==='verify') {
        requireThat(auth.authReady && env.SLX_CUSTOMER_OTP_ENABLED === '1',503,'Вхід у кабінет покупця ще не відкрито.');
      }
      if (op==='otp') { await requestOtp(db,auth,data,ip); return json({ok:true}); }
      if (op==='verify') return json({ok:true},200,{'Set-Cookie':await verifyOtp(db,auth,data,ip,secure)});
      if (op==='logout') return json({ok:true},200,{'Set-Cookie':await logout(db,request,secure)});
      if (op==='interest') { await interest(db,data,ip); return json({ok:true},201); }
      if (op==='unsubscribe') { await unsubscribe(db,data.token); return json({ok:true}); }
      if (op==='order') {
        requireThat(user?.role==='customer',401,'Підтвердьте вхід у кабінет покупця.');
        await throttle(db,`order-user:${user.id}`,18,15);
        const result=await createOrder(db,user,'live',data,env);
        await deliverTelegram(db,env,fetcher);
        return json(result,201);
      }
      if (op==='order-return') {
        requireThat(user?.role==='customer',401,'Підтвердьте вхід у кабінет покупця.');
        await throttle(db,`return-user:${user.id}`,10,15);
        const result=await changeOrder(db,user,'live',{id:data.id,expectedStatus:data.expectedStatus,status:'return_requested',reason:data.reason});
        await deliverTelegram(db,env,fetcher);
        return json(result);
      }
      if (op==='admin-test-order') {
        requireThat(manager(user) && mode==='test',403,'Тестові замовлення доступні лише команді в тестовому режимі.');
        return json(await createOrder(db,user,'test',data,env),201);
      }
      if (op==='admin-order') {
        const result=await changeOrder(db,user,mode,data,env);
        if (mode==='live') await deliverTelegram(db,env,fetcher);
        return json(result);
      }
      if (op==='admin-pricing') {
        requireThat(manager(user) && (mode==='live' || data.preview===true),403,'Потрібен доступ до робочого каталогу.');
        return json(await setPricing(db,user,data,env));
      }
      if (op==='admin-manufacturer') {
        requireThat(manager(user) && mode==='live',403,'Потрібен доступ до робочих налаштувань.');
        return json(await setManufacturer(db,user,data));
      }
      if (op==='admin-funds-transfer') {
        requireThat(user.role==='owner',403,'Перекази доступні лише власнику.');
        requireThat(uuid(data.requestId),400,'Повторіть переказ.');
        await db.transaction(async tx=>{
          await settings(tx,true);
          if (await transferFunds(tx,user,mode,data)) await audit(tx,user,'funds.transfer',data.requestId);
        });
        return json({ok:true});
      }
      if (op==='admin-product') {
        requireThat(manager(user) && mode==='live',403,'Публічний каталог редагується лише в робочому режимі.');
        return json(await setProduct(db,user,data,env));
      }
      if (op==='admin-collection') {
        requireThat(manager(user) && mode==='live',403,'Колекції редагуються лише в робочому режимі.');
        requireThat(collectionsSource.some(item=>item.id===data.id),404,'Колекцію не знайдено.');
        const notes = text(data.notes,1000);
        await db.query('INSERT INTO slx_collections VALUES ($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[data.id,JSON.stringify({notes})]);
        await audit(db,user,'collection.update',data.id);
        return json({notes});
      }
      if (op==='admin-referral') {
        requireThat(manager(user),403,'Недостатньо прав.');
        return json(await setReferral(db,user,mode,data));
      }
      if (op==='admin-notify') {
        requireThat(manager(user) && mode==='live',403,'Надсилання доступне команді у робочому режимі.');
        const config = await settings(db);
        requireThat(config.sales && readyForSale(config,await catalog(db),env),409,'Спочатку відкрийте продажі.');
        return json(await notifyLaunch(db,user,data.id,env,origin,fetcher));
      }
      if (op==='admin-settings' || op==='admin-staff') {
        requireThat(user.role==='owner' && mode==='live',403,'Зміни доступні власнику в робочому режимі.');
        return json(op==='admin-staff' ? await changeRole(db,user,data) : await updateSettings(db,user,data,env));
      }
      if (op==='admin-upload') {
        requireThat(manager(user) && mode==='live',403,'Завантаження доступне лише в робочому режимі.');
        const type = Object.hasOwn(fileTypes,data.extension) && fileTypes[data.extension];
        requireThat(type && typeof data.base64==='string' && /^[A-Za-z0-9+/]+={0,2}$/.test(data.base64),400,'Виберіть JPEG, PNG або WebP.');
        const bytes = Buffer.from(data.base64,'base64');
        requireThat(bytes.length>12 && bytes.length<=1400000 && type.check(bytes),400,'Зображення має бути до 1,4 МБ і відповідати формату.');
        const key = `${newId()}.${data.extension}`;
        await auth.upload(key,type.mime,bytes);
        await audit(db,user,'media.upload',key);
        return json({key},201);
      }
      throw new Failure(404,'Маршрут не знайдено.');
    } catch (error) {
      if (error instanceof Failure) return json({error:error.message},error.status);
      console.error('SLX commerce:',error.code ?? error.name);
      return json({error:'Тимчасово недоступно. Повторіть пізніше.'},['42P01','3F000','ECONNREFUSED'].includes(error.code) ? 503 : 500);
    }
  };
}
