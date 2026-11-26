# SLX Division pre-launch checklist

## Preview and storefront

- [x] Serve the approved Heavy DAngels teaser as a 720 × 1280 MP4 with an independent poster. The player attaches the media URL after a user presses Play.
- [x] Publish only the supplied YouTube, Pinterest and TikTok links. Instagram and Telegram stay hidden until confirmed in `content/storefront.json`.
- [ ] Review the Vercel Preview for `codex/spreadshop` on a phone and desktop. Keep it out of search with `noindex`. Preview must use an isolated database or run without a database.
- [ ] Confirm rights to the teaser soundtrack and artwork for public commercial use.

## Notify Me

- [x] Verify successful requests persist in PostgreSQL with consent and a policy version. Requests missing consent, spam-field submissions and failed writes cannot show success.
- [ ] Before deploying the new form to production, run the additive database schema migration from `server/setup.mjs` against the approved target database. Verify Preview with a separate `SLX_PREVIEW_DATABASE_URL` if persistent test submissions are needed.
- [ ] Verify delivery and unsubscribe on the approved sender before dispatching real notifications. Existing entries without a recorded opt-in remain stored and are excluded from product launch mail. Newsletter entries are stored separately from product requests. Newsletter broadcasting needs its own tested workflow.

## Conditions for opening sales

- [ ] Obtain written confirmation of the account holder’s eligibility and payout availability for Ukraine from Spreadshop. Confirm the payout currency and method in Partner Area.
- [ ] Approve the real assortment and final GBP prices, product quality, seller information, delivery and returns.
- [ ] Verify the official widget, basket, checkout and support links end-to-end. Use the paid flow only after approval.
- [ ] With explicit launch approval, configure Spreadshop and deploy the isolated catalog frame. Set `SLX_FULFILLMENT=spreadshop` and the three documented Spreadshop release flags on the approved production project only. Verify the final deployment before opening sales. [Spreadshop runbook](SPREADSHOP.md)
- [ ] Keep `SLX_GA_STREAM_READY` unset until consent and privacy checks pass, Enhanced Measurement is reviewed, and DebugView shows events from the correct stream. Verify Spreadshop applies its own consent before enabling its Google tag. Treat checkout and cross-domain attribution as a separate verification.

## Rollback

1. For a broken preview, redeploy the last known-good branch commit or revert the affected commit on `codex/spreadshop`. Verify the recovered preview URL and leave `main` untouched.
2. If a future production launch needs to be reversed, remove the Spreadshop launch and GA4 flags, disable the standalone shop in Partner Area if it was opened, then redeploy the last approved COMING SOON build. An instant rollback to a previously approved deployment is an alternative when its configuration already matches the intended state.
3. Verify both the SLX and Spreadshop entry points, confirm that no checkout is accepting requests, and verify the analytics tag stays unloaded until the appropriate gates and consent are in place.
4. Keep the additive consent columns and existing records when rolling back application code. Avoid restoring a database snapshot over newer subscriber data.
