import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowUpRight, Bell, Bookmark, Building2, CheckCircle2, ChevronDown, ChevronRight,
  CircleUserRound, FileText, GraduationCap, LayoutDashboard, LogIn, LogOut, Menu, Plus,
  Radar, Search, Settings2, ShieldCheck, Sparkles, Target, Upload, Users, X, Zap
} from 'lucide-react';
import './styles.css';
import {
  createPlayer, createScoutingNote, demoPlayers, getSession, loadNotes, loadPlayers,
  loadWatchlist, saveReport, signIn, signOut, signUp, supabase, supabaseConfigured,
  subscribeToAuth, toggleWatchlist, uploadPlayerMedia
} from './supabase';

const nav = [
  { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { key: 'discover', label: 'Discover Talent', icon: Radar },
  { key: 'players', label: 'Players', icon: Users },
  { key: 'shortlist', label: 'Shortlists', icon: Bookmark },
  { key: 'crm', label: 'Scout CRM', icon: Activity },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'clubs', label: 'Clubs', icon: Building2 },
  { key: 'academy', label: 'Academy', icon: GraduationCap },
];

function initials(name = '') {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'PL';
}

function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [page, setPage] = useState('dashboard');
  const [players, setPlayers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wts_demo_players') || 'null') || demoPlayers; } catch { return demoPlayers; }
  });
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wts_demo_watchlist') || 'null') || ['demo-1', 'demo-3']; } catch { return ['demo-1', 'demo-3']; }
  });
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('All positions');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!supabaseConfigured) {
      setReady(true);
      return undefined;
    }
    getSession().then(s => { setSession(s); setReady(true); });
    return subscribeToAuth(s => setSession(s));
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      localStorage.setItem('wts_demo_players', JSON.stringify(players));
      localStorage.setItem('wts_demo_watchlist', JSON.stringify(watchlist));
    }
  }, [players, watchlist]);

  useEffect(() => {
    if (!session?.user?.id) return;
    Promise.all([loadPlayers(), loadWatchlist(session.user.id)])
      .then(([rows, ids]) => { setPlayers(rows); setWatchlist(ids); })
      .catch(error => showToast(error.message));
  }, [session]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }

  async function handleAuth(values) {
    setBusy(true);
    try {
      if (authMode === 'signin') {
        const { error } = await signIn(values.email, values.password);
        if (error) throw error;
      } else {
        const { error, data } = await signUp(values.email, values.password, values.name, values.role);
        if (error) throw error;
        if (!data?.session) showToast('Account created. Check your email to confirm the account, then sign in.');
        else setModal(null);
      }
    } catch (error) {
      showToast(error.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddPlayer(form) {
    setBusy(true);
    try {
      const payload = {
        full_name: form.name,
        position: form.position,
        secondary_position: form.secondary || null,
        preferred_foot: form.foot,
        nationality: form.nationality,
        city: form.city,
        current_club: form.club,
        league: form.league,
        status: 'Emerging',
        bio: form.bio,
        strengths: form.strengths.split(',').map(x => x.trim()).filter(Boolean),
        age: Number(form.age) || null,
        fit_score: null,
      };
      const row = await createPlayer(payload, session?.user?.id || 'demo-user');
      setPlayers(p => [row, ...p]);
      setSelected(row);
      setModal(null);
      showToast('Player profile created.');
    } catch (error) {
      showToast(error.message || 'Could not create player.');
    } finally {
      setBusy(false);
    }
  }

  async function handleShortlist(player) {
    const active = watchlist.includes(player.id);
    setWatchlist(ids => active ? ids.filter(id => id !== player.id) : [...ids, player.id]);
    try {
      await toggleWatchlist(session?.user?.id, player.id, active);
      showToast(active ? 'Removed from shortlist.' : 'Added to shortlist.');
    } catch (error) {
      setWatchlist(ids => active ? [...ids, player.id] : ids.filter(id => id !== player.id));
      showToast(error.message || 'Could not update shortlist.');
    }
  }

  async function handleSaveNote(playerId, note, stage) {
    try {
      await createScoutingNote(session?.user?.id, playerId, note, stage);
      showToast('Scout note saved.');
    } catch (error) {
      showToast(error.message || 'Could not save note.');
    }
  }

  if (!ready) return <div className="loading-screen"><div className="loading-mark">WTS</div><div>Connecting to WTS Scout…</div></div>;

  const authenticated = !supabaseConfigured || Boolean(session);
  if (!authenticated) {
    return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} busy={busy} configured={supabaseConfigured} />;
  }

  const filtered = players.filter(player => {
    const haystack = `${player.full_name || ''} ${player.position || ''} ${player.nationality || ''} ${player.current_club || ''} ${player.city || ''}`.toLowerCase();
    const matchesText = haystack.includes(query.toLowerCase());
    return matchesText && (position === 'All positions' || player.position === position);
  });

  function navigate(key) { setPage(key); setMobileOpen(false); }

  return (
    <div className="app-shell">
      {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
      <aside className={mobileOpen ? 'sidebar mobile-open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">WTS</div>
          <div><div className="brand-name">WTS Scout</div><div className="brand-sub">Talent intelligence</div></div>
          <button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)}><X size={18}/></button>
        </div>
        <div className="workspace"><div className="workspace-dot"/><div><div className="workspace-label">SCOUT WORKSPACE</div><div className="workspace-name">{session?.user?.user_metadata?.full_name || 'William April'}</div></div><ChevronDown size={15}/></div>
        <nav className="nav">
          {nav.map(item => { const Icon = item.icon; return <button key={item.key} className={page === item.key ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item.key)}><Icon size={18}/><span>{item.label}</span>{item.key === 'shortlist' && <span className="nav-count">{watchlist.length}</span>}</button>; })}
        </nav>
        <div className="sidebar-footer">
          <div className="footer-row"><ShieldCheck size={16}/><span>{supabaseConfigured ? 'Secure workspace' : 'Demo workspace'}</span></div>
          <div className="profile-mini"><div className="avatar avatar-w">{initials(session?.user?.user_metadata?.full_name || 'William April')}</div><div><div className="profile-name">{session?.user?.user_metadata?.full_name || 'William April'}</div><div className="profile-role">Scout workspace</div></div><ChevronRight size={15}/></div>
          {supabaseConfigured && <button className="logout-btn" onClick={() => signOut()}><LogOut size={14}/> Sign out</button>}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20}/></button>
          <div className="top-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search players, clubs, positions…"/><span className="shortcut">⌘ K</span></div>
          <div className="top-actions"><button className="icon-btn"><Bell size={18}/><span className="notif-dot"/></button><div className="top-divider"/><div className="avatar avatar-w">{initials(session?.user?.user_metadata?.full_name || 'William April')}</div></div>
        </header>

        {page === 'dashboard' && <Dashboard players={filtered} watchlist={watchlist} navigate={navigate} onSelect={setSelected} onShortlist={handleShortlist} />}
        {page === 'discover' && <Discover players={filtered} query={query} setQuery={setQuery} position={position} setPosition={setPosition} onSelect={setSelected} watchlist={watchlist} onShortlist={handleShortlist} openBrief={() => setModal({ type: 'brief' })} />}
        {page === 'players' && <Players players={players} watchlist={watchlist} onSelect={setSelected} onShortlist={handleShortlist} addPlayer={() => setModal({ type: 'player' })} />}
        {page === 'shortlist' && <Shortlist players={players.filter(p => watchlist.includes(p.id))} onSelect={setSelected} onShortlist={handleShortlist} />}
        {page === 'crm' && <CRM players={players} watchlist={watchlist} onSelect={setSelected} />}
        {page === 'reports' && <Reports players={players} onSelect={setSelected} openReport={p => { setSelected(p); setModal({ type: 'report', player: p }); }} />}
        {page === 'clubs' && <OrganisationPage kind="club" onToast={showToast} />}
        {page === 'academy' && <OrganisationPage kind="academy" onToast={showToast} />}
      </main>

      {selected && <PlayerDrawer player={selected} shortlisted={watchlist.includes(selected.id)} onClose={() => setSelected(null)} onShortlist={() => handleShortlist(selected)} openReport={() => setModal({ type: 'report', player: selected })} openNote={() => setModal({ type: 'note', player: selected })} openMedia={() => setModal({ type: 'media', player: selected })} />}
      {modal?.type === 'player' && <Modal title="Create player profile" onClose={() => setModal(null)}><PlayerForm onSubmit={handleAddPlayer} busy={busy} /></Modal>}
      {modal?.type === 'report' && <Modal title={`AI scouting report · ${modal.player.full_name}`} wide onClose={() => setModal(null)}><ReportBuilder player={modal.player} userId={session?.user?.id} onSave={async report => { await saveReport(session?.user?.id, modal.player.id, report); showToast('Report saved to your scouting workspace.'); }} /></Modal>}
      {modal?.type === 'note' && <Modal title={`Scout note · ${modal.player.full_name}`} onClose={() => setModal(null)}><NoteForm onSubmit={async (note, stage) => { await handleSaveNote(modal.player.id, note, stage); setModal(null); }} /></Modal>}
      {modal?.type === 'media' && <Modal title={`Player media · ${modal.player.full_name}`} onClose={() => setModal(null)}><MediaForm player={modal.player} userId={session?.user?.id} onDone={showToast} /></Modal>}
      {modal?.type === 'brief' && <Modal title="New recruitment brief" onClose={() => setModal(null)}><BriefForm onSubmit={brief => { setQuery(brief); setPage('discover'); setModal(null); showToast('Brief applied to your discovery search.'); }} /></Modal>}
    </div>
  );
}

