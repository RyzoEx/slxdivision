# Analytics validation and campaign naming

Keep `SLX_GA_STREAM_READY` unset on Vercel. For local validation use `SLX_GA_DEBUG=1`, run `npm run preview:admin`, and connect localhost in Google Tag Assistant. Verify default denial, explicit grant and withdrawal. `page_view`, `collection_view`, `artwork_view`, `social_click` and `teaser_play` were seen in DebugView in Phase 6. In Phase 7 `notify_me_conversion` appeared in DebugView after a successful local PostgreSQL submission with a `.test` address. It measures accepted submissions and can include retries, so use database aggregates for unique signup counts. The browser tests intercept Google and check that email and unapproved query parameters never enter the app event queue. A hosted signup check still requires a real Preview database.

| Channel | `utm_source` | `utm_medium` | `utm_campaign` | Example `utm_content` |
|---|---|---|---|---|
| Pinterest | `pinterest` | `social` | `drop001` | `pin` |
| TikTok | `tiktok` | `social` | `drop001` | `bio` |
| YouTube | `youtube` | `social` | `drop001` | `video` |
| Instagram | `instagram` | `social` | `drop001` | `bio` |
| Telegram | `telegram` | `social` | `drop001` | `drop001` |

Use public campaign IDs only. For example append `?utm_source=pinterest&utm_medium=social&utm_campaign=drop001&utm_content=pin`. Review session acquisition by campaign/source and compare `collection_view`, `artwork_view` and `notify_me_conversion` counts. Treat consented traffic as a measured subset. Check conversion against aggregate database counts without exporting emails into GA4.

The SLX Division web stream has Enhanced Measurement switched off. The connected Google tag had separate automatic detection enabled. History-driven page views, scrolls, outbound clicks, form interactions, video interactions and downloads were switched off there. Collection of user-provided data was also switched off.

The local browser tests passed for initial refusal, consent withdrawal, analytics cookie removal, campaign filtering for YouTube, TikTok and Pinterest, and removal of test email addresses from analytics payloads. The real collector returned HTTP 204 for local campaign tests. An earlier run still showed automatic scroll events after the settings were saved, and the latest local session did not appear in DebugView. Before activation, confirm one pageview per load, absence of unwanted automatic events in the collector, and receipt in DebugView from a clean Tag Assistant session. Leave `SLX_GA_STREAM_READY` unset until these checks pass and production activation is approved.

[Google DebugView](https://support.google.com/analytics/answer/7201382) · [Google pageview configuration](https://developers.google.com/analytics/devguides/collection/ga4/views)
