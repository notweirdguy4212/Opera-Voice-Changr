import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, LoaderCircle, Plus, Search, Sparkles, Trash2, Users, X } from 'lucide-react';
import { fetchPresets, savePreset, deletePreset } from '../lib/api';

const FAVOURITES_KEY = 'opera_voice_favourites_v1';
const LIBRARY_CACHE_KEY = 'opera_voice_library_cache_v1';
const PAGE_SIZE = 24;

function normalizePresetList(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item.id === 'string' && item.id.length > 0
    && typeof item.name === 'string' && item.name.trim().length > 0
    && item.settings && typeof item.settings === 'object' && !Array.isArray(item.settings));
}

function readLibraryCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(LIBRARY_CACHE_KEY) || 'null');
    return cached && Array.isArray(cached.builtin) && Array.isArray(cached.user)
      ? { builtin: normalizePresetList(cached.builtin), user: normalizePresetList(cached.user) }
      : { builtin: [], user: [] };
  } catch { return { builtin: [], user: [] }; }
}
const TABS = ['All voices', 'My voices', 'Community', 'Favourites'];
const AVATAR_BACKGROUNDS = [
  'from-emerald-500/30 to-teal-900/70', 'from-violet-500/30 to-indigo-900/70',
  'from-amber-500/30 to-orange-900/70', 'from-sky-500/30 to-blue-900/70',
  'from-rose-500/30 to-pink-900/70', 'from-fuchsia-500/30 to-purple-900/70',
];

function readFavourites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVOURITES_KEY) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch { return new Set(); }
}

