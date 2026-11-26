const http = require('node:http');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { shop, launchApproved } = require('./config.cjs');

const loader = readFileSync(path.join(__dirname,'loader.js'),'utf8');
const styles = readFileSync(path.join(__dirname,'widget.css'),'utf8');
const provider = [
  'https://*.myspreadshop.net','https://*.myspreadshop.co.uk','https://*.spreadshop.net',
  'https://*.spreadshirt.net','https://*.spreadshirt.com','https://*.spreadshirt.co.uk','https://*.spreadshirtmedia.net',
].join(' ');

function frameAssets(parentOrigin, preview) {
  const policy = `default-src 'none'; script-src 'self' ${provider}; style-src 'self' 'unsafe-inline' ${provider}; img-src data: blob: ${provider}; font-src data: ${provider}; connect-src ${provider}; frame-src ${provider}; form-action ${provider}; base-uri 'none'`;
  return {
    policy:`${policy}; frame-ancestors ${parentOrigin}`,
    html:`<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex"><meta http-equiv="Content-Security-Policy" content="${policy}">
    <title>Каталог SLX · Spreadshop</title><link rel="stylesheet" href="/widget.css"><script defer src="/loader.js"></script></head>
    <body><main id="spreadshop-mount" data-shop-id="${shop.id}" data-shop-prefix="${shop.prefix}" data-shop-script="${shop.script}"
      data-shop-locale="${shop.locale}" data-parent-origin="${parentOrigin}"><p id="spreadshop-message" role="status">Завантажуємо каталог Spreadshop…</p></main>
    ${preview ? '<p class="widget-note">Локальне превʼю · Оформлення вимкнене</p>' : ''}</body></html>`,
  };
}

function startPreviewFrame(parentPort,port) {
  const parentOrigin = `http://127.0.0.1:${parentPort}`;
  const {policy,html}=frameAssets(parentOrigin,true);
  return http.createServer((req,res) => {
    const files = {
      '/': ['text/html; charset=utf-8',html],
      '/widget.css':['text/css; charset=utf-8',styles],
      '/loader.js':['text/javascript; charset=utf-8',loader],
    };
    const selected=files[req.url];
    if (!selected || !['GET','HEAD'].includes(req.method)) { res.writeHead(404).end(); return; }
    res.writeHead(200,{
      'Content-Type':selected[0],'Content-Security-Policy':policy,'X-Robots-Tag':'noindex','Cache-Control':'no-store',
    });
    res.end(req.method==='HEAD' ? undefined : selected[1]);
  }).listen(port,'127.0.0.1');
}

function buildFrame(env) {
  if (!launchApproved(env)) throw new Error('Spreadshop frame publication requires launch, payout and eligibility confirmation.');
  const parentOrigin='https://slxdivision.vercel.app';
  const output=path.join(__dirname,'frame-dist');
  const {html}=frameAssets(parentOrigin,false);
  mkdirSync(output,{recursive:true});
  writeFileSync(path.join(output,'index.html'),html);
  writeFileSync(path.join(output,'widget.css'),styles);
  writeFileSync(path.join(output,'loader.js'),loader);
}

if (require.main === module) buildFrame(process.env);

module.exports = {startPreviewFrame,frameAssets};
