import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

export const demoPlayers = [
  { id: 'demo-1', full_name: 'Rayo Pearce', age: 15, position: 'CAM', secondary_position: 'RW', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Liverpool Portland FC', status: 'Emerging', fit_score: 94, minutes: 1120, goals: 11, assists: 14, strengths: ['Vision', 'Control', 'Progression'], bio: 'Creative attacking midfielder with strong spatial awareness and progression through the inside channels.', avatar_url: '' },
  { id: 'demo-2', full_name: 'Mandla Ndlovu', age: 18, position: 'RW', secondary_position: 'LW', preferred_foot: 'Left', nationality: 'South Africa', city: 'Johannesburg', current_club: 'Cape United Academy', status: 'Watchlist', fit_score: 91, minutes: 1380, goals: 13, assists: 9, strengths: ['1v1', 'Acceleration', 'Chance Creation'], bio: 'Direct winger who attacks the full-back and creates separation in transition.', avatar_url: '' },
  { id: 'demo-3', full_name: 'Thabo Maseko', age: 17, position: 'CM', secondary_position: 'CDM', preferred_foot: 'Right', nationality: 'South Africa', city: 'Soweto', current_club: 'Soweto Football Academy', status: 'Emerging', fit_score: 89, minutes: 1510, goals: 6, assists: 12, strengths: ['Scanning', 'Passing', 'Press Resistance'], bio: 'Midfield connector with reliable circulation and strong awareness under pressure.', avatar_url: '' },
  { id: 'demo-4', full_name: 'Liam Jacobs', age: 19, position: 'CB', secondary_position: 'RB', preferred_foot: 'Right', nationality: 'South Africa', city: 'Cape Town', current_club: 'Bayhill United', status: 'Available', fit_score: 87, minutes: 1690, goals: 3, assists: 2, strengths: ['Aerial', 'Recovery', 'Build-up'], bio: 'Athletic defender suited to a proactive line with improving distribution.', avatar_url: '' },
  { id: 'demo-5', full_name: 'Amani Okoro', age: 18, position: 'ST', secondary_position: 'LW', preferred_foot: 'Right', nationality: 'Nigeria', city: 'Lagos', current_club: 'Lagos City Academy', status: 'Emerging', fit_score: 86, minutes: 1295, goals: 17, assists: 6, strengths: ['Finishing', 'Movement', 'Athleticism'], bio: 'Mobile striker who finds space between centre-back and full-back and attacks the box aggressively.', avatar_url: '' },
  { id: 'demo-6', full_name: 'Nia Daniels', age: 17, position: 'LB', secondary_position: 'LWB', preferred_foot: 'Left', nationality: 'Ghana', city: 'Accra', current_club: 'Accra Elite', status: 'Watchlist', fit_score: 84, minutes: 1432, goals: 2, assists: 11, strengths: ['Recovery', 'Crossing', 'Tempo'], bio: 'Modern full-back with repeat running capacity and a progressive crossing profile.', avatar_url: '' },
];

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function subscribeToAuth(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, name, role = 'scout') {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  return supabase.auth.signUp({ email, password, options: { data: { full_name: name, role } } });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function loadPlayers() {
  if (!supabase) return demoPlayers;
  const { data, error } = await supabase.from('player_profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPlayer(payload, userId) {
  if (!supabase) return { ...payload, id: `demo-${Date.now()}`, owner_id: userId, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from('player_profiles').insert({ ...payload, owner_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function loadWatchlist(userId) {
  if (!supabase || !userId) return ['demo-1', 'demo-3'];
  const { data, error } = await supabase.from('watchlists').select('player_id').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(row => row.player_id);
}

export async function toggleWatchlist(userId, playerId, active) {
  if (!supabase || String(playerId).startsWith('demo-')) return;
  if (active) {
    const { error } = await supabase.from('watchlists').delete().eq('user_id', userId).eq('player_id', playerId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('watchlists').insert({ user_id: userId, player_id: playerId });
  if (error && error.code !== '23505') throw error;
}

export async function createScoutingNote(userId, playerId, note, stage = 'watching') {
  if (!supabase || String(playerId).startsWith('demo-')) return;
  const { error } = await supabase.from('scouting_notes').insert({ user_id: userId, player_id: playerId, note, stage });
  if (error) throw error;
}

export async function loadNotes(userId, playerId) {
  if (!supabase || String(playerId).startsWith('demo-')) return [];
  const { data, error } = await supabase.from('scouting_notes').select('*').eq('user_id', userId).eq('player_id', playerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadPlayerMedia(userId, playerId, file) {
  if (!supabase) throw new Error('Media upload requires Supabase storage configuration.');
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-');
  const path = `${userId}/${playerId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('player-media').upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('player-media').getPublicUrl(path);
  const { error: mediaError } = await supabase.from('player_media').insert({ player_id: playerId, owner_id: userId, file_path: path, public_url: data.publicUrl, file_name: file.name, mime_type: file.type, file_size: file.size });
  if (mediaError) throw mediaError;
  return data.publicUrl;
}

export async function saveReport(userId, playerId, report) {
  if (!supabase || String(playerId).startsWith('demo-')) return;
  const { error } = await supabase.from('scouting_reports').insert({ user_id: userId, player_id: playerId, title: report.title, content: report.content, fit_score: report.fitScore || null });
  if (error) throw error;
}
