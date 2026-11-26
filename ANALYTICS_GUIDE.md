# Analytics validation and campaign naming

Keep `SLX_GA_STREAM_READY` unset on Vercel. For local validation use `SLX_GA_DEBUG=1`, run `npm run preview:admin`, and connect localhost in Google Tag Assistant. Verify default denial, explicit grant and withdrawal. `page_view`, `collection_view`, `artwork_view`, `social_click` and `teaser_play` were seen in DebugView in Phase 6. Phase 7 adds `notify_me_conversion` on a successful form response. It measures accepted submissions and can include retries, so use database aggregates for unique signup counts. The browser tests intercept Google and check that email and unapproved query parameters never enter the app event queue. Hosted signup conversion still requires a real Preview database and a property-side test.

| Channel | `utm_source` | `utm_medium` | `utm_campaign` | Example `utm_content` |
|---|---|---|---|---|
| Pinterest | `pinterest` | `social` | `drop001` | `pin` |
| TikTok | `tiktok` | `social` | `drop001` | `bio` |
| YouTube | `youtube` | `social` | `drop001` | `video` |
| Instagram | `instagram` | `social` | `drop001` | `bio` |
| Telegram | `telegram` | `social` | `drop001` | `drop001` |

Use public campaign IDs only. For example append `?utm_source=pinterest&utm_medium=social&utm_campaign=drop001&utm_content=pin`. Review session acquisition by campaign/source and compare `collection_view`, `artwork_view` and `notify_me_conversion` counts. Treat consented traffic as a measured subset. Check conversion against aggregate database counts without exporting emails into GA4.

Review Enhanced Measurement in the connected Web stream and recreate a clean Tag Assistant session. Earlier DebugView events included automatic `scroll` and outbound `click`. Before activation, confirm unwanted automatic events are disabled and one pageview arrives per load. [Google DebugView](https://support.google.com/analytics/answer/7201382) · [Google pageview configuration](https://developers.google.com/analytics/devguides/collection/ga4/views)
