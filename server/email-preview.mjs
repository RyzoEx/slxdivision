import {audit} from './orders.mjs';
import {requireThat} from './security.mjs';

const templates={
  subscription:['Subscription confirmed','Your interest in SLX has been recorded.','View the collection'],
  announcement:['Heavy DAngels collection','Four original designs from DROP 001. Explore the artwork and release notes.','Explore Heavy DAngels'],
  launch:['DROP 001 has launched','Heavy DAngels is available. Check the official shop for availability and prices.','View DROP 001'],
  unsubscribe:['Subscription ended','Your previous request will no longer receive updates.','Back to SLX'],
};

export async function emailPreview(db,origin) {
  const {rows}=await db.query('SELECT template,state,checked_at FROM slx_mail_previews ORDER BY checked_at DESC');
  return {templates:Object.entries(templates).map(([id,[title,copy,cta]])=>({id,title,copy,cta})),history:rows,
    assets:{logo:`${origin}/assets/brand/logo.webp`,artwork:`${origin}/assets/collections/heavy-dangels/blind-seraph-preview.webp`}};
}

export async function dryRun(db,user,id) {
  requireThat(Object.hasOwn(templates,id),400,'Невідомий шаблон.');
  return db.transaction(async tx=>{
    const {rows}=await tx.query("INSERT INTO slx_mail_previews(template,state) VALUES ($1,'simulated') ON CONFLICT DO NOTHING RETURNING state",[id]);
    if (rows.length) await audit(tx,user,'mail.simulated',id);
    return {simulated:true,duplicate:rows.length===0};
  });
}

export function emailHtml(mail,assets,links) {
  const encode=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${encode(mail.title)}</title>
  <body style="margin:0;background:#0a0a0a;color:#f6f6f6;font:16px/1.5 Arial,sans-serif"><main style="max-width:560px;margin:auto;padding:24px">
  <img src="${encode(assets.logo)}" alt="SLX Division" width="115" style="height:auto"><p style="color:#bfbfbf">SLX DIVISION · HEAVY DANGELS</p>
  <h1>${encode(mail.title)}</h1><p>${encode(mail.copy)}</p><img src="${encode(assets.artwork)}" width="420" alt="Blind Seraph artwork" style="display:block;width:100%;max-width:420px;height:auto">
  <p><a style="color:#f6f6f6" href="${encode(links.collection)}">${encode(mail.cta)}</a></p><p><a style="color:#bfbfbf" href="${encode(links.unsubscribe)}">Manage subscription</a></p></main></body></html>`;
}
