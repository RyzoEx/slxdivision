# Fourthwall preview

Run `npm run preview:fourthwall` and open `http://127.0.0.1:4198/fourthwall-preview.html`. On Vercel, the page and API are available only for Preview builds of `codex/fourthwall`.

The default preview uses two test variants and SLX’s existing Blind Seraph artwork. Select a variant, add a quantity and use **Preview checkout route**. The generated URL is shown as text and uses `example.invalid` in fixture mode. The SLX endpoint never opens external checkout, writes a provider cart, takes payment or accesses PostgreSQL.

To read one existing listing, set all three values in the local environment or scope them to the `codex/fourthwall` Preview branch.

- `SLX_FOURTHWALL_STOREFRONT_TOKEN` is the shop’s Storefront API token.
- `SLX_FOURTHWALL_PRODUCT_SLUG` is the slug of the listing to load.
- `SLX_FOURTHWALL_CHECKOUT_HOST` is the shop’s Fourthwall hostname without a scheme or path.

The adapter reads the listing with `GET /v1/products/{slug}` and uses its available variant IDs to construct the documented `/cart/checkout` URL. The example still displays that URL as text when credentials are configured.

[Product API](https://docs.fourthwall.com/storefront/products) · [Checkout URL reference](https://docs.fourthwall.com/shop-apis/cart-checkout-endpoint)
