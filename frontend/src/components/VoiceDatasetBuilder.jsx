import React, { useMemo, useState } from 'react';
import { Archive, LoaderCircle } from 'lucide-react';
import { createZipStore } from '../lib/zipStore';

const safeName = (value) => value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'voice';

export default function VoiceDatasetBuilder({ takes = [] }) {
  const [selected, setSelected] = useState([]);
  const [speakerLabel, setSpeakerLabel] = useState('my-voice');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const readyTakes = useMemo(() => takes.filter((take) => take.blob && !take.pending), [takes]);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const exportDataset = async () => {
    const chosen = readyTakes.filter((take) => selected.includes(take.id));
    if (!chosen.length) return;
    setBusy(true); setNotice('');
    try {
      const label = safeName(speakerLabel);
      const files = [];
      const clips = [];
      for (let i = 0; i < chosen.length; i += 1) {
        const take = chosen[i]; const filename = `audio/${String(i + 1).padStart(3, '0')}-${safeName(take.name)}.wav`;
        files.push({ name: filename, data: take.blob });
        clips.push({ file: filename, duration_seconds: Number(take.seconds.toFixed(3)), sample_format: 'WAV PCM', created_at: new Date(take.createdAt).toISOString() });
      }
      files.push({ name: 'dataset.json', data: new Blob([JSON.stringify({ format: 'opera-voice-dataset-v1', speaker_label: label, created_at: new Date().toISOString(), clips, training_notice: 'Use only recordings of your own voice or voices for which you have explicit permission.' }, null, 2)], { type: 'application/json' }) });
      const archive = await createZipStore(files);
      const url = URL.createObjectURL(archive); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `opera-voice-dataset-${label}.zip`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNotice(`Exported ${chosen.length} recording(s). This is a training dataset package, not a trained voice model.`);
    } catch (error) { setNotice(error.message || 'Dataset export failed.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-3"><div className="rounded-lg border border-line bg-control p-2"><Archive className="h-5 w-5" /></div><div><p className="panel-kicker">Voice preparation</p><h2 className="panel-title">Training dataset builder</h2></div></div>
      <p className="mt-3 text-sm text-fg-muted">Package your saved WAV takes with a manifest for a compatible external training workflow. Opera does not train neural voice models in this screen.</p>
      <label className="mt-4 block text-xs font-medium text-fg-muted" htmlFor="dataset-speaker">Dataset label</label>
      <input id="dataset-speaker" value={speakerLabel} onChange={(event) => setSpeakerLabel(event.target.value)} maxLength={60} className="native-select-safe mt-1 w-full rounded border border-line bg-input px-3 py-2 text-sm" />
      <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
        {readyTakes.length === 0 ? <p className="text-xs text-fg-faint">No saved recordings yet. Record a few clean samples first.</p> : readyTakes.map((take) => <label key={take.id} className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={selected.includes(take.id)} onChange={() => toggle(take.id)} /> <span className="min-w-0 flex-1 truncate">{take.name}</span><span className="text-xs text-fg-faint">{Math.round(take.seconds)}s</span></label>)}
      </div>
      <button type="button" onClick={exportDataset} disabled={busy || selected.length === 0} className="frost-control mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 px-4 text-sm font-semibold">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Export selected clips</button>
      {notice && <p className="mt-3 text-xs text-fg-muted" role="status">{notice}</p>}
      <p className="mt-3 text-[11px] text-fg-faint">Use only your own voice or recordings you have explicit permission to use. Do not use voice models to impersonate people or mislead others.</p>
    </section>
  );
}
