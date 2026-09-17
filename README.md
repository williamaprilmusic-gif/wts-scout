# WTS Scout

WTS Scout is a football talent-discovery and scouting workspace for players, scouts, clubs and academies.

## Build 0.2

The product now includes the production foundation for:

- Supabase email authentication and role-based profiles
- Persistent player profiles and football metadata
- Watchlists / shortlists
- Scouting notes and recruitment pipeline stages
- Player media uploads through Supabase Storage
- Club and academy workspace UI
- AI scouting reports through the Vercel serverless API route
- Responsive WTS Scout dashboard and discovery interface
- Safe demo fallback while backend variables are not configured

## Backend setup

1. Create or connect a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor. This creates the tables, RLS policies, storage bucket and new-user profile trigger.
3. Add the following Vercel environment variables for Production (and Preview when needed):

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_SCOUT_MODEL=gpt-4.1-mini
```

4. Redeploy from `main`.

Never commit real secret values. The Supabase publishable/anon key may be used by the browser, but its access must remain protected by the SQL RLS policies. The OpenAI key must remain a server-side Vercel environment variable.

## Local development

```bash
npm install
npm run dev
```

Without Supabase variables the app intentionally runs with demo player data so the UI can still be reviewed. Once the Vercel variables are set, the sign-in/sign-up gate, database reads/writes, watchlists, notes and media upload workflow switch to the real backend.

## AI scouting

`api/scout.js` sends a supplied player profile plus recruitment brief to the configured OpenAI model and returns structured JSON. The interface explicitly presents the fit score as an internal screening aid and includes evidence-to-verify fields rather than treating the generated output as a final recruitment decision.
