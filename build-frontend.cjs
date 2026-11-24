const {
  copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  realpathSync, rmSync, writeFileSync,
} = require('node:fs');
const path = require('node:path');
const { header, footer, escape } = require('./site-shell.cjs');
const editorial = require('./editorial-pages.cjs');
const { loadInventory } = require('./inventory.cjs');
const { grid, inventoryPages } = require('./inventory-pages.cjs');

const root = realpathSync(__dirname);
let catalog;
try { catalog = loadInventory(root); }
catch (error) {
  console.error(error.message);
  process.exit(1);
}
const localPages = process.argv.includes('--local-pages');
const output = localPages ? root : path.join(root, 'dist');
const vercelEnvironment = process.env.VERCEL_ENV;
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const preview = localPages || (vercelEnvironment && vercelEnvironment !== 'production');
const requestedOrigin = !preview && (process.env.SLX_SITE_URL
  || (vercelEnvironment === 'production' && vercelHost ? `https://${vercelHost}` : ''));
const address = requestedOrigin ? new URL(requestedOrigin) : null;
if (address && (address.protocol !== 'https:' || address.username || address.password
  || address.pathname !== '/' || address.search || address.hash)) {
  throw new Error('SLX_SITE_URL must be an HTTPS origin without a path, credentials, query, or fragment.');
}
const origin = address?.origin ?? '';
const writePage = (name, body) => writeFileSync(path.join(output, name), body);
const email = process.env.SLX_CONTACT_EMAIL ?? '';
const settings = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
  instagram: process.env.SLX_INSTAGRAM_URL,
  tiktok: process.env.SLX_TIKTOK_URL,
  telegram: process.env.SLX_TELEGRAM_URL,
};
const liveSubscriptions = origin && process.env.SLX_SUBSCRIBE_WEBHOOK
  ? '<meta name="slx-subscription" content="live">' : '';

if (!localPages) {
  if (existsSync(output)) {
    const info = lstatSync(output);
    if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(output) !== output) {
      throw new Error('Expected dist to be a regular directory inside the project.');
    }
    rmSync(output, { recursive: true });
  }
  mkdirSync(output);
  for (const file of ['style.css', 'intro-start.js', 'metrics.js', 'experience.js', 'metrics.html', '404.html', 'storefront.js', 'catalog-ui.js']) {
    copyFileSync(path.join(root, file), path.join(output, file));
  }
  for (const group of ['brand', 'fonts']) {
    const source = path.join(root, 'assets', group);
    const destination = path.join(output, 'assets', group);
    if (realpathSync(source) !== source) throw new Error(`Unexpected asset directory: ${group}`);
    mkdirSync(destination, { recursive: true });
    for (const asset of readdirSync(source, { withFileTypes: true })) {
      if (asset.isFile() && /\.(webp|jpg|woff2|txt)$/.test(asset.name)) {
        copyFileSync(path.join(source, asset.name), path.join(destination, asset.name));
      }
    }
  }
  for (const asset of catalog.images) {
    const destination = path.join(output, asset);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(root, asset), destination);
  }
}
const url = file => origin ? `${origin}/${file}` : file;
const searchIndex = catalog.activeProducts.map(({ id, name, category, status }) => ({ id, name, category, status }));
writePage('catalog-index.js', `window.SLX_CATALOG = ${JSON.stringify(searchIndex)};\n`);

const homeCanonical = origin
  ? `  <link rel="canonical" href="${origin}/">\n  <meta property="og:url" content="${origin}/">\n`
  : '  <meta name="robots" content="noindex">\n';
const home = readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/  <!-- SEO origin start -->[\s\S]*?  <!-- SEO origin end -->/, () =>
    `  <!-- SEO origin start -->\n${homeCanonical}  <meta property="og:image" content="${url('assets/brand/logo.webp')}">\n${liveSubscriptions ? `  ${liveSubscriptions}\n` : ''}  <!-- SEO origin end -->`)
  .replace(/<!-- SITE HEADER START -->[\s\S]*?<!-- SITE HEADER END -->/, () => `<!-- SITE HEADER START -->\n${header(true)}\n<!-- SITE HEADER END -->`)
  .replace(/<!-- SITE FOOTER START -->[\s\S]*?<!-- SITE FOOTER END -->/, () => `<!-- SITE FOOTER START -->\n${footer(settings)}\n<!-- SITE FOOTER END -->`)
  .replace(/<!-- SITE INVENTORY START -->[\s\S]*?<!-- SITE INVENTORY END -->/, () => {
    const content = catalog.activeProducts.length
      ? `<h2 class="shell related-title">Одяг SLX</h2>${grid(catalog.activeProducts.slice(0, 4))}`
      : '<section class="shell empty-home"><h2>Пока одягу нема</h2></section>';
    return `<!-- SITE INVENTORY START -->\n${content}\n<!-- SITE INVENTORY END -->`;
  });
writePage('index.html', home);

const pages = { ...editorial({ settings, catalog }), ...inventoryPages(catalog, origin) };

for (const [file, page] of Object.entries(pages)) {
  writePage(file, `<!doctype html>
<html lang="uk">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(page.title)} | SLX</title><meta name="description" content="${escape(page.desc)}">
${origin ? `<link rel="canonical" href="${url(file)}">` : '<meta name="robots" content="noindex">'}
${liveSubscriptions}
<meta property="og:title" content="${escape(page.title)} | SLX">
<meta property="og:description" content="${escape(page.desc)}">
<meta property="og:image" content="${escape(url(page.image?.src ?? 'assets/brand/logo.webp'))}">
${page.structured ? `<script type="application/ld+json">${JSON.stringify(page.structured).replace(/</g, '\\u003c')}</script>` : ''}
<link rel="stylesheet" href="style.css"><link rel="icon" href="assets/brand/logo.webp">
<script src="catalog-index.js" defer></script><script src="metrics.js" defer></script><script src="storefront.js" defer></script><script src="catalog-ui.js" defer></script>
</head>
<body id="top" class="editorial-page">
${header()}
<main><div class="shell page-title"><h1>${escape(page.title)}</h1></div>${page.content}</main>
${footer(settings)}
</body></html>`);
}


if (origin) {
  const files = ['', ...Object.keys(pages)];
  writePage('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map(file => `  <url><loc>${url(file)}</loc></url>`).join('\n')}\n</urlset>\n`);
  writePage('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${url('sitemap.xml')}\n`);
}
