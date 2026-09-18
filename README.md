# WTS Scout

WTS Scout is a football talent-discovery and scouting workspace for players, scouts, clubs and academies.

## Architecture 0.5

```text
GitHub
  ↓
Vercel
  ├── Vite frontend
  └── Vercel Functions /api
        ├── Neon Postgres → users, workspaces, players, watchlists, notes, reports, media metadata
        ├── Vercel Blob → private player images, video, audio and documents
        └── AI provider → Gemini free tier for development, optional Vercel AI Gateway for managed routing
```

Neon is the relational source of truth; Blob is the object store; the AI provider is isolated behind the server-side scouting endpoint.

## Authentication and authorization

WTS Scout has application-level email/password authentication backed by Neon:

- Passwords are stored as salted `scrypt` hashes, never plaintext.
- Sessions use cryptographically random opaque tokens; only SHA-256 token hashes are stored in Neon.
- Sessions are delivered in an `HttpOnly`, `SameSite=Lax` cookie and use `Secure` on Vercel.
- Signup creates a personal workspace and an owner membership.
- Protected APIs derive workspace context from the authenticated session.

## AI provider strategy

The `/api/scout` endpoint supports:

- **Gemini API** using `GEMINI_API_KEY` and `gemini-2.5-flash-lite` for low-cost/free development.
- **Vercel AI Gateway** as an optional managed provider layer for later production expansion.

The provider is selected server-side with `WTS_SCOUT_PROVIDER`; the browser never chooses an arbitrary upstream AI provider.

The Gemini response uses structured JSON output and is validated with Zod before it reaches the browser.

## Provision the services

1. Connect a **Neon** database to the Vercel project and make `DATABASE_URL` available to Production/Preview.
2. Create a **private Vercel Blob** store connected to the project.
3. Run `db/schema.sql` against Neon.
4. For free AI development, create a Gemini API key and add `GEMINI_API_KEY` server-side; set `WTS_SCOUT_PROVIDER=gemini`.
5. Optionally enable Vercel AI Gateway later for managed multi-provider routing.
6. Redeploy `main`.

Never commit real secrets.

## Local development

```bash
npm install
npm run dev
```

Without backend services, the UI can still load its demo player dataset. Real signup/sign-in and persistent scouting data require Neon and the required server-side variables.

## Production security roadmap

Before opening WTS Scout to a large public user base, add email verification, password reset/recovery, login abuse/rate limiting, session revocation UI, workspace invitations, audit logging, AI usage quotas and upload quotas.

See `SETUP.md` for the infrastructure setup checklist.
