import { requireThat, text } from './security.mjs';
import { audit, collectionsSource, productsSource, uuid } from './orders.mjs';
import defaults from '../content/storefront.json' with {type:'json'};

const socialHosts = {
  YouTube:['www.youtube.com','youtube.com'], Pinterest:['www.pinterest.com','pinterest.com'],
  TikTok:['www.tiktok.com','tiktok.com'], Instagram:['www.instagram.com','instagram.com'], Telegram:['t.me'],
};

export async function socialSettings(db) {
  const {rows:[row]} = await db.query('SELECT data FROM slx_store_content WHERE id=1');
  return row?.data ?? defaults.social;
}

export async function updateSocial(db,user,values) {
  const links = {};
  for (const [network,hosts] of Object.entries(socialHosts)) {
    const value = text(values[network],280);
    let url;
    try { if (value) url = new URL(value); } catch {}
    requireThat(!value || (url?.protocol==='https:' && hosts.includes(url.host) && !url.username && !url.password
      && url.pathname!=='/' && !url.search && !url.hash),400,`Некоректне посилання · ${network}`);
    links[network] = url?.href ?? '';
  }
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO slx_store_content VALUES (1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify(links)]);
    await audit(tx,user,'social.update','storefront');
  });
  return links;
}

export async function collectionSettings(db) {
  const {rows} = await db.query('SELECT id,data FROM slx_collections');
  const byId = new Map(rows.map(row=>[row.id,row.data]));
  return collectionsSource.map(({id,name,description,archived})=>{
    const saved = byId.get(id) ?? {};
    const designs = productsSource.filter(item=>item.collection===id).map(item=>({id:item.id,name:item.name}));
    return {id,name:saved.name ?? name,description:saved.description ?? description ?? '',archived:Boolean(archived),
      notes:saved.notes ?? '',release:saved.release ?? 'coming-soon',hidden:saved.hidden ?? [],designs,count:designs.length};
  });
}

export async function updateCollection(db,user,data) {
  const current = (await collectionSettings(db)).find(item=>item.id===data.id);
  requireThat(current,404,'Колекцію не знайдено.');
  const saved = {notes:text(data.notes,1000),name:text(data.name ?? current.name,100,true),
    description:text(data.description ?? current.description,1000),release:data.release ?? current.release,hidden:data.hidden ?? current.hidden};
  requireThat(['coming-soon','live'].includes(saved.release),400,'Некоректний статус колекції.');
  requireThat(Array.isArray(saved.hidden) && saved.hidden.length<=current.designs.length
    && saved.hidden.every(id=>current.designs.some(item=>item.id===id)),400,'Некоректний список дизайнів.');
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO slx_collections VALUES ($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[data.id,JSON.stringify(saved)]);
    await audit(tx,user,'collection.update',data.id);
  });
  return saved;
}

export async function subscriberSummary(db) {
  const [total,designs,activity] = await Promise.all([
    db.query(`SELECT COUNT(DISTINCT email) FILTER(WHERE product='newsletter')::int AS subscribers,
      COUNT(*) FILTER(WHERE product<>'newsletter')::int AS requests FROM slx_interests WHERE consent_at IS NOT NULL AND status<>'unsubscribed'`),
    db.query(`SELECT product,COUNT(*)::int AS count FROM slx_interests
      WHERE product<>'newsletter' AND consent_at IS NOT NULL AND status<>'unsubscribed' GROUP BY product ORDER BY count DESC,product LIMIT 12`),
    db.query(`SELECT action,created_at FROM slx_audit WHERE action IN ('admin.login','collection.update','social.update','interest.delete','interest.dispatch')
      ORDER BY created_at DESC,id DESC LIMIT 12`),
  ]);
  return {...total.rows[0],designs:designs.rows.map(row=>({...row,name:productsSource.find(item=>item.id===row.product)?.name ?? row.product})),activity:activity.rows};
}

const csvCell = value => {
  const field = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(field) ? `'${field}` : field;
  return `"${safe.replaceAll('"','""')}"`;
};

export async function subscribers(db,params,download=false) {
  const status = params.get('consent') || 'all';
  const scope = params.get('scope') || 'all';
  const query = text(params.get('q') ?? '',180).toLowerCase();
  const page = Number(params.get('page') ?? 1);
  requireThat(['all','active','withdrawn','legacy'].includes(status) && ['all','newsletter','product'].includes(scope)
    && Number.isInteger(page) && page>0 && page<=20000,400,'Перевірте фільтри.');
  const limit = download ? 10001 : 51;
  const {rows} = await db.query(`SELECT id,email,product,size,color,created_at,consent_at,consent_version,status FROM slx_interests
    WHERE ($1='' OR strpos(email,$1)>0)
      AND ($2='all' OR ($2='newsletter' AND product='newsletter') OR ($2='product' AND product<>'newsletter'))
      AND ($3='all' OR ($3='active' AND consent_at IS NOT NULL AND status<>'unsubscribed')
        OR ($3='withdrawn' AND status='unsubscribed') OR ($3='legacy' AND consent_at IS NULL AND status<>'unsubscribed'))
    ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`,[query,scope,status,limit,download?0:(page-1)*50]);
  if (!download) return {subscribers:rows.slice(0,50),page,more:rows.length===51};
  requireThat(rows.length<=10000,413,'Звузьте фільтри, щоб експортувати до 10 000 записів.');
  const columns = ['email','product','size','color','created_at','consent_at','consent_version','status'];
  return [columns.join(','),...rows.map(row=>columns.map(key=>csvCell(row[key])).join(','))].join('\r\n')+'\r\n';
}

export async function deleteSubscriber(db,user,id) {
  requireThat(uuid(id),400,'Некоректний ідентифікатор.');
  await db.transaction(async tx=>{
    const {rows} = await tx.query('DELETE FROM slx_interests WHERE id=$1 RETURNING id',[id]);
    requireThat(rows.length===1,404,'Заявку не знайдено.');
    await audit(tx,user,'interest.delete','subscriber');
  });
  return {ok:true};
}
