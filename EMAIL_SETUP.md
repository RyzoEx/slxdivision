# Email notifications

## Options

| Provider | Free limits | Sender and eligibility |
|---|---|---|
| Brevo | 300 sends/day, no card | Verified sender and a controlled sending domain for authentication. Confirm current onboarding eligibility before registration. |
| Resend | 100 transactional sends/day and 3,000/month | External delivery requires a verified domain. Its terms require age 18+. |
| Existing brand SMTP | Depends on mailbox and provider limits | Confirm terms, sender identity and SMTP authentication. Run a controlled single-address delivery test after approval. |

[Brevo Free](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans) · [Brevo domain setup](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC) · [Resend pricing](https://resend.com/pricing) · [Resend terms](https://resend.com/legal/terms-of-service)

The transport service is isolated in `server/launch-mail.mjs`. It supports an HTTPS webhook using `SLX_EVENT_WEBHOOK` and `SLX_EVENT_TOKEN`, or SMTP using `SLX_SMTP_USER` and `SLX_SMTP_PASSWORD`. Use server-only variables. Product launch delivery uses `SLX_UNSUBSCRIBE_SECRET` and is protected by the production sales checks and `SLX_LAUNCH_MAIL_APPROVED`. The existing queue claims product requests with row locks, tracks delivery status, and supplies a stable delivery id to the webhook or SMTP Message-ID. For a real provider, verify provider-side deduplication on retries.

In local admin under **Листи**, preview the English subscription confirmation, announcement, launch and unsubscribe confirmation. Dry run stores a deduplicated test job, with no outbound network request or data copied to a provider. The fixture renders the approved logo and Blind Seraph print. Collection-wide and confirmation sending are pending provider and consent verification. The live product transport already checks stored consent and an outstanding claim before dispatch.

Before sending, approve provider and sender together, verify domain authentication and delivery, confirm recipient ownership and audience consent, and run a one-address test including unsubscribe, erasure, retries and provider rejection. Keep mailing disabled until then.