function AuthScreen({ mode, setMode, onSubmit, busy, configured }) {
  return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="brand-mark">WTS</div><div><strong>WTS Scout</strong><span>Talent intelligence platform</span></div></div><div className="eyebrow"><span className="eyebrow-dot"/> SCOUT ACCESS</div><h1>{mode === 'signin' ? 'Welcome back.' : 'Build your scouting identity.'}</h1><p>{mode === 'signin' ? 'Sign in to your scouting workspace.' : 'Create a player, scout, club or academy account.'}</p>{!configured && <div className="warning-box"><Settings2 size={16}/><span>Supabase is not connected yet. Add the VITE_SUPABASE variables in Vercel to enable real authentication.</span></div>}<AuthForm mode={mode} onSubmit={onSubmit} busy={busy}/><div className="auth-switch">{mode === 'signin' ? 'New to WTS Scout?' : 'Already have an account?'} <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></div></div></div>;
}

function AuthForm({ mode, onSubmit, busy }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'scout' });
  return <form className="form-stack" onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
    {mode === 'signup' && <><label>Full name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name"/></label><label>Account type<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="scout">Scout</option><option value="player">Player</option><option value="club">Club</option><option value="academy">Academy</option></select></label></>}
    <label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com"/></label>
    <label>Password<input required minLength={8} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters"/></label>
    <button className="btn btn-primary full" disabled={busy}><LogIn size={16}/>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
  </form>;
}

