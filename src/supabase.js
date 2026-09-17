import { upload as blobUpload } from '@vercel/blob/client';

// Compatibility filename kept temporarily so the existing UI can migrate safely.
// This file no longer imports or uses Supabase. WTS Scout now talks to Vercel
// Functions, Neon Postgres and Vercel Blob through the API boundary.

export const supabaseConfigured = true;

export const demoPlayers = [
  { id: 'demo-1', full_name: 'Rayo Pearce', age: 15, position: 'CAM', secondary_position: 'RW', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Liverpool Portland FC', status: 'Emerging', fit_score: 94, minutes: 1120, goals: 11, assists: 14, strengths: ['Vision', 'Control', 'Progression'], bio: 'Creative attacking midfielder with strong spatial awareness and progression through the inside channels.', avatar_url: '' },
  { id: 'demo-2', full_name: 'Mandla Ndlovu', age: 18, position: 'RW', secondary_position: 'LW', preferred_foot: 'Left', nationality: 'South Africa', city: 'Johannesburg', current_club: 'Cape United Academy', status: 'Watchlist', fit_score: 91, minutes: 1380, goals: 13, assists: 9, strengths: ['1v1', 'Acceleration', 'Chance Creation'], bio: 'Direct winger who attacks the full-back and creates separation in transition.', avatar_url: '' },
  { id: 'demo-3', full_name: 'Thabo Maseko', age: 17, position: 'CM', secondary_position: 'CDM', preferred_foot: 'Right', nationality: 'South Africa', city: 'Soweto', current_club: 'Soweto Football Academy', status: 'Emerging', fit_score: 89, minutes: 1510, goals: 6, assists: 12, strengths: ['Scanning', 'Passing', 'Press Resistance'], bio: 'Midfield connector with reliable circulation and strong awareness under pressure.', avatar_url: '' },
  { id: 'demo-4', full_name: 'Liam Jacobs', age: 19, position: 'CB', secondary_position: 'RB', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Bayhill United', status: 'Available', fit_score: 87, minutes: 1690, goals: 3, assists: 2, strengths: ['Aerial', 'Recovery', 'Build-up'], bio: 'Athletic defender suited to a proactive line with improving distribution.', avatar_url: '' },
  { id: 'demo-5', full_name: 'Amani Okoro', age: 18, position: 'ST', secondary_position: 'LW', preferred_foot: 'Right', nationality: 'Nigeria', city: 'Lagos', current_club: 'Lagos City Academy', status: 'Emerging', fit_score: 86, minutes: 1295, goals: 17, assists: 6, strengths: ['Finishing', 'Movement', 'Athleticism'], bio: 'Mobile striker who finds space between centre-back and full-back and attacks the box aggressively.', avatar_url: '' },
  { id: 'demo-6', full_name: 'Nia Daniels', age: 17, position: 'LB', secondary_position: 'LWB', preferred_foot: 'Left', nationality: 'Ghana', city: 'Accra', current_club: 'Accra Elite', status: 'Watchlist', fit_score: 84, minutes: 1432, goals: 2, assists: 11, strengths: ['Recovery', 'Crossing', 'Tempo'], bio: 'Modern full-back with repeat running capacity and a progressive crossing profile.', avatar_url: '' },
];

const WORKSPACE_KEY = 'wts_scout_workspace_id';
const WORKSPACE_NAME_KEY = 'wts_scout_workspace_name';
let authListener = null;

function workspaceId() {
  let id = localStorage.getItem(WORKSPACE_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    localStorage.setItem(WORKSPACE_KEY, id);
  }
  return id;
}

function workspaceName() {
  return localStorage.getItem(WORKSPACE_NAME_KEY) || 'WTS Scout Workspace';
}

function sessionForWorkspace() {
  return { user: { id: workspaceId(), user_metadata: { full_name: workspaceName(), role: 'scout' } } };
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-wts-workspace-id', workspaceId());
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

export async function getSession() {
  return sessionForWorkspace();
}

export function subscribeToAuth(callback) {
  authListener = callback;
  callback(sessionForWorkspace());
  return () => { if (authListener === callback) authListener = null; };
}

export async function signIn(email) {
  localStorage.setItem(WORKSPACE_NAME_KEY, email ? email.split('@')[0] : 'WTS Scout Workspace');
  const session = sessionForWorkspace();
  authListener?.(session);
  return { data: { session }, error: null };
}

export async function signUp(email, _password, name) {
  localStorage.setItem(WORKSPACE_NAME_KEY, name || email?.split('@')[0] || 'WTS Scout Workspace');
  const session = sessionForWorkspace();
  authListener?.(session);
  return { data: { session }, error: null };
}

export async function signOut() {
  localStorage.removeItem(WORKSPACE_KEY);
  localStorage.setItem(WORKSPACE_NAME_KEY, 'WTS Scout Workspace');
  const session = sessionForWorkspace();
  authListener?.(session);
}

export async function loadPlayers() {
  try {
    return await api('/api/players');
  } catch {
    return demoPlayers;
  }
}

export async function createPlayer(payload) {
  try {
    return await api('/api/players', { method: 'POST', body: JSON.stringify({ player: payload }) });
  } catch {
    return { ...payload, id: `demo-${Date.now()}`, created_at: new Date().toISOString() };
  }
}

export async function loadWatchlist() {
  try {
    return await api('/api/watchlist');
  } catch {
    return ['demo-1', 'demo-3'];
  }
}

export async function toggleWatchlist(_userId, playerId, active) {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/watchlist', {
    method: active ? 'DELETE' : 'POST',
    body: JSON.stringify({ playerId }),
  });
}

export async function createScoutingNote(_userId, playerId, note, stage = 'watching') {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/notes', { method: 'POST', body: JSON.stringify({ playerId, note, stage }) });
}

export async function loadNotes(_userId, playerId) {
  if (String(playerId).startsWith('demo-')) return [];
  try {
    return await api(`/api/notes?playerId=${encodeURIComponent(playerId)}`);
  } catch {
    return [];
  }
}

export async function uploadPlayerMedia(_userId, playerId, file) {
  if (!file) throw new Error('Select a file to upload.');
  if (!playerId) throw new Error('A player is required for media uploads.');
  const pathname = `players/${playerId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '-')}`;
  const blob = await blobUpload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    clientPayload: JSON.stringify({ workspaceId: workspaceId(), playerId }),
    multipart: file.size > 4 * 1024 * 1024,
  });
  return blob.url;
}

export async function saveReport(_userId, playerId, report) {
  if (String(playerId).startsWith('demo-')) return;
  await api('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ playerId, report: { ...report, content: report.content ?? report } }),
  });
}
