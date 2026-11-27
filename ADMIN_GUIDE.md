# Local administration

The SLX Management Console uses the existing Manrope typeface with IBM Plex Mono for navigation groups and timestamps. The graphite surfaces, silver controls and red active marker are scoped to `/admin`. The sidebar collapses on desktop and opens as a drawer on mobile. Use `Ctrl+K` or `⌘K` to search sections available to your role. Press `Esc` to close drawers and previews.

In PowerShell 7, run from the repository. Choose a unique password between 20 and 128 characters and keep it in your password manager.

```powershell
npm ci
$env:SLX_LOCAL_ADMIN_PASSWORD = Read-Host 'Local admin password' -MaskInput
try { npm run preview:admin }
finally { Remove-Item Env:SLX_LOCAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
```

Open `http://127.0.0.1:4173/admin` and sign in as `owner@slx.test`. The server listens only on loopback. Restart with the password variable to rotate the password and revoke sessions. Subsequent starts can omit the variable after provisioning. The ignored `.slx-local-db/` stores only local test data. Do not copy production data into it.

- **Overview** shows order status, editorial collection state, aggregate consent metrics, UTC signup trends and recent administrative actions.
- **Subscribers** uses UTC date filters and date sorting. Use the confirmation dialog to erase a record after verifying the request. CSV contains private data and must stay internal.
- **Collections, Designs, Website** save and preview drafts. Commit approved public content through the usual release process. Partner price and availability fields are references for editors.
- **Media** lists existing assets and validates a file in memory. The upload storage path requires separate approval.
- **Email** renders four templates and records a deduplicated simulated job per template. No provider receives data during dry runs.
- **System** reports configuration and a DB probe. An enabled integration flag is a configuration signal and does not prove upstream availability.

Owner manages all modules. Editor manages content, social links and media. Analyst sees aggregate Overview and System. Existing Manager and Operator roles remain available for operations. Provision non-production staff following [BACKEND_PREVIEW.md](BACKEND_PREVIEW.md).
