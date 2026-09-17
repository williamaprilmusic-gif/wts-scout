import { db, isDbConfigured, json } from './_lib/db.js';

function configured(name) {
  return Boolean(process.env[name]);
}

async function checkDatabase() {
  if (!isDbConfigured()) return { provider: 'Neon Postgres', configured: false, healthy: false };
  try {
    const sql = db();
    await sql`select 1 as ok`;
    return { provider: 'Neon Postgres', configured: true, healthy: true };
  } catch (error) {
    console.error('WTS health database check failed', error);
    return { provider: 'Neon Postgres', configured: true, healthy: false };
  }
}

export default async function handler(request, response) {
  if (request?.method && request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const database = await checkDatabase();
  const blob = { provider: 'Vercel Blob', configured: configured('BLOB_READ_WRITE_TOKEN'), healthy: configured('BLOB_READ_WRITE_TOKEN') };
  const ai = {
    provider: 'Vercel AI Gateway',
    configured: configured('AI_GATEWAY_API_KEY') || configured('VERCEL_OIDC_TOKEN'),
    healthy: configured('AI_GATEWAY_API_KEY') || configured('VERCEL_OIDC_TOKEN'),
  };

  const healthy = database.configured ? database.healthy : false;

  return json({
    ok: healthy,
    architecture: 'GitHub → Vercel → Database → Blob Storage → AI',
    services: { database, blob, ai },
    version: '0.3.0',
    timestamp: new Date().toISOString(),
  }, healthy ? 200 : 503);
}