function Dashboard({ players, watchlist, navigate, onSelect, onShortlist }) {
  const top = players.slice(0, 4);
  return <section className="content"><div className="hero"><div><div className="eyebrow"><span className="eyebrow-dot"/> SCOUT INTELLIGENCE</div><h1>Find the next player<br/><span>before everyone else.</span></h1><p>Move from discovery to evidence. Search your talent network, build shortlists, record live observations and generate structured recruitment reports.</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => navigate('discover')}><Radar size={17}/> Discover talent</button><button className="btn btn-secondary" onClick={() => navigate('crm')}><Activity size={17}/> Open CRM</button></div></div><div className="hero-visual"><div className="pitch-card"><div className="pitch-label">SCOUTING VIEW</div><div className="pitch-lines"/><div className="pitch-player p1">10</div><div className="pitch-player p2">8</div><div className="pitch-player p3">7</div><div className="pitch-player p4">11</div><div className="pitch-marker">EVIDENCE FIRST</div></div></div></div>
  <div className="metric-grid"><Metric icon={Users} label="Players in network" value={players.length.toString()} delta="Live profile database"/><Metric icon={Bookmark} label="Shortlisted" value={watchlist.length.toString()} delta="Your active watchlist"/><Metric icon={Target} label="Recruitment briefs" value="04" delta="2 high priority"/><Metric icon={Sparkles} label="AI reports" value="08" delta="Evidence-backed output"/></div>
  <div className="section-head"><div><div className="eyebrow">MATCHED TALENT</div><h2>Players to watch</h2></div><button className="text-btn" onClick={() => navigate('discover')}>View all <ArrowUpRight size={15}/></button></div>
  <div className="player-grid">{top.map(player => <PlayerCard key={player.id} player={player} onSelect={onSelect} shortlisted={watchlist.includes(player.id)} onShortlist={() => onShortlist(player)}/>)}</div>
  <div className="dashboard-bottom"><div className="intel-card"><div className="card-kicker"><Sparkles size={15}/> WTS MATCH ENGINE</div><h3>Turn a recruitment idea into a structured search.</h3><p>Describe the player you need in plain language, then review matching evidence rather than relying on a black-box conclusion.</p><button className="btn btn-dark" onClick={() => navigate('discover')}>Build recruitment brief <ChevronRight size={16}/></button></div><div className="activity-card"><div className="section-head small"><div><div className="eyebrow">WORKSPACE STATUS</div><h3>Scouting operations</h3></div><Zap size={17}/></div><StatusRow title="Discovery database" value="Online"/><StatusRow title="Player profiles" value={`${players.length} loaded`}/><StatusRow title="Shortlist workflow" value={`${watchlist.length} active`}/></div></div></section>;
}

