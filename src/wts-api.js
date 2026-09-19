import { upload as blobUpload } from '@vercel/blob/client';

export const demoPlayers = [
  { id: 'demo-1', full_name: 'Rayo Pearce', age: 15, position: 'CAM', secondary_position: 'RW', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Liverpool Portland FC', status: 'Emerging', fit_score: 94, minutes: 1120, goals: 11, assists: 14, strengths: ['Vision', 'Control', 'Progression'], bio: 'Creative attacking midfielder with strong spatial awareness and progression through the inside channels.', avatar_url: '' },
  { id: 'demo-2', full_name: 'Mandla Ndlovu', age: 18, position: 'RW', secondary_position: 'LW', preferred_foot: 'Left', nationality: 'South Africa', city: 'Johannesburg', current_club: 'Cape United Academy', status: 'Watchlist', fit_score: 91, minutes: 1380, goals: 13, assists: 9, strengths: ['1v1', 'Acceleration', 'Chance Creation'], bio: 'Direct winger who attacks the full-back and creates separation in transition.', avatar_url: '' },
  { id: 'demo-3', full_name: 'Thabo Maseko', age: 17, position: 'CM', secondary_position: 'CDM', preferred_foot: 'Right', nationality: 'South Africa', city: 'Soweto', current_club: 'Soweto Football Academy', status: 'Emerging', fit_score: 89, minutes: 1510, goals: 6, assists: 12, strengths: ['Scanning', 'Passing', 'Press Resistance'], bio: 'Midfield connector with reliable circulation and strong awareness under pressure.', avatar_url: '' },
  { id: 'demo-4', full_name: 'Liam Jacobs', age: 19, position: 'CB', secondary_position: 'RB', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Bayhill United', status: 'Available', fit_score: 87, minutes: 1690, goals: 3, assists: 2, strengths: ['Aerial', 'Recovery', 'Build-up'], bio: 'Athletic defender suited to a proactive line with improving distribution.', avatar_url: '' },
  { id: 'demo-5', full_name: 'Amani Okoro', age: 18, position: 'ST', secondary_position: 'LW', preferred_foot: 'Right', nationality: 'Nigeria', city: 'Lagos', current_club: 'Lagos City Academy', status: 'Emerging', fit_score: 86, minutes: 1295, goals: 17, assists: 6, strengths: ['Finishing', 'Movement', 'Athleticism'], bio: 'Mobile striker who finds space between centre-back and full-back and attacks the box aggressively.', avatar_url: '' },
  { id: 'demo-6', full_name: 'Nia Daniels', age: 17, position: 'LB', secondary_position: 'LWB', preferred_foot: 'Left', nationality: 'Ghana', city: 'Accra', current_club: 'Accra Elite', status: 'Watchlist', fit_score: 84, minutes: 1432, goals: 2, assists: 11, strengths: ['Recovery', 'Crossing', 'Tempo'], bio: 'Modern full-back with repeat running capacity and a progressive crossing profile.', avatar_url: '' },
];

const requestedMode = String(import.meta.env.VITE_WTS_SCOUT_MODE || '').trim().toLowerCase();
const deploymentEnv = String(
  import.meta.env.VITE_WTS_VERCEL_ENV || (import.meta.env.DEV ? 'development' : 'production')
).trim().toLowerCase();

export const wtsMode =
  requestedMode === 'preview' && deploymentEnv === 'preview' ? 'preview' :
  requestedMode === 'demo' && import.meta.env.DEV ? 'demo' :
  'production';

export const isPreviewMode = wtsMode !== 'production';
export const wtsConfigured = !isPreviewMode;

const PREVIEW_STORAGE_PREFIX = 'wts_scout_preview_v1';
const authListeners = new Set();

function previewStorageKey(name) {
  return `${PREVIEW_STORAGE_PREFIX}:${name}`;
}

function readPreviewStorage(name, fallback) {
  try {
    const raw = window.localStorage.getItem(previewStorageKey(name));
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writePreviewStorage(name, value) {
  try {
    window.localStorage.setItem(previewStorageKey(name), JSON.stringify(value));
  } catch {
    // Preview mode remains usable even when browser storage is unavailable.
  }
}

function makePreviewId(prefix) {
  const id = globalThis.crypto?.randomUUID?.();
  return id ? `${prefix}-${id}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneDemoPlayers() {
  return demoPlayers.map(player => ({ ...player, strengths: [...(player.strengths || [])] }));
}

function getPreviewPlayers() {
  return readPreviewStorage('players', null) ?? cloneDemoPlayers();
}

function getPreviewWatchlist() {
  return readPreviewStorage('watchlist', null) ?? ['demo-1', 'demo-3'];
}

function normalizeSession(raw) {
  if (!raw?.user) return null;
  return {
    ...raw,
    user: {
      ...raw.user,
      user_metadata: { full_name: raw.user.full_name, role: raw.user.role },
    },
  };
}

function notifyAuth(raw) {
  const session = normalizeSession(raw?.session ?? raw);
  for (const listener of authListeners) listener(session);
  return session;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.error ? payload.error : `Request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function getSession() {
  if (isPreviewMode) return null;
  try {
    const result = await api('/api/auth');
    return normalizeSession(result.session);
  } catch (error) {
    if (error?.status === 401 || error?.status === 404 || error?.status === 503) return null;
    throw error;
  }
}

export function subscribeToAuth(callback) {
  if (callback) authListeners.add(callback);
  return () => { if (callback) authListeners.delete(callback); };
}

export async function signIn(email, password) {
  if (isPreviewMode) {
    const result = { session: { user: { id: 'preview-user', full_name: 'Preview Scout', role: 'scout' } } };
    notifyAuth(result);
    return { data: result, error: null };
  }
  try {
    const result = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'signin', email, password }) });
    notifyAuth(result);
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signUp(email, password, name, role = 'scout') {
  if (isPreviewMode) {
    const result = { session: { user: { id: 'preview-user', full_name: name || 'Preview Scout', role } } };
    notifyAuth(result);
    return { data: result, error: null };
  }
  try {
    const result = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'signup', email, password, name, role }) });
    notifyAuth(result);
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOut() {
  if (isPreviewMode) {
    notifyAuth(null);
    return { error: null };
  }
  try {
    await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'signout' }) });
    notifyAuth(null);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function loadPlayers() {
  if (isPreviewMode) return getPreviewPlayers();
  const result = await api('/api/players');
  return Array.isArray(result) ? result : result.players || [];
}

