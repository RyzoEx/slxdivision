import {collectionsSource,productsSource,audit} from './orders.mjs';
import {requireThat,text,emailAddress} from './security.mjs';
import partner from '../spreadshop/config.cjs';

const brandMedia=['assets/brand/logo.webp','assets/brand/heavy-dangels-teaser-poster.webp','assets/brand/heavy-dangels-teaser.mp4'];
const media = new Set([...brandMedia,...productsSource.flatMap(item=>[...item.photos.map(photo=>photo.src),item.artwork?.src]).filter(Boolean),
  ...collectionsSource.flatMap(item=>[item.cover?.src,...(item.lookbook ?? []).map(image=>image.src)]).filter(Boolean)]);
const website={id:'home',name:'SLX Division',description:'Independent Ukrainian streetwear.',email:'',hero:'HEAVY DANGELS',
  announcement:'COMING SOON',seoTitle:'Heavy DAngels · DROP 001 | SLX Division',seoDescription:'',teaser:true,sections:['collection','about','social']};
const seo={seoTitle:'',seoDescription:''};
const visibility={visible:true,order:0};
const sources={website:[website],collection:collectionsSource.map(item=>({id:item.id,slug:item.id,name:item.name,
  description:item.description ?? '',cover:item.cover?.src ?? '',status:item.archived?'archived':'coming-soon',launchDate:'',...visibility,...seo})),
product:productsSource.map(item=>({id:item.id,name:item.name,description:item.description ?? '',collection:item.collection,
  category:item.category,images:item.photos.map(photo=>photo.src),availability:item.status,...visibility,partnerId:'',partnerUrl:'',infoPrice:''}))};

export function mediaLibrary() {
  return [...media].map(path=>({path,kind:path.endsWith('.mp4')?'video':path.includes('poster')?'poster':path.includes('logo')?'logo':'image'}));
}

export function validateMedia(data) {
  const mime=data.mime;
  const imageLimits={'image/png':2_000_000,'image/jpeg':2_000_000,'image/webp':2_000_000};
  const limit=mime==='video/mp4'?3_250_000:Object.hasOwn(imageLimits,mime)?imageLimits[mime]:0;
  requireThat(limit && typeof data.base64==='string' && /^[a-z0-9+/]+={0,2}$/i.test(data.base64) && data.base64.length<=Math.ceil(limit/3)*4,
    400,'Перевірте формат і розмір файла.');
  const bytes=Buffer.from(data.base64,'base64');
  const ascii=(start,end)=>bytes.toString('ascii',start,end);
  const png=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && ascii(12,16)==='IHDR'
    && bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082','hex'));
  const jpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.at(-2)===255 && bytes.at(-1)===217;
  const webp=ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP' && ['VP8 ','VP8L','VP8X'].includes(ascii(12,16))
    && bytes.length>=20 && bytes.readUInt32LE(4)===bytes.length-8;
  const mp4=ascii(4,8)==='ftyp' && bytes.length>=24 && bytes.readUInt32BE(0)>=16
    && bytes.readUInt32BE(0)<=bytes.length && bytes.includes(Buffer.from('mdat')) && bytes.includes(Buffer.from('moov'));
  requireThat(bytes.length>16 && bytes.length<=limit && {'image/png':png,'image/jpeg':jpeg,'image/webp':webp,'video/mp4':mp4}[mime],400,'Вміст файла не відповідає формату.');
  return {mime,bytes:bytes.length,stored:false};
}

export async function drafts(db) {
  const {rows}=await db.query('SELECT kind,subject,data,updated_at FROM slx_editorial_drafts');
  const records=new Map(rows.map(row=>[`${row.kind}:${row.subject}`,row]));
  return Object.fromEntries(Object.entries(sources).map(([kind,items])=>[kind,items.map(source=>{
    const row=records.get(`${kind}:${source.id}`);
    return {...source,...row?.data,updatedAt:row?.updated_at ?? null};
  })]));
}

const picked=(value,options)=>{
  requireThat(options.includes(value),400,'Перевірте перелік значень.');return value;
};
const order=value=>{
  requireThat(Number.isInteger(value) && value>=0 && value<=9999,400,'Порядок має бути числом від 0 до 9999.');return value;
};
const bool=value=>{
  requireThat(typeof value==='boolean',400,'Перевірте видимість.');return value;
};
const asset=(value,optional=false)=>{
  requireThat(optional && value==='' || media.has(value) && !value.endsWith('.mp4'),400,'Виберіть матеріал із медіатеки.');return value;
};
const list=(values,validator,max)=>{
  requireThat(Array.isArray(values) && values.length<=max,400,'Перевірте список.');return [...new Set(values.map(validator))];
};
const url=value=>{
  if (!value) return '';
  let address;
  try { address=new URL(value); } catch {}
  requireThat(address?.origin===partner.shop.prefix && !address.username && !address.password && address.pathname!=='/',400,'Вкажіть посилання на товар SLX у Spreadshop.');
  return address.href;
};

export async function saveDraft(db,actor,input) {
  const {kind,id}=input;
  requireThat(Object.hasOwn(sources,kind) && sources[kind].some(item=>item.id===id),404,'Матеріал не знайдено.');
  const name=text(input.name,100,true), description=text(input.description,1000);
  const metadata={seoTitle:text(input.seoTitle,120),seoDescription:text(input.seoDescription,320)};
  let data;
  if (kind==='website') {
    data={name,description,...metadata,email:input.email ? emailAddress(input.email):'',hero:text(input.hero,90,true),
      announcement:text(input.announcement,150),teaser:bool(input.teaser),
      sections:list(input.sections,section=>picked(section,['collection','about','social']),3)};
  } else if (kind==='collection') {
    const slug=text(input.slug,65,true), launchDate=text(input.launchDate,10);
    requireThat(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && (!launchDate ||
      /^\d{4}-\d{2}-\d{2}$/.test(launchDate) && !Number.isNaN(Date.parse(launchDate)) && new Date(launchDate).toISOString().slice(0,10)===launchDate),400,'Перевірте slug і дату.');
    const {collection}=await drafts(db);
    requireThat(!collection.some(item=>item.id!==id && item.slug===slug),409,'Slug вже використовується.');
    data={name,description,...metadata,slug,launchDate,cover:asset(input.cover,true),order:order(input.order),visible:bool(input.visible),
      status:picked(input.status,['draft','coming-soon','published','archived'])};
  } else {
    const partnerId=text(input.partnerId,80), infoPrice=text(input.infoPrice,24);
    requireThat(/^[a-z0-9_-]*$/i.test(partnerId) && /^(?:£\s?\d{1,6}(?:\.\d{2})?)?$/.test(infoPrice),400,'Вкажіть ідентифікатор і ціну у GBP.');
    data={name,description,category:text(input.category,70,true),collection:picked(input.collection,collectionsSource.map(item=>item.id)),
      images:list(input.images,value=>asset(value),8),partnerId,partnerUrl:url(text(input.partnerUrl,350)),infoPrice,
      availability:picked(input.availability,['coming-soon','available','sold-out']),order:order(input.order),visible:bool(input.visible)};
  }
  await db.transaction(async tx=>{
    await tx.query(`INSERT INTO slx_editorial_drafts(kind,subject,data) VALUES ($1,$2,$3::jsonb)
      ON CONFLICT(kind,subject) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,[kind,id,JSON.stringify(data)]);
    await audit(tx,actor,'editorial.save',`${kind}:${id}`);
  });
  return data;
}
