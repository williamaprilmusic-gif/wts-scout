import { db, isDbConfigured } from './_lib/db.js';
import { getScoutingProviderStatus } from './_lib/ai.js';

const HEALTH_TIMEOUT_MS = 5000;

function configured(name) { return Boolean(process.env[name]); }
function sendJson(response, data, status = 200) {
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return response.status(status).json(data);
}

async function withTimeout(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} health check timed out`)), HEALTH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkDatabase() {
  if (!isDbConfigured()) return { provider: 'Neon Postgres', configured: false, healthy: false, schemaReady: false, requiredTables: {} };
  try {
    const sql = db();
    await withTimeout(sql`select 1 as ok`, 'Database connectivity');
    const [schema] = await withTimeout(sql`
      select
        to_regclass('public.app_users') is not null as users_ready,
        to_regclass('public.workspaces') is not null as workspaces_ready,
        to_regclass('public.workspace_members') is not null as memberships_ready,
        to_regclass('public.app_sessions') is not null as sessions_ready,
        to_regclass('public.player_profiles') is not null as players_ready,
        to_regclass('public.watchlists') is not null as watchlists_ready,
        to_regclass('public.scouting_notes') is not null as notes_ready,
        to_regclass('public.scouting_reports') is not null as reports_ready,
        to_regclass('public.player_media') is not null as media_ready
    `, 'Database schema');
    const requiredTables = {
      app_users: Boolean(schema?.users_ready), workspaces: Boolean(schema?.workspaces_ready),
      workspace_members: Boolean(schema?.memberships_ready), app_sessions: Boolean(schema?.sessions_ready),
      player_profiles: Boolean(schema?.players_ready), watchlists: Boolean(schema?.watchlists_ready),
      scouting_notes: Boolean(schema?.notes_ready), scouting_reports: Boolean(schema?.reports_ready),
      player_media: Boolean(schema?.media_ready),
    };
    return { provider: 'Neon Postgres', configured: true, healthy: true, schemaReady: Object.values(requiredTables).every(Boolean), requiredTables };
  } catch (error) {
    console.error('WTS health database check failed', error);
    return { provider: 'Neon Postgres', configured: true, healthy: false, schemaReady: false, requiredTables: {}, error: error?.message?.includes('timed out') ? 'timeout' : 'unavailable' };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, { error: 'Method not allowed.' }, 405);
  const database = await checkDatabase();

  // Vercel Blob client/server operations require the Blob read/write token.
  // VERCEL_OIDC_TOKEN is used for AI Gateway auth, not as proof that Blob is usable.
  const blobTokenConfigured = configured('BLOB_READ_WRITE_TOKEN');
  const blobStoreConfigured = configured('BLOB_STORE_ID') || blobTokenConfigured;
  const blobConfigured = blobTokenConfigured && blobStoreConfigured;
  const blob = {
    provider: 'Vercel Blob', configured: blobConfigured, healthy: blobConfigured,
    auth: blobTokenConfigured ? 'api-key' : 'missing',
    store: blobStoreConfigured ? 'connected' : 'missing',
  };

  const aiStatus = getScoutingProviderStatus();
  const ai = {
    provider: 'Vercel AI Gateway', model: aiStatus.model, configured: aiStatus.configured, healthy: aiStatus.configured,
    auth: aiStatus.auth,
  };
  const healthy = database.configured && database.healthy && database.schemaReady && blob.healthy && ai.healthy;
  return sendJson(response, {
    ok: healthy,
    architecture: 'GitHub → Vercel → Neon Postgres → Vercel Blob → Vercel AI Gateway',
    services: { database, blob, ai }, version: '0.6.0', timestamp: new Date().toISOString(),
  }, healthy ? 200 : 503);
}
