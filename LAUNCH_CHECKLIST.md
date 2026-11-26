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
- [ ] Connect separate Supabase Free PostgreSQL to Vercel Preview. Supabase blocked project creation because both active Free slots were in use across the account’s organizations. Resume when an authorized owner confirms a free slot is available. The linked production project and unrelated projects stay in service.
- [ ] Verify a real Notify Me submission and stored consent row on the isolated Vercel deployment. The public share link remains pinned to `de6602e`.
- [ ] Before deploying the new form to production, run the additive database schema migration against the approved production database.
- [ ] Verify delivery and unsubscribe on the approved sender before dispatching real notifications. Existing entries without a recorded opt-in remain stored and are excluded from product launch mail. Newsletter entries are stored separately from product requests. Newsletter broadcasting needs its own tested workflow.

To resume Preview setup, keep the existing `SLX_DATABASE_URL` in the local ignored `.env.local` for the isolation check, add the isolated `SLX_PREVIEW_DATABASE_URL` with TLS hostname verification, and run `node --env-file=.env.local server/setup.mjs migrate-preview`. Configure the verified Preview pooler URL and its trusted CA under `SLX_PREVIEW_DATABASE_URL` and `SLX_DATABASE_CA_BASE64` in Vercel’s Preview environment for `codex/spreadshop` only. Deploy the branch preview. Submit with a controlled test address and explicit consent, then check `slx_private.slx_interests` for one matching row with `consent_at` and `consent_version`. Confirm a second submission leaves one row. Remove the test row after verification.

## Conditions for opening sales

- [ ] Obtain written confirmation of the account holder’s eligibility and payout availability for Ukraine from Spreadshop. Confirm the payout currency and method in Partner Area.
- [ ] Approve the real assortment and final GBP prices, product quality, seller information, delivery and returns.
- [ ] Verify the official widget, basket, checkout and support links end-to-end. Use the paid flow only after approval.
- [ ] With explicit launch approval, configure Spreadshop and deploy the isolated catalog frame. Set `SLX_FULFILLMENT=spreadshop` and the three documented Spreadshop release flags on the approved production project only. Verify the final deployment before opening sales. [Spreadshop runbook](SPREADSHOP.md)
- [ ] Keep `SLX_GA_STREAM_READY` unset until consent and privacy checks pass, Enhanced Measurement is reviewed, and DebugView shows events from the correct stream. Verify Spreadshop applies its own consent before enabling its Google tag. Treat checkout and cross-domain attribution as a separate verification.

## Pre-launch release to production

- [ ] Wait for explicit approval before merging `codex/spreadshop` into `main`. Vercel tracks `main` for `slxdivision.vercel.app`.
- [ ] Keep direct order/payment, Spreadshop activation and GA4 flags unset. The pre-launch store can show the Spreadshop placeholder without loading the catalog frame.
- [ ] Once Vercel reports the approved deployment Ready, check COMING SOON, the collection and product pages, the missing signup controls, and the absence of a checkout, Spreadshop frame and Google tag.

## Rollback

1. For a broken preview, redeploy the last known-good branch commit or revert the affected commit on `codex/spreadshop`. Verify the recovered preview URL and leave `main` untouched.
2. If a future production launch needs to be reversed, remove the Spreadshop launch and GA4 flags, disable the standalone shop in Partner Area if it was opened, then redeploy the last approved COMING SOON build. An instant rollback to a previously approved deployment is an alternative when its configuration already matches the intended state.
3. Verify both the SLX and Spreadshop entry points, confirm that no checkout is accepting requests, and verify the analytics tag stays unloaded until the appropriate gates and consent are in place.
4. Keep the additive consent columns and existing records when rolling back application code. Avoid restoring a database snapshot over newer subscriber data.