function Discover({ players, query, setQuery, position, setPosition, onSelect, watchlist, onShortlist, openBrief }) {
  return <section className="content"><div className="page-heading"><div><div className="eyebrow">RECRUITMENT SEARCH</div><h1>Discover talent</h1><p>Search by football profile, geography and club context.</p></div><button className="btn btn-primary" onClick={openBrief}><Sparkles size={16}/> New recruitment brief</button></div><div className="filter-panel"><div className="filter-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, club, country, city…"/></div><select value={position} onChange={e => setPosition(e.target.value)}><option>All positions</option><option>GK</option><option>CB</option><option>LB</option><option>RB</option><option>CDM</option><option>CM</option><option>CAM</option><option>LW</option><option>RW</option><option>ST</option></select><div className="result-count"><strong>{players.length}</strong><span>matches</span></div></div><div className="result-bar"><span>Sorted by <strong>profile fit</strong></span><span>Verified network <ShieldCheck size={14}/></span></div><div className="discover-layout"><div className="results-list">{players.map(player => <SearchResult key={player.id} player={player} shortlisted={watchlist.includes(player.id)} onSelect={onSelect} onShortlist={() => onShortlist(player)}/>)}</div><aside className="brief-card"><div className="card-kicker"><Sparkles size={15}/> ACTIVE BRIEF</div><h3>Creative U19 attacker</h3><p>Right-footed attacking player with chance creation, game understanding and current competitive minutes.</p><div className="brief-tags"><span>U19</span><span>Attacking</span><span>Africa</span></div><div className="brief-line"><span>Profiles visible</span><strong>{players.length}</strong></div><button className="btn btn-secondary full" onClick={openBrief}>Edit brief</button></aside></div></section>;
}

