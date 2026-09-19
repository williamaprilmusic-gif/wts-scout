import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const deploymentEnv = String(
    process.env.VERCEL_ENV ||
    process.env.VITE_WTS_VERCEL_ENV ||
    'production'
  ).trim().toLowerCase();

  const requestedMode = String(process.env.VITE_WTS_SCOUT_MODE || '').trim().toLowerCase();

  // Production is a hard fail-safe. Preview deployments automatically use
  // the isolated preview adapter. Local development can opt into demo mode.
  const scoutMode =
    deploymentEnv === 'production' ? 'production' :
    deploymentEnv === 'preview' ? (requestedMode === 'production' ? 'production' : 'preview') :
    requestedMode === 'demo' ? 'demo' :
    'production';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_WTS_VERCEL_ENV': JSON.stringify(deploymentEnv),
      'import.meta.env.VITE_WTS_SCOUT_MODE': JSON.stringify(scoutMode),
    },
  };
});
