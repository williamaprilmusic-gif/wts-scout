import { upload as blobUpload } from '@vercel/blob/client';

export const demoPlayers = [
  { id: 'demo-1', full_name: 'Rayo Pearce', age: 15, position: 'CAM', secondary_position: 'RW', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Liverpool Portland FC', status: 'Emerging', fit_score: 94, minutes: 1120, goals: 11, assists: 14, strengths: ['Vision', 'Control', 'Progression'], bio: 'Creative attacking midfielder with strong spatial awareness and progression through the inside channels.', avatar_url: '' },
  { id: 'demo-2', full_name: 'Mandla Ndlovu', age: 18, position: 'RW', secondary_position: 'LW', preferred_foot: 'Left', nationality: 'South Africa', city: 'Johannesburg', current_club: 'Cape United Academy', status: 'Watchlist', fit_score: 91, minutes: 1380, goals: 13, assists: 9, strengths: ['1v1', 'Acceleration', 'Chance Creation'], bio: 'Direct winger who attacks the full-back and creates separation in transition.', avatar_url: '' },
  { id: 'demo-3', full_name: 'Thabo Maseko', age: 17, position: 'CM', secondary_position: 'CDM', preferred_foot: 'Right', nationality: 'South Africa', city: 'Soweto', current_club: 'Soweto Football Academy', status: 'Emerging', fit_score: 89, minutes: 1510, goals: 6, assists: 12, strengths: ['Scanning', 'Passing', 'Press Resistance'], bio: 'Midfield connector with reliable circulation and strong awareness under pressure.', avatar_url: '' },
  { id: 'demo-4', full_name: 'Liam Jacobs', age: 19, position: 'CB', secondary_position: 'RB', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Bayhill United', status: 'Available', fit_score: 87, minutes: 1690, goals: 3, assists: 2, strengths: ['Aerial', 'Recovery', 'Build-up'], bio: 'Athletic defender suited to a proactive line with improving distribution.', avatar_url: '' },
  { id: 'demo-5', full_name: 'Amani Okoro', age: 18, position: 'ST', secondary_position: 'LW', preferred_foot: 'Right', nationality: 'Nigeria', city: 'Lagos', current_club: 'Lagos City Academy', status: 'Emerging', fit_score: 86, minutes: 1295, goals: 17, assists: 6, strengths: ['Finishing', 'Movement', 'Athleticism'], bio: 'Mobile striker who finds space between centre-back and full-back and attacks the box aggressively.', avatar_url: '' },
  { id: 'demo-6', full_name: 'Nia Daniels', age: 17, position: 'LB', secondary_position: 'LWB', preferred_foot: 'Left', nationality: 'Ghana', city: 'Accra', current_club: 'Accra Elite', status: 'Watchlist', fit_score: 84, minutes: 1432, goals: 2, assists: 11, strengths: ['Recovery', 'Crossing', 'Tempo'], bio: 'Modern full-back with repeat running capacity and a progressive crossing profile.', avatar_url: '' },
];

export const wtsConfigured = true;
const authListeners = new Set();

function normalizeSession(raw) {
  if (!raw?.user) return null;
  return {
    ...raw,
    user: {
      ...raw.user,
      user_metadata: {
        full_name: raw.user.full_name,
        role: raw.user.role,
      },
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
  try {
    const result = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'signin', email, password }) });
    notifyAuth(result);
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signUp(email, password, name, role = 'scout') {
  try {
    const result = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'signup', email, password, name, role }) });
    notifyAuth(result);
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOut() {
  try {
    await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'signout' }) });
    notifyAuth(null);
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function loadPlayers() {
  try {
    const result = await api('/api/players');
    return Array.isArray(result) ? result : result.players || [];
  } catch {
    return demoPlayers;
  }
}

export async function createPlayer(payload, _userId) {
  const result = await api('/api/players', { method: 'POST', body: JSON.stringify(payload) });
  return result?.player || result;
}

export async function loadWatchlist(_userId) {
  try {
    const result = await api('/api/watchlist');
    return Array.isArray(result) ? result : result.playerIds || [];
  } catch {
    return ['demo-1', 'demo-3'];
  }
}

export async function toggleWatchlist(_userId, playerId, active) {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/watchlist', { method: active ? 'DELETE' : 'POST', body: JSON.stringify({ playerId }) });
}

export async function createScoutingNote(_userId, playerId, note, stage = 'watching') {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/notes', { method: 'POST', body: JSON.stringify({ playerId, note, stage }) });
}

export async function loadNotes(_userId, playerId) {
  if (String(playerId).startsWith('demo-')) return [];
  try {
    const result = await api(`/api/notes?playerId=${encodeURIComponent(playerId)}`);
    return Array.isArray(result) ? result : result.notes || [];
  } catch {
    return [];
  }
}

export async function uploadPlayerMedia(userId, playerId, file) {
  if (String(playerId).startsWith('demo-')) throw new Error('Media uploads require a saved database player profile.');
  if (!userId) throw new Error('Authentication is required for media uploads.');
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-');
  return blobUpload(`players/${userId}/${playerId}/${Date.now()}-${safeName}`, file, {
    access: 'private',
    handleUploadUrl: '/api/upload',
    clientPayload: JSON.stringify({ playerId }),
    multipart: file.size > 4 * 1024 * 1024,
  });
}

export async function saveReport(_userId, playerId, report) {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/reports', { method: 'POST', body: JSON.stringify({ playerId, title: report.title, content: report.content, fitScore: report.fitScore || null }) });
}
