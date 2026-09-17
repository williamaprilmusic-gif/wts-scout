// Legacy module name retained temporarily so the existing UI does not need a risky bulk rewrite.
// The implementation is now fully Vercel/Neon/Blob based; no Supabase SDK or network calls remain.
export {
  demoPlayers,
  getSession,
  subscribeToAuth,
  signIn,
  signUp,
  signOut,
  loadPlayers,
  createPlayer,
  loadWatchlist,
  toggleWatchlist,
  createScoutingNote,
  loadNotes,
  uploadPlayerMedia,
  saveReport,
} from './wts-api.js';

export const supabaseConfigured = true;
