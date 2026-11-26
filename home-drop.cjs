const { escape, socialLinks } = require('./site-shell.cjs');

const artworkNames = new Map([
  ['blind-seraph-tee','Blind Seraph'], ['wirebound-skull-tee','Wirebound Skull'],
  ['chrome-oni-tee','Chrome Oni'], ['red-eclipse-oni-tee','Red Eclipse Oni'],
]);

module.exports = ({catalog,settings,teaser}) => {
  const pieces = catalog.activeProducts.filter(item=>artworkNames.has(item.id) && item.artwork);
  return `<section class="drop-hero" aria-labelledby="hero-title">
    <div class="shell drop-hero-inner">
      <div class="drop-hero-copy">
        <p class="drop-kicker"><span></span> DROP 001 <span class="drop-rule"></span> COMING SOON</p>
        <h1 id="hero-title">HEAVY<br>DANGELS</h1>
        <p class="drop-summary">Four original prints from the first SLX Division drop.</p>
        <a class="primary" href="#collection-preview" data-metric="drop_click">Explore the collection <span aria-hidden="true">↓</span></a>
      </div>
      <div class="drop-hero-mark"><img src="/assets/brand/logo.webp" width="1035" height="754" alt="" fetchpriority="high"></div>
    </div>
  </section>
  <section class="shell drop-collection" id="collection-preview" data-collection-event="heavy-dangels" aria-labelledby="drop-collection-title">
    <div class="drop-heading"><h2 id="drop-collection-title">Collection Preview</h2>${catalog.collections.some(item=>item.id==='heavy-dangels')
      ? '<a class="detail-link" href="collection-heavy-dangels.html">View DROP 001 <span aria-hidden="true">↗</span></a>' : ''}</div>
    <div class="drop-art-grid">${pieces.map(item=>{
      const art=item.artwork;
      const thumbnail=item.photos[0] ?? art;
      const name=artworkNames.get(item.id);
      return `<article class="drop-art">
        <a class="drop-art-link" href="/${escape(art.src)}" data-artwork="${escape(item.id)}" data-artwork-name="${escape(name)}" aria-label="Enlarge ${escape(name)} artwork">
          <div class="drop-art-image"><img src="/${escape(thumbnail.src)}" width="${thumbnail.width}" height="${thumbnail.height}" alt="${escape(art.alt)}" loading="lazy" decoding="async"><span aria-hidden="true">↗</span></div>
        </a>
        <div class="drop-art-caption"><h3><a href="product-${escape(item.id)}.html">${escape(name)}</a></h3><p>Coming soon</p></div>
      </article>`;
    }).join('')}</div>
  </section>
  ${teaser ? `<section class="shell drop-teaser"><h2>DROP 001 Teaser</h2>
    <video width="540" height="960" controls playsinline preload="none" aria-label="SLX Division drop teaser" data-teaser-play="heavy-dangels"><source src="/${escape(teaser)}" type="${teaser.endsWith('.webm') ? 'video/webm' : 'video/mp4'}"></video>
    <p>Press play to start the teaser. Use the player to control sound.</p></section>` : ''}
  <section class="shell drop-about" aria-labelledby="drop-about-title">
    <h2 id="drop-about-title">About SLX Division</h2><div><p>SLX Division is an independent Ukrainian streetwear label drawn to underground Y2K, old record sleeves and the sharp linework of cyber sigilism.</p><a class="detail-link" href="about.html">About the brand <span aria-hidden="true">↗</span></a></div>
  </section>
  <section class="shell drop-follow" aria-labelledby="drop-follow-title">
    <h2 id="drop-follow-title">FOLLOW THE DIVISION</h2><div class="drop-social">${socialLinks(settings)}</div>
  </section>`;
};
