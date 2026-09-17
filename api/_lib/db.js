import { neon } from '@neondatabase/serverless';

let client;

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured. Connect a Neon Postgres database to the Vercel project and provide DATABASE_URL.');
  }
  client ||= neon(process.env.DATABASE_URL);
  return client;
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function methodNotAllowed(allowed) {
  return json({ error: `Method not allowed. Use ${allowed}.` }, 405);
}

export function serverError(error) {
  console.error(error);
  return json({ error: error instanceof Error ? error.message : 'Internal server error.' }, 500);
}
