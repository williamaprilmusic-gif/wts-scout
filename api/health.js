import { isDbConfigured, json } from './_lib/db.js';

function configured(name) {
  return Boolean(process.env[name]);
}

export default async function handler() {
  return json({
    ok: true,
    architecture: 'GitHub → Vercel → Database → Blob Storage → AI',
    services: {
      database: { provider: 'Neon Postgres', configured: isDbConfigured() },
      blob: { provider: 'Vercel Blob', configured: configured('BLOB_READ_WRITE_TOKEN') },
      ai: { provider: 'Vercel AI Gateway', configured: configured('AI_GATEWAY_API_KEY') || configured('VERCEL_OIDC_TOKEN') },
    },
    timestamp: new Date().toISOString(),
  });
}
