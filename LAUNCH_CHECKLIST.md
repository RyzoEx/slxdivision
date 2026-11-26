# SLX Division pre-launch checklist

## Preview and storefront

- [x] Serve the approved Heavy DAngels teaser as a 720 × 1280 MP4 with an independent poster. The player attaches the media URL after a user presses Play.
- [x] Publish only the supplied YouTube, Pinterest and TikTok links. Instagram and Telegram stay hidden until confirmed in `content/storefront.json`.
- [ ] Review the Vercel Preview for `codex/spreadshop` on a phone and desktop. Keep it out of search with `noindex`. Preview must use an isolated database or run without a database.
- [ ] Confirm rights to the teaser soundtrack and artwork for public commercial use.

## Notify Me

- [x] Hide product and newsletter signup controls for the pre-launch release with `launchSignup: false` in `content/storefront.json`. Re-enable after the target database has been migrated and real persistence verified in Preview.
- [x] Verify persistence, consent timestamp and policy version, rejection of missing consent and spam, and deduplication in local PostgreSQL integration tests.
- [x] Prepare `migrate-preview` and verify that it refuses missing Preview credentials and a Preview connection that targets the production Supabase project.
- [ ] Connect a dedicated Neon Free PostgreSQL project to Vercel Preview after verifying current enrollment eligibility. The two Supabase Free slots remain in service. [Phase 6 setup](BACKEND_PREVIEW.md)
- [ ] Verify a real Notify Me submission and stored consent row on the isolated Vercel deployment. The public share link remains pinned to `de6602e`.
- [x] Verify localhost signup with separate marketing consent, successful conversion event, and no email in the analytics event queue.
- [ ] Review the production data retention policy and verified erasure contact before enabling signup. Confirm Preview has only dedicated test infrastructure credentials.
- [ ] Before deploying the new form to production, run the additive database schema migration against the approved production database.
- [ ] Verify delivery and unsubscribe on the approved sender before dispatching real notifications. Existing entries without a recorded opt-in remain stored and are excluded from product launch mail. Newsletter entries are stored separately from product requests. Newsletter broadcasting needs its own tested workflow.

Follow the [Preview runbook](BACKEND_PREVIEW.md) for migration and branch-scoped configuration. Submit with a reserved `.test` address and explicit consent, then check Subscribers for one matching row with a consent timestamp and version. Verify deduplication and delete the test row after verification.

## Conditions for opening sales

- [ ] Obtain written confirmation of the account holder’s eligibility and payout availability for Ukraine from Spreadshop. Confirm the payout currency and method in Partner Area.
- [ ] Approve the real assortment and final GBP prices, product quality, seller information, delivery and returns.
- [ ] Verify the official widget, basket, checkout and support links end-to-end. Use the paid flow only after approval.
- [ ] Approve seller disclosures and partner responsibilities. Verify the legal contact, eligible owner, applicable return policy and customer support details.
- [ ] With explicit launch approval, configure Spreadshop and deploy the isolated catalog frame. Set `SLX_FULFILLMENT=spreadshop` and the three documented Spreadshop release flags on the approved production project only. Verify the final deployment before opening sales. [Spreadshop runbook](SPREADSHOP.md)
- [x] Verify all five SLX storefront events in GA4 DebugView through a connected localhost Tag Assistant session with consent.
- [ ] Keep `SLX_GA_STREAM_READY` unset. Review the automatic `scroll` and outbound `click` events observed in DebugView and finish privacy validation before approval. Verify Spreadshop applies its own consent before enabling its Google tag. Treat checkout and cross-domain attribution as a separate verification.

## Pre-launch release to production

- [x] Publish the approved `513d2ae` pre-launch release from `main`. Vercel tracks `main` for `slxdivision.vercel.app`.
- [ ] Keep Phase 6 in `codex/backend-infrastructure` until the hosted Preview checks and merge approval are complete.
- [ ] Keep direct order/payment, Spreadshop activation and GA4 flags unset. The pre-launch store can show the Spreadshop placeholder without loading the catalog frame.
- [x] Verify the current production pre-launch deploy shows COMING SOON with signup hidden, sales off, and no Spreadshop frame or Google tag.

## Rollback

1. For a broken preview, redeploy the last known-good branch commit or revert the affected commit on `codex/spreadshop`. Verify the recovered preview URL and leave `main` untouched.
2. If a future production launch needs to be reversed, remove the Spreadshop launch and GA4 flags, disable the standalone shop in Partner Area if it was opened, then redeploy the last approved COMING SOON build. An instant rollback to a previously approved deployment is an alternative when its configuration already matches the intended state.
3. Verify both the SLX and Spreadshop entry points, confirm that no checkout is accepting requests, and verify the analytics tag stays unloaded until the appropriate gates and consent are in place.
4. Keep the additive consent columns and existing records when rolling back application code. Avoid restoring a database snapshot over newer subscriber data.
