# WTS Scout — Infrastructure Setup

WTS Scout uses this production architecture:

```text
GitHub → Vercel → Neon Postgres → Vercel Blob → Vercel AI Gateway
```

## 1. Database — Neon Postgres

Provision a Neon database through the Vercel Marketplace and connect it to the `wts-scout` project for Production and Preview environments.

Vercel CLI example:

```bash
vercel install neon --name wts-scout-db --plan free -e production -e preview
```

Then run `db/schema.sql` against the provisioned database.

Required variable:

```text
DATABASE_URL
```

## 2. Media — Vercel Blob

Create a Vercel Blob store and connect it to the `wts-scout` project. The upload endpoint uses the Vercel Blob client upload flow and records completed media metadata in Neon.

Required variable for token-based Blob stores:

```text
BLOB_READ_WRITE_TOKEN
```

Newer Blob setups may use Vercel OIDC instead of a static token.

## 3. AI — Vercel AI Gateway

Create/configure an AI Gateway API key for the project.

Required variable:

```text
AI_GATEWAY_API_KEY
```

Optional model override:

```text
WTS_SCOUT_MODEL=openai/gpt-5.4
```

The model receives supplied player data and a recruitment brief. The server prompt explicitly prevents invented statistics and treats fit scoring as internal screening aid rather than a career prediction.

## 4. Authentication

The current UI uses a local workspace identity so the app can operate before an identity provider is provisioned. It is not secure multi-user authentication.

Before opening WTS Scout to external scouts, clubs or academies, replace the workspace header trust with a real server-verifiable identity system (for example Sign in with Vercel, Clerk or another OIDC provider). The API should derive `workspaceId` from the authenticated session rather than from a client-supplied header.

## 5. Deploy

GitHub `main` is connected to Vercel. A push to `main` creates a production deployment automatically.

Manual CLI equivalents:

```bash
vercel deploy
vercel deploy --prod
```

## 6. Health check

Use:

```text
/api/health
```

The endpoint verifies the Neon database with `select 1` and reports Blob and AI configuration state. It returns HTTP 503 when the database is not configured or unhealthy.

## 7. Production checklist

- Neon database provisioned and schema applied
- `DATABASE_URL` configured in Production and Preview
- Vercel Blob store connected
- `BLOB_READ_WRITE_TOKEN` configured when required
- AI Gateway key configured
- Real authentication installed before multi-user launch
- API routes tested in Preview before Production promotion
- GitHub CI build passing
