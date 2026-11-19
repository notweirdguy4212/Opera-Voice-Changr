import React, { useMemo, useRef, useState } from 'react';
import { Download, FolderPlus, Import, Save, Trash2, UserRound, Zap } from 'lucide-react';

const KEY = 'opera_voice_profiles_v2';
const readProfiles = () => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item.name === 'string' && item.voice && item.effects) : [];
  } catch { return []; }
};
const persist = (items) => localStorage.setItem(KEY, JSON.stringify(items));

export default function VoiceProfileStudio({ voice, effects, onApply }) {
  const [profiles, setProfiles] = useState(readProfiles);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);
  const sorted = useMemo(() => [...profiles].sort((a, b) => a.name.localeCompare(b.name)), [profiles]);

  const save = () => {
    const clean = name.trim().slice(0, 40);
    if (!clean) { setMessage('Enter a profile name first.'); return; }
    const next = [...profiles.filter((item) => item.name.toLowerCase() !== clean.toLowerCase()), {
      id: crypto.randomUUID?.() || `${Date.now()}`, name: clean, voice, effects, updatedAt: new Date().toISOString(),
    }];
    setProfiles(next); persist(next); setName(''); setMessage(`Saved “${clean}”.`);
  };
  const remove = (id) => { const next = profiles.filter((item) => item.id !== id); setProfiles(next); persist(next); };
  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ format: 'opera-voice-profiles', version: 2, profiles }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'opera-voice-profiles.json'; a.click(); URL.revokeObjectURL(url);
  };
  const importFile = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.profiles;
      if (!Array.isArray(incoming)) throw new Error('No profile list found.');
      const valid = incoming.filter((item) => item && typeof item.name === 'string' && item.voice && item.effects).slice(0, 100);
      const merged = [...profiles];
      valid.forEach((item) => { const index = merged.findIndex((p) => p.name.toLowerCase() === item.name.toLowerCase()); if (index >= 0) merged[index] = { ...item, id: merged[index].id }; else merged.push({ ...item, id: item.id || `${Date.now()}-${merged.length}` }); });
      setProfiles(merged); persist(merged); setMessage(`Imported ${valid.length} profile(s).`);
    } catch (error) { setMessage(`Import failed: ${error.message}`); }
  };

  return (
    <section className="opera-compat panel p-4 sm:p-5" aria-labelledby="profile-studio-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="panel-kicker">OPERA PROFILE VAULT</p><h2 id="profile-studio-title" className="panel-title">Custom voice profiles</h2><p className="mt-1 text-xs leading-5 text-fg-muted">Save your current voice and effects together. Profiles stay on this device until you export them.</p></div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-control-hover"><UserRound className="h-5 w-5" /></span>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Name this voice profile" className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-sunken px-3 text-sm text-fg outline-none focus:border-line-strong" aria-label="Profile name" />
        <button type="button" onClick={save} className="frost-control inline-flex min-h-11 items-center justify-center gap-2 px-4 text-xs font-semibold"><Save className="h-4 w-4" /> Save current</button>
      </div>
      {message && <p role="status" className="mt-2 text-xs text-fg-muted">{message}</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((profile) => (
          <article key={profile.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-raised p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-control-hover"><Zap className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-fg">{profile.name}</p><p className="text-[10px] text-fg-muted">Saved voice + effects</p></div>
            <button type="button" onClick={() => onApply(profile)} className="frost-control min-h-9 px-3 text-xs font-semibold">Load</button>
            <button type="button" onClick={() => remove(profile.id)} className="frost-control min-h-9 px-2 text-fg-muted" aria-label={`Delete ${profile.name}`}><Trash2 className="h-4 w-4" /></button>
          </article>
        ))}
        {profiles.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-xs text-fg-muted sm:col-span-2 xl:col-span-3">No custom profiles yet. Tune your voice and effects, then save a profile.</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={exportAll} className="frost-control inline-flex min-h-10 items-center gap-2 px-3 text-xs"><Download className="h-4 w-4" /> Export profiles</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="frost-control inline-flex min-h-10 items-center gap-2 px-3 text-xs"><Import className="h-4 w-4" /> Import profiles</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { if (event.target.files?.[0]) importFile(event.target.files[0]); event.target.value = ''; }} />
      </div>
    </section>
  );
}