function VoiceCard({ preset, active, favourite, onApply, onFavourite, onDelete }) {
  const emoji = preset.emoji || '🎙️';
  const initials = preset.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const avatarHash = [...preset.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const avatarPath = `/voice-avatars/avatar-${String((avatarHash % 12) + 1).padStart(2, '0')}.webp`;
  const gradient = AVATAR_BACKGROUNDS[(preset.name.length + preset.name.charCodeAt(0)) % AVATAR_BACKGROUNDS.length];
  return (
    <article className={`voice-library-card group relative min-w-0 rounded-2xl border p-3 transition-all ${active ? 'border-emerald-400/80 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(52,211,153,.18)]' : 'border-line bg-panel hover:border-emerald-500/40 hover:bg-control-hover'}`}>
      <button type="button" onClick={() => onApply(preset)} aria-pressed={active} className="flex w-full flex-col items-center text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400">
        <span className={`relative mb-3 flex h-[76px] w-[76px] items-center justify-center rounded-full border border-white/10 bg-gradient-to-br ${gradient} text-3xl shadow-inner`} aria-hidden="true">
          {emoji}
          <img src={avatarPath} alt="" loading="lazy" className="absolute inset-0 h-full w-full rounded-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          <span className="absolute -bottom-1 -right-1 rounded-full border border-line bg-sunken px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-fg-muted">{initials}</span>
        </span>
        <span className="line-clamp-2 min-h-9 text-sm font-semibold text-fg">{preset.name}</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-fg-faint">{preset.category || (preset.builtin ? 'Opera original' : 'My voice')}</span>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2">
        <button type="button" onClick={() => onFavourite(preset.id)} aria-label={favourite ? `Remove ${preset.name} from favourites` : `Add ${preset.name} to favourites`} aria-pressed={favourite} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${favourite ? 'text-amber-300' : 'text-fg-faint hover:text-amber-300'}`}>
          <Heart className="h-4 w-4" fill={favourite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" onClick={() => onApply(preset)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-control-hover text-fg-secondary hover:bg-emerald-500/15 hover:text-emerald-300'}`}>
          {active ? 'Selected' : 'Use voice'}
        </button>
        {onDelete ? <button type="button" onClick={() => onDelete(preset)} aria-label={`Delete ${preset.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-faint hover:bg-danger-soft hover:text-danger-fg"><Trash2 className="h-4 w-4" /></button> : null}
      </div>
    </article>
  );
}

function PresetBar({ activePresetId, onApplyPreset, getCurrentSettings, refreshRevision = 0 }) {
  const [presets, setPresets] = useState(readLibraryCache);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const loadSequence = useRef(0);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [tab, setTab] = useState('All voices');
  const [favourites, setFavourites] = useState(readFavourites);

  const load = useCallback(async () => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    try {
      const data = await fetchPresets();
      if (requestId !== loadSequence.current) return;
      const next = { builtin: normalizePresetList(data?.builtin), user: normalizePresetList(data?.user) };
      setPresets(next);
      try { localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(next)); } catch { /* cache is optional */ }
      setError(null);
    } catch {
      if (requestId !== loadSequence.current) return;
      const cached = readLibraryCache();
      if (cached.builtin.length || cached.user.length) {
        setPresets(cached);
        setError('Offline library: showing your last saved voice list. Reconnect to save or refresh voices.');
      } else {
        setError('Cannot connect to the Opera voice service. Start the backend and retry.');
      }
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshRevision]);
  useEffect(() => { try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...favourites])); } catch { /* optional preference */ } }, [favourites]);

  const allVoices = useMemo(() => [
    ...presets.builtin.map((preset) => ({ ...preset, builtin: true })),
    ...presets.user.map((preset) => ({ ...preset, builtin: false })),
  ], [presets]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(allVoices.map((p) => p.category || (p.builtin ? 'Opera original' : 'My voice')))).sort()], [allVoices]);
  const visibleVoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allVoices.filter((preset) => {
      const presetCategory = preset.category || (preset.builtin ? 'Opera original' : 'My voice');
      const haystack = `${preset.name} ${preset.description || ''} ${presetCategory}`.toLowerCase();
      const categoryMatch = category === 'All' || presetCategory === category;
      const tabMatch = tab === 'All voices' || (tab === 'My voices' && !preset.builtin) || (tab === 'Favourites' && favourites.has(preset.id)) || (tab === 'Community' && preset.community === true);
      return categoryMatch && tabMatch && (!query || haystack.includes(query));
    });
  }, [allVoices, category, favourites, search, tab]);

  const handleSave = async () => {
    const name = saveName.trim(); if (!name) return;
    setSaving(true); setError(null);
    try { await savePreset(name, getCurrentSettings()); setSaveName(''); setShowSave(false); setTab('My voices'); await load(); }
    catch (err) { setError(err.message || 'Failed to save voice'); }
    finally { setSaving(false); }
  };
  const handleDelete = async (preset) => {
    try { await deletePreset(preset.id); setFavourites((current) => { const next = new Set(current); next.delete(preset.id); return next; }); await load(); }
    catch (err) { setError(err.message || 'Failed to delete voice'); }
  };
  const toggleFavourite = (id) => setFavourites((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, category, tab]);
  const pagedVoices = visibleVoices.slice(0, visibleCount);
  const remainingVoices = Math.max(0, visibleVoices.length - pagedVoices.length);

  return (
    <section id="presets" className="voice-library-panel panel scroll-mt-20 overflow-hidden p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-300"><Sparkles className="h-4 w-4" /><p className="panel-kicker !mt-0">OPERA VOICE LIBRARY</p></div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">Find your sound.</h2>
          <p className="mt-1 max-w-xl text-xs text-fg-muted">Explore original voice styles, save favourites and build your own collection.</p>
        </div>
        <div className="flex items-center gap-2">
          {showSave ? <div className="flex items-center gap-2">
            <input value={saveName} onChange={(event) => setSaveName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSave(); if (event.key === 'Escape') setShowSave(false); }} placeholder="Name your voice" aria-label="Voice name" maxLength={40} autoFocus className="w-36 min-w-0 rounded-lg border border-line-strong bg-input px-3 py-2 text-sm text-fg sm:w-44" />
            <button onClick={handleSave} disabled={saving || !saveName.trim()} className="chip-button inline-flex items-center gap-1.5">{saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}Save</button>
            <button onClick={() => setShowSave(false)} className="chip-button inline-flex h-8 w-8 items-center justify-center !p-0" aria-label="Cancel"><X className="h-4 w-4" /></button>
          </div> : <button onClick={() => setShowSave(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-950/30 hover:bg-emerald-300"><Plus className="h-4 w-4" /> Create voice</button>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Voice collections">
          {TABS.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${tab === item ? 'bg-control-hover text-fg ring-1 ring-line-strong' : 'text-fg-muted hover:bg-control-hover hover:text-fg'}`}>
            {item === 'Community' ? <Users className="mr-1 inline h-3.5 w-3.5" /> : item === 'Favourites' ? <Heart className="mr-1 inline h-3.5 w-3.5" /> : null}{item}
          </button>)}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md">
          <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search voices" aria-label="Search voice library" className="w-full rounded-full border border-line-strong bg-input py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-faint" /></label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter voice category" className="max-w-36 rounded-full border border-line-strong bg-input px-3 py-2 text-xs text-fg"><option value="All">All styles</option>{categories.filter((item) => item !== 'All').map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
      </div>

      {error && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-control-hover/50 px-3 py-2"><p className="text-xs text-danger-fg" role="status">{error}</p><button type="button" onClick={load} disabled={loading} className="chip-button inline-flex items-center gap-1.5">{loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}Retry connection</button></div>}
      <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-fg-muted" aria-live="polite">{loading && visibleVoices.length === 0 ? 'Loading voice library…' : `${pagedVoices.length} of ${visibleVoices.length} voices`} <span className="text-fg-faint">· {presets.builtin.length} built-in · {presets.user.length} personal · {favourites.size} favourites</span></p><span className="hidden items-center gap-1 text-[10px] text-fg-faint sm:inline-flex"><Sparkles className="h-3 w-3" /> Original presets</span></div>
      {visibleVoices.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {pagedVoices.map((preset) => <VoiceCard key={preset.id} preset={preset} active={activePresetId === preset.id} favourite={favourites.has(preset.id)} onApply={onApplyPreset} onFavourite={toggleFavourite} onDelete={!preset.builtin ? handleDelete : null} />)}
      </div> : <div className="mt-4 rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center"><div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-control-hover text-2xl">🎙️</div><p className="text-sm font-semibold text-fg">No voices in this collection yet</p><p className="mt-1 text-xs text-fg-muted">Try another filter, save a personal preset, or add a compatible model.</p></div>}
      {remainingVoices > 0 && <div className="mt-5 flex flex-col items-center gap-2"><button type="button" onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, visibleVoices.length))} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20">Load more voices <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs">+{Math.min(PAGE_SIZE, remainingVoices)}</span></button><span className="text-[10px] text-fg-faint">{remainingVoices} more matching voices</span></div>}
      {visibleCount > PAGE_SIZE && <div className="mt-2 flex justify-center"><button type="button" onClick={() => setVisibleCount(PAGE_SIZE)} className="text-xs text-fg-muted underline decoration-dotted underline-offset-4 hover:text-fg">Show fewer</button></div>}
      <p className="mt-4 border-t border-line pt-3 text-[10px] leading-relaxed text-fg-faint">Opera presets are original audio-processing recipes, not celebrity voice clones. Only use voice models you own or have explicit permission to use. Community sharing is not connected in this build.</p>
    </section>
  );
}

export default memo(PresetBar);
