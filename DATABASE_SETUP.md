# PostgreSQL environments

## Isolation decision

Keep Preview on a dedicated database or the local admin runner. A second schema in the existing Supabase project would share the database engine, provider privileges, extensions, defaults, network policy, connection quota and backup scope. Supavisor can connect as a custom PostgreSQL role, but the present application uses one private schema and current production grants have not been reviewed. The project owner has not authorized role or project changes. Preview never receives a fallback connection to Supabase through the application.

- **Runtime role design** uses separate Preview and Production logins, each restricted to its own database and schema. Give the runtime role CONNECT, schema USAGE, table DML and required sequence USAGE. Migration ownership is separate. Runtime roles should have neither DDL ownership, role creation, schema creation, membership in provider admin roles, nor BYPASSRLS. Apply explicit policies compatible with the runtime role before moving production off its existing role.
- **Verification before any hosted switch** uses `current_user`, `current_database()`, grants, schema privileges, table privileges and membership checks. Demonstrate successful Preview DML against test records and denied access to protected fixtures in a disposable environment. A local isolation unit test checks that production URLs and wrong branches are rejected. It cannot establish what privileges a hosted account currently has.
- **TLS and pooling** use a dedicated Neon direct URL for migrations and pooled URL for Preview runtime. The driver requires a trusted certificate and matching hostname. The current Supabase adapter can use its configured CA. Changing project-wide SSL enforcement can affect running connections and requires separate approval. [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres) · [TLS](https://supabase.com/docs/guides/platform/ssl-enforcement) · [Neon Vercel](https://neon.com/docs/guides/vercel-overview)

## Migration and recovery

`npm test` applies the schema twice against a fresh database and checks the new roles. The local runner applies the same schema when starting. For a dedicated hosted Preview, provision `SLX_PREVIEW_DATABASE_URL` and run the Preview migration from [BACKEND_PREVIEW.md](BACKEND_PREVIEW.md). `admin-system` probes a migrated table and reports elapsed time.

With approved direct or session-pooler access and PostgreSQL client tools, put the trusted TLS settings in your connection URL or pg service file. Use a protected `PGPASSFILE` for passwords and avoid putting secrets in command history. Keep dumps out of Git and encrypt them at rest. Verify the archive before restoring to a separate empty database.

```powershell
pg_dump --dbname='service=slx_backup' --schema=slx_private --format=custom --no-owner --no-acl --file=slx-backup.dump
pg_restore --list slx-backup.dump
pg_restore --exit-on-error --no-owner --no-acl --dbname='service=slx_restore_sandbox' slx-backup.dump
```

Check record counts, data integrity, migration idempotence and an authenticated test read after restore. Rotate credentials and invalidate restored sessions before exposing a recovery environment. Never restore over current production without explicit approval and a reconciliation plan for newer records.
