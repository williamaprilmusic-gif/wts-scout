# WTS Scout — Production Setup

WTS Scout uses this production architecture:

```text
GitHub → Vercel → Neon Postgres → Vercel Blob → Vercel AI Gateway
```

## 1. Database — Neon Postgres

Provision a Neon database through the Vercel Marketplace and connect it to the `wts-scout` project for Production and Preview environments.

The repository contains the unified schema in:

```text
db/schema.sql
```

Apply that schema to the connected Neon database. It includes authentication users, workspaces, memberships, sessions and the scouting data tables.

Required variable:

```text
DATABASE_URL
```

The Neon database is server-side only. The browser never receives `DATABASE_URL`.

## 2. Authentication — WTS Scout application identity

WTS Scout uses database-backed application authentication rather than a browser-generated workspace ID.

The current system provides:

- Email/password signup and sign-in
- Salted `scrypt` password hashing
- Cryptographically random opaque session tokens
- SHA-256 token hashes stored in Neon
- `HttpOnly`, `SameSite=Lax` session cookies with `Secure` on Vercel
- Automatic workspace creation at signup
- Workspace membership records for authorization
- Server-derived workspace context for player, shortlist, notes, reports, AI and media APIs

No external hosted authentication project is required.

Before a large public launch, add email verification, password reset/recovery, login abuse/rate limiting, audit logs and a workspace invitation flow.

## 3. Media — Vercel Blob

Create a **private** Vercel Blob store and connect it to the `wts-scout` project.

The upload endpoint validates the authenticated user, workspace membership and player ownership before it issues a Blob upload token. Completed media metadata is stored in Neon.

Private media is never opened directly from the Blob URL. Authenticated reads go through `/api/media`, which verifies the signed-in user's workspace and player ownership before streaming the private Blob object.

For current Vercel Blob OIDC stores, connect the store to the project; Vercel supplies short-lived OIDC credentials and the connected store ID (`BLOB_STORE_ID`). Older/static-token stores can use `BLOB_READ_WRITE_TOKEN` instead.

## 4. AI — Vercel AI Gateway

Production scouting generation uses Vercel AI Gateway through its OpenAI-compatible Chat Completions endpoint. This provides a single managed integration and leaves model routing behind a server-side adapter.

Required variables:

```text
AI_GATEWAY_API_KEY
WTS_SCOUT_MODEL=google/gemini-2.5-flash-lite
```

On Vercel, a supported OIDC configuration may be used instead of a static gateway key.

## 5. Environment variables

Keep these values server-side in Vercel Project Settings:

```text
DATABASE_URL
BLOB_STORE_ID (OIDC Blob stores)
BLOB_READ_WRITE_TOKEN (legacy Blob stores only)
AI_GATEWAY_API_KEY (or supported Vercel OIDC)
WTS_SCOUT_MODEL
```

Do not place database, Blob or AI secrets in Vite `VITE_*` variables.

## 6. Deploy

The Git repository is connected to Vercel and `main` is configured to allow Git deployments.

Manual CLI equivalents:

```bash
vercel deploy
vercel deploy --prod
```

## 7. Health check

Use:

```text
/api/health
```

The endpoint checks database connectivity/schema readiness and reports whether Blob and Vercel AI Gateway are configured. It does not expose secret values.

## 8. Production checklist

- Neon database provisioned through Vercel Marketplace
- `db/schema.sql` applied successfully
- `DATABASE_URL` configured in Production and Preview
- Private Vercel Blob store connected
- Blob token/OIDC configured
- Vercel AI Gateway configured
- Real authentication enabled
- Workspace authorization enabled on all protected APIs
- GitHub CI production build passing
- Current `main` commit deployed to Vercel Production
- Preview auth, player creation, shortlist, notes, reports and media uploads tested before public launch
