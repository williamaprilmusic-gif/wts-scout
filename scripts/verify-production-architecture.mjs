import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'db/schema.sql',
  'SETUP.md',
  'README.md',
  '.github/workflows/ci.yml',
];

for (const file of requiredFiles) {
  try {
    await readFile(file, 'utf8');
  } catch {
    throw new Error(`Missing required production file: ${file}`);
  }
}

const sourceFiles = ['README.md', 'SETUP.md', 'package.json', 'db/schema.sql'];
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  if (/supabase/i.test(content)) {
    throw new Error(`Supabase reference found in ${file}; WTS Scout must use the Vercel-first stack.`);
  }
}

const requiredApiRoutes = [
  'api/auth.js',
  'api/health.js',
  'api/players.js',
  'api/watchlist.js',
  'api/notes.js',
  'api/reports.js',
  'api/scout.js',
  'api/upload.js',
];
for (const file of requiredApiRoutes) {
  try { await readFile(file, 'utf8'); } catch { throw new Error(`Missing required API route: ${file}`); }
}

for (const file of requiredApiRoutes.filter(file => !['api/health.js'].includes(file))) {
  const content = await readFile(file, 'utf8');
  if (!content.includes('assertSameOrigin')) {
    throw new Error(`Missing same-origin protection in ${file}`);
  }
}

const frontendFiles = ['src/main.jsx', 'src/wts-api.js'];
for (const file of frontendFiles) {
  const content = await readFile(file, 'utf8');
  if (/supabase/i.test(content)) {
    throw new Error(`Supabase reference found in ${file}; use the WTS API client and Vercel-first stack.`);
  }
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };

for (const dependency of ['@neondatabase/serverless', '@vercel/blob', 'ai']) {
  if (!dependencies[dependency]) {
    throw new Error(`Missing required production dependency: ${dependency}`);
  }
}

const setup = await readFile('SETUP.md', 'utf8');
for (const variable of ['DATABASE_URL', 'BLOB_STORE_ID', 'GEMINI_API_KEY']) {
  if (!setup.includes(variable)) {
    throw new Error(`SETUP.md does not document required server-side variable: ${variable}`);
  }
}

console.log('WTS Scout production architecture checks passed.');
