# Security and privacy checks

Admin APIs validate the server-side session for every operation. Editor and Analyst routes use explicit allowlists. Session tokens are random and stored as hashes, expire after eight hours for staff, and use HttpOnly, SameSite=Lax and Secure on HTTPS. Logout and credential or role changes revoke sessions. Preview passwords use scrypt with unique salts. Production authentication remains with Supabase Auth.

Mutations require the same Origin and JSON. Auth and form submissions are rate limited. Queries bind inputs, and export neutralizes spreadsheet formula prefixes. Administrative HTML inserts text via DOM text nodes. Upload preflight checks size and file signatures and writes no data to Storage. Downloaded CSV and backups contain private data. Keep them on approved devices.

Session and role tests cover expired or revoked credentials, unauthenticated requests, cross-origin writes, preview isolation and role boundaries. A PostgreSQL connection pool with a privileged production credential remains an infrastructure risk if that credential is available in Preview environment settings, even when current code ignores it. Confirm Vercel scopes by variable name only. Rotate any credentials previously shared outside the vault after separate approval. Never log or paste connection strings or passwords.

For erasure before a notification is sent, verify the requester controls the address through the approved contact channel, then delete matching signup records in Subscribers. An unsubscribe link allows the recipient to withdraw or delete the matching signup. An audit entry records the action and actor ID without storing the subscriber email. Apply the approved retention policy to backups and any future provider records.
