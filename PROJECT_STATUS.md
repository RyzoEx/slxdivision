# Phase 7 status

| Component | Status | Dependencies | External blocker | Next action |
|---|---|---|---|---|
| Pre-launch storefront | Branch build | Vercel Preview | No production approval | Verify Preview and retain COMING SOON |
| Admin and roles | Local tests and screenshots | PGlite or dedicated PostgreSQL | Hosted database | Run signed-in Preview workflow when provisioned |
| Notify Me | Local persisted flow | PostgreSQL and consent | Hosted database | Verify hosted `.test` submission and erasure |
| Drafts and assets | Local preview and validators | Git assets and drafts | Approved storage for uploads | Keep uploads disabled and promote approved drafts through a release |
| Email | HTML preview and dry run | Approved sender and transport | Provider/domain/eligibility | Validate opt-in and test delivery before enabling any sender |
| Analytics | Consent and conversion browser tests | GA4 property and Tag Assistant | Production approval and stream review | Confirm hosted conversion and Enhanced Measurement |
| Spreadshop | Pre-launch UI and integration code | Partner activation and checkout | Eligibility, payout, terms and approval | Test real catalogue only once approved |
| Legal | Pre-launch policy pages | Verified business and partner details | Seller details and retention review | Approve disclosures before opening sales |

## Validation

- The local browser suite covers 360, 390, 768, 1024, 1440 and 1920 px on the storefront and 390/1440 px on the Phase 7 admin modules. It uses `.test` data only.
- Mobile Lighthouse against a local production-style build reported 100 performance, accessibility, best practices and SEO, LCP 0.9 s, CLS 0.01 and TBT 0 ms. This is a lab run. There is no field INP result.
- Project-level Vercel settings showed production secrets scoped to Production and legacy Preview keys scoped to `codex/phase-02`. The Phase 7 branch should keep its dedicated credentials branch-scoped when they are provisioned.

Commercial launch remains blocked by hosted infrastructure, owner eligibility, cross-provider checkout and support verification, approved seller and privacy details, sender verification, and an explicit release decision. No production release is part of Phase 7.