export async function createPlayer(payload, _userId) {
  if (isPreviewMode) {
    const row = {
      id: makePreviewId('preview-player'),
      full_name: payload.full_name,
      age: payload.age ?? null,
      position: payload.position || null,
      secondary_position: payload.secondary_position || null,
      preferred_foot: payload.preferred_foot || null,
      nationality: payload.nationality || null,
      city: payload.city || null,
      current_club: payload.current_club || null,
      league: payload.league || null,
      status: payload.status || 'Emerging',
      fit_score: payload.fit_score ?? null,
      minutes: 0,
      goals: 0,
      assists: 0,
      strengths: [...(payload.strengths || [])],
      bio: payload.bio || '',
      avatar_url: '',
    };
    writePreviewStorage('players', [row, ...getPreviewPlayers()]);
    return row;
  }
  const result = await api('/api/players', { method: 'POST', body: JSON.stringify(payload) });
  return result?.player || result;
}

export async function uploadPlayerMedia(userId, playerId, file) {
  if (isPreviewMode) return URL.createObjectURL(file);
  if (!userId) throw new Error('Authentication is required for media uploads.');
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-');
  const result = await blobUpload(`players/${userId}/${playerId}/${Date.now()}-${safeName}`, file, {
    access: 'private',
    handleUploadUrl: '/api/upload',
    clientPayload: JSON.stringify({ playerId }),
    multipart: file.size > 4 * 1024 * 1024,
  });
  if (!result?.pathname) throw new Error('Blob upload completed without a pathname.');
  return `/api/media?playerId=${encodeURIComponent(playerId)}&pathname=${encodeURIComponent(result.pathname)}`;
}

export async function generateScoutingReport(player, brief) {
  if (isPreviewMode) {
    const profileText = `${player.position || ''} ${(player.strengths || []).join(' ')} ${player.bio || ''} ${brief || ''}`.toLowerCase();
    const strengthSeed = Math.min(20, (player.strengths || []).length * 4);
    const contextSeed = profileText.includes('cam') || profileText.includes('creative') || profileText.includes('chance creation') ? 8 : 3;
    const fitScore = Math.max(68, Math.min(94, 68 + strengthSeed + contextSeed));
    return {
      preview: true,
      fitScore,
      summary: `Preview assessment for ${player.full_name}: the profile contains the recorded football strengths and context supplied in this preview workspace.`,
      strengths: (player.strengths || []).slice(0, 4),
      developmentAreas: ['Verify competitive level against stronger opposition', 'Collect multiple live observations before recruitment action'],
      tacticalFit: `Potential role fit should be tested against the stated brief: "${brief || 'No brief supplied.'}".`,
      evidenceToVerify: ['Recent match footage', 'Verified competition and minutes', 'Current physical and availability context'],
      nextObservation: 'Capture one full-match observation and compare the player against the same role profile at the next viewing.',
    };
  }
  const response = await fetch('/api/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, brief }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI report failed.');
  return data.report ?? data;
}

export async function saveReport(_userId, playerId, report) {
  if (isPreviewMode) {
    const reports = readPreviewStorage('reports', []);
    writePreviewStorage('reports', [{
      id: makePreviewId('preview-report'),
      player_id: playerId,
      title: report.title,
      content: report.content,
      fit_score: report.fitScore || null,
      created_at: new Date().toISOString(),
    }, ...reports]);
    return;
  }
  await api('/api/reports', { method: 'POST', body: JSON.stringify({ playerId, title: report.title, content: report.content, fitScore: report.fitScore || null }) });
}
