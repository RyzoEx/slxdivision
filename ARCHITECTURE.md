# SLX architecture

- Vercel serves `dist/` from `build-frontend.cjs`. `content/catalog.json` and `content/storefront.json` are the approved source for indexable pages. Committed media stay under `assets/`.
- `/api/commerce` and `/admin` use the same server dispatcher. `server/schema.sql` creates the private PostgreSQL schema. Runtime APIs use parameterized queries. `server/security.mjs` handles server-side sessions, rate limits and input checks.
- Production uses existing PostgreSQL, Supabase Auth and optional Storage. The Phase 7 branch uses isolated Preview infrastructure and independent staff credentials. The local admin runner uses embedded PostgreSQL without loading production environment files.
- Administrative drafts are persisted separately. Collection `published` and product `available` values are editorial. They do not enable checkout, use partner prices, or change the Git release. The review step is to inspect drafts and promote approved values through a separate release.
- Notify Me distinguishes a product notification from marketing. Public content endpoints expose approved display data. Subscriber records and draft settings require server authorization.
- The external Spreadshop frame and Google tag are each gated. Partner URLs, real prices and stock come from the active partner catalogue when launch is approved.
