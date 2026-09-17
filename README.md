# WTS Scout

WTS Scout is a football talent-discovery and scouting workspace for players, scouts, clubs and academies.

## Architecture 0.3

The app now follows the requested Vercel-first architecture:

```text
GitHub
  ↓
Vercel
  ├── Vite frontend
  └── Vercel Functions /api
        ├── Neon Postgres → player profiles, shortlists, notes, reports, media metadata
        ├── Vercel Blob → player images, video, audio and documents
        └── Vercel AI Gateway + AI SDK → scouting intelligence
```

Vercel Functions are the server boundary. Browser code never talks directly to Neon, Blob credentials or an AI provider. Neon is the relational source of truth; Blob is the object store; AI SDK routes scouting generation through Vercel AI Gateway. Vercel's current Marketplace supports Neon as a Vercel-native serverless Postgres integration, while Vercel Blob provides object storage and client uploads; the AI SDK supports the Vercel AI Gateway with model strings such as `openai/gpt-5.4`. 

## What changed

- Removed the Supabase SDK and Supabase environment requirements.
- Added Neon Postgres service boundary and SQL schema at `db/schema.sql`.
- Added Vercel Functions for players, shortlists, scouting notes and reports.
- Added Vercel Blob client-upload boundary at `api/upload.js` for large media.
- Replaced the old direct OpenAI HTTP call with Vercel AI SDK + AI Gateway in `api/scout.js`.
- Added `/api/health` to show which backend services are configured.
- Kept a demo fallback so the dashboard can still be reviewed before services are provisioned.

## Provision the services

1. In the Vercel project, create/install the **Neon** database integration and make the resulting `DATABASE_URL` available to the project.
2. In Vercel Storage, create a **Blob** store connected to this project. The current upload boundary uses public media URLs for the existing player-media UI; switch to a private Blob store plus authenticated signed URLs before handling sensitive player footage.
3. Run `db/schema.sql` against the Neon database.
4. Enable Vercel AI Gateway for the project and provide `AI_GATEWAY_API_KEY` when API-key authentication is used. Vercel-hosted deployments can also use the platform's OIDC-based authentication flow where supported.
5. Redeploy from `main`.

Never commit real secrets. `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` and `AI_GATEWAY_API_KEY` are server-side values and must stay in Vercel environment variables.

## Local development

```bash
npm install
npm run dev
```

Without backend variables, the UI falls back to demo player data. Once Neon is connected, player creation, shortlists, notes and reports persist through the Vercel API boundary.

## Important production hardening

The current 0.3 workspace identity is a browser-generated workspace ID so the Vercel-first architecture can operate without adding another authentication vendor. It is **not a secure multi-user authentication system**. Before opening WTS Scout to multiple real scouts/clubs/academies, add real authentication and enforce authorization in every API route and Blob token callback. This is intentionally separated from the GitHub → Vercel → Database → Blob → AI architecture so an auth provider can be introduced without rewriting the data and AI layers.
