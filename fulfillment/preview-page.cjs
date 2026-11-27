module.exports = {
  title:'Fourthwall preview',
  desc:'SLX Division test storefront and checkout preview.',
  noindex:true,
  analytics:false,
  script:'fourthwall-preview.js',
  content:`<section class="shell story-grid" data-fourthwall-preview>
    <article>
      <img src="/assets/collections/heavy-dangels/blind-seraph.webp" alt="Original Blind Seraph artwork" width="320" height="400">
      <h2 data-product-name>Blind Seraph Tee</h2>
      <p data-catalog-source>Loading preview catalog…</p>
      <form data-add-item><label>Variant <select name="variant" required disabled></select></label>
        <label>Quantity <input name="quantity" type="number" min="1" max="5" value="1" required></label>
        <button class="primary" type="submit" disabled>Add to test cart</button>
      </form>
    </article>
    <article>
      <h2>Test cart</h2><p data-cart-line>Your test cart is empty.</p>
      <button class="secondary" type="button" data-remove-item disabled>Remove item</button>
      <button class="primary" type="button" data-preview-checkout disabled>Preview checkout route</button>
      <p data-fourthwall-status role="status"></p>
      <p>The checkout destination is displayed for testing. The preview does not open checkout or accept payment.</p>
    </article></section>`,
};