function Players({ players, watchlist, onSelect, onShortlist, addPlayer }) { return <section className="content"><div className="page-heading"><div><div className="eyebrow">TALENT DATABASE</div><h1>Players</h1><p>Full profiles, football context, media and scouting history.</p></div><button className="btn btn-primary" onClick={addPlayer}><Plus size={17}/> Add player</button></div><div className="player-grid large">{players.map(player => <PlayerCard key={player.id} player={player} onSelect={onSelect} shortlisted={watchlist.includes(player.id)} onShortlist={() => onShortlist(player)}/>)}</div></section>; }

function Shortlist({ players, onSelect, onShortlist }) { return <section className="content"><div className="page-heading"><div><div className="eyebrow">RECRUITMENT PIPELINE</div><h1>My shortlist</h1><p>Players flagged for deeper evidence collection and next-step action.</p></div></div>{players.length ? <div className="player-grid">{players.map(player => <PlayerCard key={player.id} player={player} onSelect={onSelect} shortlisted onShortlist={() => onShortlist(player)}/>)}</div> : <EmptyState title="Your shortlist is empty" description="Add players from Discover Talent or the Players database."/>}</section>; }

function CRM({ players, watchlist, onSelect }) { const stages = ['watching', 'shortlisted', 'contacted', 'trial', 'signed']; return <section className="content"><div className="page-heading"><div><div className="eyebrow">SCOUTING CRM</div><h1>Recruitment pipeline</h1><p>Organise observation, follow-up and movement through your scouting process.</p></div></div><div className="crm-grid">{stages.map(stage => { const stagePlayers = players.filter(p => stage === 'watching' ? !watchlist.includes(p.id) : stage === 'shortlisted' ? watchlist.includes(p.id) : false).slice(0, 5); return <div className="crm-column" key={stage}><div className="crm-header"><span>{stage}</span><strong>{stagePlayers.length}</strong></div>{stagePlayers.map(player => <button className="crm-card" key={player.id} onClick={() => onSelect(player)}><div className="result-avatar">{initials(player.full_name)}</div><div><strong>{player.full_name}</strong><span>{player.position} · {player.current_club || 'Independent'}</span></div><ChevronRight size={15}/></button>)}{!stagePlayers.length && <div className="empty-column">No players</div>}</div>; })}</div></section>; }

function Reports({ players, onSelect, openReport }) { return <section className="content"><div className="page-heading"><div><div className="eyebrow">SCOUTING OUTPUT</div><h1>Reports</h1><p>Turn structured player evidence into clear recruitment intelligence.</p></div><button className="btn btn-primary" onClick={() => openReport(players[0])}><Sparkles size={16}/> Generate AI report</button></div><div className="report-list">{players.slice(0, 6).map(player => <div className="report-row" key={player.id}><div className="result-avatar">{initials(player.full_name)}</div><div className="report-row-main"><strong>{player.full_name}</strong><span>{player.position} · {player.current_club || 'Independent'}</span></div><div className="report-status">Screening ready</div><button className="icon-btn" onClick={() => { onSelect(player); openReport(player); }}><ArrowUpRight size={16}/></button></div>)}</div></section>; }

function OrganisationPage({ kind, onToast }) { const [form, setForm] = useState({ name: '', city: '', country: 'South Africa', description: '' }); return <section className="content"><div className="page-heading"><div><div className="eyebrow">WTS {kind.toUpperCase()} PORTAL</div><h1>{kind === 'club' ? 'Club workspace' : 'Academy workspace'}</h1><p>Create an organisation record and prepare the workspace for recruitment and player development.</p></div></div><div className="org-grid"><div className="org-card"><div className="org-icon">{kind === 'club' ? <Building2 size={22}/> : <GraduationCap size={22}/>}</div><h3>{kind === 'club' ? 'Club recruitment' : 'Academy development'}</h3><p>{kind === 'club' ? 'Recruitment briefs, squad needs, shared shortlists and scouting reports.' : 'Player progression, coach assessments, development notes and pathway tracking.'}</p><div className="trait-row large"><span>Team accounts</span><span>Shared workspaces</span><span>Verified profiles</span></div></div><form className="org-card form-stack" onSubmit={e => { e.preventDefault(); onToast(`${kind === 'club' ? 'Club' : 'Academy'} workspace saved.`); }}><label>Organisation name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={kind === 'club' ? 'Example FC' : 'Example Academy'}/></label><div className="two-col"><label>City<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Cape Town"/></label><label>Country<input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}/></label></div><label>Description<textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the organisation…"/></label><button className="btn btn-primary"><Plus size={16}/> Save workspace</button></form></div></section>; }

