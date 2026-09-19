import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const deploymentEnv = String(
    process.env.VERCEL_ENV ||
    env.VITE_WTS_VERCEL_ENV ||
    (mode === 'development' ? 'development' : 'production')
  ).trim().toLowerCase();

  const requestedMode = String(env.VITE_WTS_SCOUT_MODE || '').trim().toLowerCase();

  // Production is a hard fail-safe. Vercel Preview builds default to isolated
  // preview mode; local Vite development can opt into the same adapter with
  // VITE_WTS_SCOUT_MODE=demo.
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
