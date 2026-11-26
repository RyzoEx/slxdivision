# Deployment

1. Run `npm ci`, `npm test`, `npm run test:e2e` and `npm run build`. Desktop and mobile screenshots can be saved with `SLX_TEST_SCREENSHOTS`.
2. Push `codex/backend-infrastructure`. Confirm the corresponding Vercel build is Ready and targets Preview. Use its deployment URL. Changing the existing public share URL requires separate approval.
3. Check noindex and COMING SOON across the homepage and shop, production sales off, Spreadshop iframe absent and Google tag absent. A database-free preview should keep signup controls hidden while the public pages still load.
4. If an isolated database is approved, follow the branch-scoped instructions in [BACKEND_PREVIEW.md](BACKEND_PREVIEW.md). Only reserved `.test` addresses are accepted by the Preview signup service.
5. Main, Production variables and Production aliases require explicit approval. For Preview rollback redeploy a known-good branch build. For a production rollback obtain approval and use the previous approved Vercel deployment, keeping additive migrations and current subscriber records intact. [Vercel environments](https://vercel.com/docs/deployments/environments)
