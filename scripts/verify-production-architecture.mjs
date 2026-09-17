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

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };

for (const dependency of ['@neondatabase/serverless', '@vercel/blob', 'ai']) {
  if (!dependencies[dependency]) {
    throw new Error(`Missing required production dependency: ${dependency}`);
  }
}

const setup = await readFile('SETUP.md', 'utf8');
for (const variable of ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'AI_GATEWAY_API_KEY']) {
  if (!setup.includes(variable)) {
    throw new Error(`SETUP.md does not document required server-side variable: ${variable}`);
  }
}

console.log('WTS Scout production architecture checks passed.');