function PlayerCard({ player, onSelect, shortlisted, onShortlist }) { return <div className="player-card"><button className={`player-photo ${player.color || ''}`} onClick={() => onSelect(player)}><span>{initials(player.full_name)}</span><b>{player.position}</b></button><div className="player-card-body"><div className="player-card-top"><button className="plain-link" onClick={() => onSelect(player)}><h3>{player.full_name}</h3></button><button className={shortlisted ? 'save-btn saved' : 'save-btn'} onClick={onShortlist}><Bookmark size={14}/></button></div><div className="player-meta">{player.age ? `${player.age} · ` : ''}{player.current_club || 'Independent'} · {player.nationality || 'Unknown'}</div><div className="trait-row">{(player.strengths || []).slice(0, 3).map(t => <span key={t}>{t}</span>)}</div><div className="player-card-foot"><span>{player.city || 'Location not set'}</span>{player.fit_score ? <span className="fit">{player.fit_score}% fit</span> : <span>Screening</span>}</div></div></div>; }

function SearchResult({ player, shortlisted, onSelect, onShortlist }) { return <button className="search-result" onClick={() => onSelect(player)}><div className="result-avatar">{initials(player.full_name)}</div><div><div className="result-name">{player.full_name}{player.verified && <ShieldCheck size={12}/>}</div><div className="result-meta">{player.position}{player.secondary_position ? ` / ${player.secondary_position}` : ''} · {player.current_club || 'Independent'} · {player.nationality || 'Unknown'}</div><div className="result-traits">{(player.strengths || []).slice(0, 3).map(t => <em key={t}>{t}</em>)}</div></div><div className="result-score">{player.fit_score ? <><strong>{player.fit_score}%</strong><span>fit</span></> : <><strong>—</strong><span>screen</span></>}</div><span className="result-location">{player.city || '—'}</span><span className={shortlisted ? 'mini-save active' : 'mini-save'} onClick={e => { e.stopPropagation(); onShortlist(); }}><Bookmark size={14}/></span></button>; }

