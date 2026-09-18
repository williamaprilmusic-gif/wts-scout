# WTS Scout

WTS Scout is a football talent-discovery and scouting workspace for players, scouts, clubs and academies.

## Architecture 0.4

```text
GitHub
  ↓
Vercel
  ├── Vite frontend
  └── Vercel Functions /api
        ├── Neon Postgres → users, workspaces, players, shortlists, notes, reports, media metadata
        ├── Vercel Blob → private player images, video, audio and documents
        └── Vercel AI Gateway + AI SDK → scouting intelligence
```

Vercel Functions are the server boundary. Browser code does not supply or select its own workspace for protected data. Neon is the relational source of truth; Blob is the object store; AI SDK routes scouting generation through Vercel AI Gateway.

## Authentication and authorization

WTS Scout now has application-level email/password authentication backed by Neon:

- Passwords are stored as salted `scrypt` hashes, never plaintext.
- Sessions use cryptographically random opaque tokens; only SHA-256 token hashes are stored in Neon.
- Sessions are delivered in an `HttpOnly`, `SameSite=Lax` cookie and use `Secure` on Vercel.
- Signup creates a personal workspace and an owner membership.
- Protected player, shortlist, scouting-note, scouting-report, AI and Blob endpoints derive the workspace from the authenticated session.
- Browser-provided `workspaceId` values and workspace headers are no longer trusted by protected APIs.

This gives WTS Scout a real application identity layer using the built-in application authentication service.

## What changed

- Removed the legacy external authentication/database SDK and its environment requirements.
- Added Neon Postgres service boundary and unified schema at `db/schema.sql`.
- Added `api/auth.js` plus `api/_lib/auth.js` for signup, sign-in, sign-out and session validation.
- Added Vercel Functions for players, shortlists, scouting notes and reports with workspace authorization.
- Added authenticated Vercel Blob client-upload handling for large player media.
- Protected the AI scouting endpoint and verify the player belongs to the authenticated workspace.
- Added `/api/health` to validate the Neon connection and report Blob/AI configuration state.
- Kept demo player data as a UI fallback when a backend request is unavailable; demo rows are clearly local-only and cannot be persisted as real records.
- Added GitHub Actions CI for production builds.

## Provision the services

1. Create/install a **Neon** database integration in the Vercel project and make `DATABASE_URL` available to Production/Preview.
2. Create a **private Vercel Blob** store connected to the project; current Vercel Blob setups can use OIDC plus the connected store ID, while legacy token stores use `BLOB_READ_WRITE_TOKEN`.
3. Run `db/schema.sql` against Neon. This includes both the application data schema and authentication tables.
4. Enable Vercel AI Gateway; use the supported Vercel OIDC flow on Vercel or `AI_GATEWAY_API_KEY` where a persistent key is required.
5. Redeploy `main`.

Never commit real secrets. `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` and `AI_GATEWAY_API_KEY` are server-side values and must stay in Vercel environment variables.

## Local development

```bash
npm install
npm run dev
```

Without backend services, the UI can still load its demo player dataset. Real signup/sign-in and persistent scouting data require Neon to be provisioned and its environment variables to be present.

## Production security roadmap

Before opening WTS Scout to a large public user base, add email verification, password reset/recovery, login abuse/rate limiting, session revocation UI, workspace invitations, and audit logging. The current authorization model is already server-side and workspace-scoped; these controls are the next security layer rather than a replacement for the current access boundary.

See `SETUP.md` for the infrastructure setup checklist and Vercel commands.
