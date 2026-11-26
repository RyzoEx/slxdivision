const fs = require('node:fs');
const path = require('node:path');

const own = (object, key) => Object.hasOwn(object, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const imagePath = /^assets\/(collections|products)\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_.-]*\.(avif|webp|png|jpe?g)$/;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function loadInventory(root = __dirname) {
  const issues = [];
  const images = new Set();
  function check(condition, field, message) {
    if (!condition) issues.push(`${field}: ${message}`);
    return condition;
  }
  function string(value, field, required = true, max = 1000) {
    if (!required && value === undefined) return;
    check(typeof value === 'string' && value.trim().length > 0 && value.length <= max,
      field, `use a non-empty string up to ${max} characters`);
  }
  function stringList(value, field) {
    if (value === undefined) return;
    if (!check(Array.isArray(value), field, 'use an array of strings')) return;
    for (const [index, entry] of value.entries()) string(entry, `${field}[${index}]`, true, 50);
    check(new Set(value).size === value.length, field, 'entries must be unique');
  }
  function checkImage(value, field) {
    if (!check(plain(value), field, 'use an object with src and alt')) return;
    string(value.alt, `${field}.alt`, true, 220);
    if (own(value, 'kind')) check(['photo', 'mockup', 'artwork'].includes(value.kind), `${field}.kind`, 'use photo, mockup, or artwork');
    if (value.kind === 'artwork' || own(value,'width') || own(value,'height')) {
      check([value.width,value.height].every(n=>Number.isSafeInteger(n) && n > 0),field,'use positive dimensions for both width and height');
    }
    if (!check(typeof value.src === 'string' && imagePath.test(value.src),
      `${field}.src`, 'use a lowercase photo path inside assets/collections or assets/products')) return;
    const file = path.join(root, value.src);
    try {
      if (!fs.statSync(file).isFile() || fs.realpathSync(file) !== file) throw new Error();
    } catch {
      issues.push(`${field}.src: photo not found at ${value.src} (check spelling and commit the file)`);
      return;
    }
    let directory = root;
    const exactCase = value.src.split('/').every(segment => {
      if (!fs.readdirSync(directory).includes(segment)) return false;
      directory = path.join(directory, segment);
      return true;
    });
    if (check(exactCase, `${field}.src`, 'photo filename must match the path exactly')) images.add(value.src);
  }
  function readEntries(value, field, validateEntry) {
    const entries = [];
    const ids = new Set();
    if (!check(Array.isArray(value), field, 'use an array')) return entries;
    for (const [index, entry] of value.entries()) {
      const where = `${field}[${index}]`;
      if (!check(plain(entry), where, 'use an object')) continue;
      const validId = check(typeof entry.id === 'string' && entry.id.length <= 65 && slug.test(entry.id),
        `${where}.id`, 'use a lowercase slug, for example drop-001');
      if (validId) {
        check(!ids.has(entry.id), `${where}.id`, `duplicate ID ${entry.id}`);
        ids.add(entry.id);
      }
      if (own(entry, 'published')) check(typeof entry.published === 'boolean', `${where}.published`, 'use true or false');
      if (entry.published === false) continue;
      string(entry.name, `${where}.name`, true, 100);
      validateEntry(entry, where);
      entries.push(entry);
    }
    return entries;
  }

  let source;
  try { source = JSON.parse(fs.readFileSync(path.join(root, 'content', 'catalog.json'), 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw new Error(`content/catalog.json: ${error.message}`); }
  if (!plain(source)) throw new Error('content/catalog.json: use an object with collections and products arrays.');

  const collections = readEntries(source.collections, 'collections', (entry, field) => {
    string(entry.description, `${field}.description`, false, 2000);
    if (own(entry, 'archived')) check(typeof entry.archived === 'boolean', `${field}.archived`, 'use true or false');
    if (entry.cover !== undefined) checkImage(entry.cover, `${field}.cover`);
    if (entry.lookbook !== undefined && check(Array.isArray(entry.lookbook), `${field}.lookbook`, 'use an array of photographs')) {
      for (const [index, image] of entry.lookbook.entries()) checkImage(image, `${field}.lookbook[${index}]`);
    }
  });
  const collectionIds = new Set(collections.map(collection => collection.id));
  const products = readEntries(source.products, 'products', (entry, field) => {
    check(collectionIds.has(entry.collection), `${field}.collection`, 'must match a published collection ID');
    string(entry.description, `${field}.description`, true, 3000);
    string(entry.category, `${field}.category`, true, 50);
    check(['coming-soon', 'available', 'sold-out'].includes(entry.status),
      `${field}.status`, 'use coming-soon, available, or sold-out');
    if (entry.price !== undefined) check(Number.isSafeInteger(entry.price) && entry.price > 0,
      `${field}.price`, 'use a positive whole amount in UAH');
    stringList(entry.sizes, `${field}.sizes`);
    stringList(entry.colors, `${field}.colors`);
    if (check(Array.isArray(entry.photos) && (entry.photos.length > 0 || entry.status==='coming-soon'),
      `${field}.photos`, 'add media for products outside pre-launch')) {
      for (const [index, photo] of entry.photos.entries()) checkImage(photo, `${field}.photos[${index}]`);
    }
    if (entry.artwork !== undefined) checkImage(entry.artwork,`${field}.artwork`);
    if (entry.specifications !== undefined && check(plain(entry.specifications), `${field}.specifications`, 'use an object with labels and values')) {
      for (const [label, value] of Object.entries(entry.specifications)) {
        string(label, `${field}.specifications label`, true, 60);
        string(value, `${field}.specifications.${label}`, true, 250);
      }
    }
    if (entry.orderUrl !== undefined) {
      let address;
      try { address = new URL(entry.orderUrl); } catch {}
      check(typeof entry.orderUrl === 'string' && address?.protocol === 'https:' && !address.username && !address.password,
        `${field}.orderUrl`, 'use an HTTPS checkout URL without credentials');
      check(entry.status === 'available' && Number.isSafeInteger(entry.price) && entry.price > 0,
        `${field}.orderUrl`, 'set an available status and a confirmed price before adding a checkout link');
    }
  });
  if (issues.length) throw new Error(`content/catalog.json\n- ${issues.join('\n- ')}`);
  const activeIds = new Set(collections.filter(collection => !collection.archived).map(collection => collection.id));
  return { collections, products, activeProducts: products.filter(item => activeIds.has(item.collection)), images: [...images] };
}

if (require.main === module) {
  try {
    const { collections, products } = loadInventory(fs.realpathSync(__dirname));
    console.log(`Catalog valid: ${collections.length} collections, ${products.length} products.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { loadInventory };
