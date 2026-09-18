import { readFile } from 'node:fs/promises';

const requiredFiles = ['db/schema.sql','SETUP.md','README.md','.github/workflows/ci.yml','api/_lib/ai.js'];
for (const file of requiredFiles) {
  try { await readFile(file, 'utf8'); } catch { throw new Error(`Missing required production file: ${file}`); }
}
for (const file of ['README.md','SETUP.md','package.json','db/schema.sql']) {
  const content = await readFile(file, 'utf8');
  if (/supabase/i.test(content)) throw new Error(`Supabase reference found in ${file}; WTS Scout must use the Vercel-first stack.`);
}
const requiredApiRoutes = ['api/auth.js','api/health.js','api/players.js','api/watchlist.js','api/notes.js','api/reports.js','api/scout.js','api/upload.js'];
for (const file of requiredApiRoutes) {
  try { await readFile(file, 'utf8'); } catch { throw new Error(`Missing required API route: ${file}`); }
}
for (const file of requiredApiRoutes.filter(file => file !== 'api/health.js')) {
  const content = await readFile(file, 'utf8');
  if (!content.includes('assertSameOrigin')) throw new Error(`Missing same-origin protection in ${file}`);
}
for (const file of ['src/main.jsx','src/wts-api.js']) {
  const content = await readFile(file, 'utf8');
  if (/supabase/i.test(content)) throw new Error(`Supabase reference found in ${file}; use the WTS API client and Vercel-first stack.`);
}
const packageJson = JSON.parse(await readFile('package.json','utf8'));
const dependencies = {...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {})};
for (const dependency of ['@neondatabase/serverless','@vercel/blob','zod']) {
  if (!dependencies[dependency]) throw new Error(`Missing required production dependency: ${dependency}`);
}
const setup = await readFile('SETUP.md','utf8');
for (const variable of ['DATABASE_URL','BLOB_STORE_ID','AI_GATEWAY_API_KEY','WTS_SCOUT_MODEL']) {
  if (!setup.includes(variable)) throw new Error(`SETUP.md does not document required server-side variable: ${variable}`);
}
const aiSource = await readFile('api/_lib/ai.js','utf8');
for (const marker of ['getScoutingAI','generateStructured','AI_GATEWAY_API_KEY','WTS_SCOUT_MODEL','ai-gateway.vercel.sh']) {
  if (!aiSource.includes(marker)) throw new Error(`AI Gateway provider interface missing marker: ${marker}`);
}
console.log('WTS Scout production architecture checks passed.');