function PlayerDrawer({ player, shortlisted, onClose, onShortlist, openReport, openNote, openMedia }) { const [tab, setTab] = useState('overview'); const [notes, setNotes] = useState([]); useEffect(() => { loadNotes(null, player.id).then(setNotes).catch(() => {}); }, [player.id]); return <aside className="drawer"><div className="drawer-head"><div><div className="eyebrow">PLAYER PROFILE</div><h2>{player.full_name}</h2><span>{player.position}{player.secondary_position ? ` · ${player.secondary_position}` : ''} · {player.current_club || 'Independent'}</span></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div><div className="drawer-profile"><div className="big-avatar">{initials(player.full_name)}</div><div><strong>{player.nationality || 'Unknown nationality'}</strong><span>{player.city || 'Location not set'}</span><span>{player.preferred_foot || 'Foot not set'} foot</span></div></div><div className="drawer-actions"><button className={shortlisted ? 'btn btn-dark active-action' : 'btn btn-secondary'} onClick={onShortlist}><Bookmark size={15}/>{shortlisted ? 'Shortlisted' : 'Shortlist'}</button><button className="btn btn-secondary" onClick={openReport}><Sparkles size={15}/> AI report</button></div><div className="tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}>Evidence</button><button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>Notes</button></div>{tab === 'overview' && <div className="drawer-section"><div className="profile-stat-grid"><Stat label="Age" value={player.age || '—'}/><Stat label="Position" value={player.position || '—'}/><Stat label="Minutes" value={player.minutes || 0}/><Stat label="Goals" value={player.goals || 0}/><Stat label="Assists" value={player.assists || 0}/><Stat label="Status" value={player.status || 'Emerging'}/></div><div className="drawer-block"><div className="drawer-block-head"><strong>Player summary</strong><span>Profile</span></div><p>{player.bio || 'No biography has been added yet.'}</p></div><div className="drawer-block"><div className="drawer-block-head"><strong>Strengths</strong><span>{(player.strengths || []).length}</span></div><div className="trait-row large">{(player.strengths || []).map(t => <span key={t}>{t}</span>)}</div></div></div>}{tab === 'evidence' && <div className="drawer-section"><div className="evidence-card"><CheckCircle2 size={18}/><div><strong>Profile evidence</strong><p>Use match footage, live observations and verified statistics to validate this profile before recruitment decisions.</p></div></div><div className="evidence-actions"><button className="btn btn-secondary" onClick={openMedia}><Upload size={15}/> Add media</button><button className="btn btn-secondary" onClick={openNote}><Plus size={15}/> Add observation</button></div></div>}{tab === 'notes' && <div className="drawer-section"><div className="drawer-block"><div className="drawer-block-head"><strong>Scouting notes</strong><button className="text-btn" onClick={openNote}>Add <Plus size={14}/></button></div>{notes.length ? notes.map(note => <div className="note-row" key={note.id}><span>{note.stage}</span><p>{note.note}</p></div>) : <EmptyInline text="No notes yet. Add your first observation."/>}</div></div>}</aside>; }

function ReportBuilder({ player, onSave }) { const [brief, setBrief] = useState('Find a creative attacking midfielder with strong chance creation, press resistance and development upside.'); const [loading, setLoading] = useState(false); const [report, setReport] = useState(null); const generate = async () => { setLoading(true); try { const res = await fetch('/api/scout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player, brief }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'AI report failed.'); setReport(data); } catch (error) { setReport({ error: error.message }); } finally { setLoading(false); } }; return <div className="report-builder"><label>Recruitment brief<textarea rows="4" value={brief} onChange={e => setBrief(e.target.value)}/></label><button className="btn btn-primary" onClick={generate} disabled={loading}><Sparkles size={16}/>{loading ? 'Analysing evidence…' : 'Generate report'}</button>{report?.error && <div className="warning-box"><X size={16}/><span>{report.error}</span></div>}{report && !report.error && <div className="report-output"><div className="report-score"><span>Internal screening fit</span><strong>{report.fitScore ?? '—'}%</strong></div><section><div className="card-kicker">SUMMARY</div><p>{report.summary}</p></section><ReportList title="Strengths" items={report.strengths}/><ReportList title="Development areas" items={report.developmentAreas}/><section><div className="card-kicker">TACTICAL FIT</div><p>{report.tacticalFit}</p></section><ReportList title="Evidence to verify" items={report.evidenceToVerify}/><section><div className="card-kicker">NEXT OBSERVATION</div><p>{report.nextObservation}</p></section><button className="btn btn-dark full" onClick={() => onSave({ title: `WTS Scout Report · ${player.full_name}`, content: report, fitScore: report.fitScore })}>Save report to workspace</button></div>}</div>; }

function ReportList({ title, items = [] }) { return <section><div className="card-kicker">{title}</div><div className="report-bullets">{items.map(item => <div key={item}><CheckCircle2 size={14}/><span>{item}</span></div>)}</div></section>; }

function PlayerForm({ onSubmit, busy }) { const [form, setForm] = useState({ name: '', position: 'CAM', secondary: '', foot: 'Right', nationality: 'South Africa', city: 'Cape Town', club: '', league: '', age: '', strengths: 'Vision, Control, Progression', bio: '' }); const set = (key, value) => setForm({ ...form, [key]: value }); return <form className="form-stack" onSubmit={e => { e.preventDefault(); onSubmit(form); }}><div className="two-col"><label>Full name<input required value={form.name} onChange={e => set('name', e.target.value)}/></label><label>Age<input type="number" min="6" max="50" value={form.age} onChange={e => set('age', e.target.value)}/></label></div><div className="two-col"><label>Primary position<select value={form.position} onChange={e => set('position', e.target.value)}><option>GK</option><option>CB</option><option>LB</option><option>RB</option><option>CDM</option><option>CM</option><option>CAM</option><option>LW</option><option>RW</option><option>ST</option></select></label><label>Preferred foot<select value={form.foot} onChange={e => set('foot', e.target.value)}><option>Right</option><option>Left</option><option>Both</option></select></label></div><div className="two-col"><label>Nationality<input value={form.nationality} onChange={e => set('nationality', e.target.value)}/></label><label>City<input value={form.city} onChange={e => set('city', e.target.value)}/></label></div><label>Current club<input value={form.club} onChange={e => set('club', e.target.value)} placeholder="Current club or academy"/></label><label>Strengths<input value={form.strengths} onChange={e => set('strengths', e.target.value)}/></label><label>Bio<textarea rows="4" value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Football profile summary…"/></label><button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create player profile'}</button></form>; }

function NoteForm({ onSubmit }) { const [note, setNote] = useState(''); const [stage, setStage] = useState('watching'); return <form className="form-stack" onSubmit={e => { e.preventDefault(); onSubmit(note, stage); }}><label>Pipeline stage<select value={stage} onChange={e => setStage(e.target.value)}><option value="watching">Watching</option><option value="shortlisted">Shortlisted</option><option value="contacted">Contacted</option><option value="trial">Trial</option><option value="signed">Signed</option></select></label><label>Observation<textarea required rows="7" value={note} onChange={e => setNote(e.target.value)} placeholder="What did you observe? Keep this evidence-based."/></label><button className="btn btn-primary">Save observation</button></form>; }

function MediaForm({ player, userId, onDone }) { const [busy, setBusy] = useState(false); const handle = async e => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); try { const url = await uploadPlayerMedia(userId, player.id, file); onDone(`Uploaded ${file.name}`); if (url) window.open(url, '_blank', 'noopener,noreferrer'); } catch (error) { onDone(error.message || 'Upload failed.'); } finally { setBusy(false); } }; return <div className="media-drop"><Upload size={28}/><strong>{busy ? 'Uploading…' : 'Upload player media'}</strong><p>Use Supabase Storage for photos, PDFs and highlight media.</p><label className="btn btn-secondary">Choose file<input type="file" accept="image/*,video/*,.pdf" hidden onChange={handle}/></label></div>; }

function BriefForm({ onSubmit }) { const [text, setText] = useState(''); return <form className="form-stack" onSubmit={e => { e.preventDefault(); onSubmit(text); }}><label>Describe the player you need<textarea required rows="8" value={text} onChange={e => setText(e.target.value)} placeholder="Example: U19 right-footed CAM in Africa with strong chance creation, current competitive minutes and press resistance."/></label><button className="btn btn-primary"><Sparkles size={16}/> Apply brief</button></form>; }

function Modal({ title, children, onClose, wide }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className={wide ? 'modal wide' : 'modal'} onMouseDown={e => e.stopPropagation()}><div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><X size={17}/></button></div>{children}</div></div>; }
function Metric({ icon: Icon, label, value, delta }) { return <div className="metric-card"><div className="metric-icon"><Icon size={17}/></div><div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-delta">{delta}</div></div></div>; }
function StatusRow({ title, value }) { return <div className="status-row"><span><span className="status-dot"/>{title}</span><strong>{value}</strong></div>; }
function Stat({ label, value }) { return <div className="profile-stat"><span>{label}</span><strong>{value}</strong></div>; }
function EmptyState({ title, description }) { return <div className="empty-page"><div className="empty-icon"><Bookmark size={24}/></div><div className="eyebrow">WTS SCOUT</div><h1>{title}</h1><p>{description}</p></div>; }
function EmptyInline({ text }) { return <div className="empty-inline">{text}</div>; }

createRoot(document.getElementById('root')).render(<App />);
