import { upload as blobUpload } from '@vercel/blob/client';

const WORKSPACE_ID_KEY = 'wts_scout_workspace_id';
const WORKSPACE_NAME_KEY = 'wts_scout_workspace_name';

export const demoPlayers = [
  { id: 'demo-1', full_name: 'Rayo Pearce', age: 15, position: 'CAM', secondary_position: 'RW', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Liverpool Portland FC', status: 'Emerging', fit_score: 94, minutes: 1120, goals: 11, assists: 14, strengths: ['Vision', 'Control', 'Progression'], bio: 'Creative attacking midfielder with strong spatial awareness and progression through the inside channels.', avatar_url: '' },
  { id: 'demo-2', full_name: 'Mandla Ndlovu', age: 18, position: 'RW', secondary_position: 'LW', preferred_foot: 'Left', nationality: 'South Africa', city: 'Johannesburg', current_club: 'Cape United Academy', status: 'Watchlist', fit_score: 91, minutes: 1380, goals: 13, assists: 9, strengths: ['1v1', 'Acceleration', 'Chance Creation'], bio: 'Direct winger who attacks the full-back and creates separation in transition.', avatar_url: '' },
  { id: 'demo-3', full_name: 'Thabo Maseko', age: 17, position: 'CM', secondary_position: 'CDM', preferred_foot: 'Right', nationality: 'South Africa', city: 'Soweto', current_club: 'Soweto Football Academy', status: 'Emerging', fit_score: 89, minutes: 1510, goals: 6, assists: 12, strengths: ['Scanning', 'Passing', 'Press Resistance'], bio: 'Midfield connector with reliable circulation and strong awareness under pressure.', avatar_url: '' },
  { id: 'demo-4', full_name: 'Liam Jacobs', age: 19, position: 'CB', secondary_position: 'RB', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Bayhill United', status: 'Available', fit_score: 87, minutes: 1690, goals: 3, assists: 2, strengths: ['Aerial', 'Recovery', 'Build-up'], bio: 'Athletic defender suited to a proactive line with improving distribution.', avatar_url: '' },
  { id: 'demo-5', full_name: 'Amani Okoro', age: 18, position: 'ST', secondary_position: 'LW', preferred_foot: 'Right', nationality: 'Nigeria', city: 'Lagos', current_club: 'Lagos City Academy', status: 'Emerging', fit_score: 86, minutes: 1295, goals: 17, assists: 6, strengths: ['Finishing', 'Movement', 'Athleticism'], bio: 'Mobile striker who finds space between centre-back and full-back and attacks the box aggressively.', avatar_url: '' },
  { id: 'demo-6', full_name: 'Nia Daniels', age: 17, position: 'LB', secondary_position: 'LWB', preferred_foot: 'Left', nationality: 'Ghana', city: 'Accra', current_club: 'Accra Elite', status: 'Watchlist', fit_score: 84, minutes: 1432, goals: 2, assists: 11, strengths: ['Recovery', 'Crossing', 'Tempo'], bio: 'Modern full-back with repeat running capacity and a progressive crossing profile.', avatar_url: '' },
];

export const wtsConfigured = true;

function getWorkspaceId() {
  let id = localStorage.getItem(WORKSPACE_ID_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 32);
    localStorage.setItem(WORKSPACE_ID_KEY, id);
  }
  return id;
}

function getWorkspaceName() {
  return localStorage.getItem(WORKSPACE_NAME_KEY) || 'William April';
}

function setWorkspaceName(name) {
  if (name) localStorage.setItem(WORKSPACE_NAME_KEY, name.trim());
}

function sessionObject() {
  const id = getWorkspaceId();
  return { user: { id, user_metadata: { full_name: getWorkspaceName(), role: 'scout' } } };
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-wts-workspace-id', getWorkspaceId());
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.error ? payload.error : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

export async function getSession() {
  return sessionObject();
}

export function subscribeToAuth(callback) {
  callback?.(sessionObject());
  return () => {};
}

export async function signIn(_email, _password) {
  return { data: sessionObject(), error: null };
}

export async function signUp(_email, _password, name, _role = 'scout') {
  setWorkspaceName(name);
  return { data: { session: sessionObject() }, error: null };
}

export async function signOut() {
  return { error: null };
}

export async function loadPlayers() {
  try {
    const result = await api('/api/players');
    return result.players || [];
  } catch {
    return demoPlayers;
  }
}

export async function createPlayer(payload, userId) {
  const result = await api('/api/players', {
    method: 'POST',
    body: JSON.stringify({ ...payload, ownerId: userId, workspaceId: getWorkspaceId() }),
  });
  return result.player;
}

export async function loadWatchlist(_userId) {
  try {
    const result = await api('/api/watchlist');
    return result.playerIds || [];
  } catch {
    return ['demo-1', 'demo-3'];
  }
}

export async function toggleWatchlist(_userId, playerId, active) {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/watchlist', {
    method: active ? 'DELETE' : 'POST',
    body: JSON.stringify({ playerId, workspaceId: getWorkspaceId() }),
  });
}

export async function createScoutingNote(_userId, playerId, note, stage = 'watching') {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/notes', {
    method: 'POST',
    body: JSON.stringify({ playerId, note, stage, workspaceId: getWorkspaceId() }),
  });
}

export async function loadNotes(_userId, playerId) {
  if (String(playerId).startsWith('demo-')) return [];
  try {
    const result = await api(`/api/notes?playerId=${encodeURIComponent(playerId)}`);
    return result.notes || [];
  } catch {
    return [];
  }
}

export async function uploadPlayerMedia(_userId, playerId, file) {
  if (String(playerId).startsWith('demo-')) throw new Error('Media uploads require a saved database player profile.');
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-');
  return blobUpload(`players/${getWorkspaceId()}/${playerId}/${Date.now()}-${safeName}`, file, {
    access: 'private',
    handleUploadUrl: '/api/upload',
    clientPayload: JSON.stringify({ workspaceId: getWorkspaceId(), playerId }),
    multipart: file.size > 4 * 1024 * 1024,
  });
}

export async function saveReport(_userId, playerId, report) {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ playerId, title: report.title, content: report.content, fitScore: report.fitScore || null, workspaceId: getWorkspaceId() }),
  });
}
