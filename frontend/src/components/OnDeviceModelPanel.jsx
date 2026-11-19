import React, { useEffect, useState } from 'react';
import { Cpu, Download, LoaderCircle, Power, Trash2 } from 'lucide-react';
import { isNativeAudioAvailable, loadNativeOnnxModel, loadStoredNativeOnnxModel, listNativeOnnxModels, unloadNativeOnnxModel } from '../lib/nativeAudio';

export default function OnDeviceModelPanel({ pipeline }) {
  const [model, setModel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [installed, setInstalled] = useState([]);
  const [enhancements, setEnhancements] = useState({ noiseSuppression: true, echoCancellation: false, automaticGainControl: true });
  useEffect(() => { if (native) listNativeOnnxModels().then(setInstalled).catch(() => {}); }, [native]);
  const native = isNativeAudioAvailable();

  const load = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const info = await loadNativeOnnxModel(file);
      setModel({ name: info.name, contract: info.contract });
      pipeline.setNativeModelReady(true);
      setInstalled(await listNativeOnnxModels());
      pipeline.setNativeInference(false);
      setMessage('Model loaded into the Android on-device runtime.');
    } catch (err) { setError(err.message || 'Model could not be loaded.'); }
    finally { setBusy(false); }
  };

  const loadStored = async (name) => {
    setBusy(true); setError('');
    try { const info = await loadStoredNativeOnnxModel(name); setModel({ name: info.name, contract: info.contract }); pipeline.setNativeModelReady(true); setMessage('Installed model loaded.'); pipeline.setNativeInference(false); }
    catch (err) { setError(err.message || 'Could not load installed model.'); }
    finally { setBusy(false); }
  };

  const unload = async () => {
    setBusy(true); setError('');
    try { await unloadNativeOnnxModel(); pipeline.setNativeInference(false); pipeline.setNativeModelReady(false); setModel(null); setMessage('Local model unloaded.'); }
    catch (err) { setError(err.message || 'Could not unload model.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-line bg-control p-2"><Cpu className="h-5 w-5" /></div>
        <div><p className="panel-kicker">Android inference</p><h2 className="panel-title">On-device model runtime</h2></div>
      </div>
      {!native ? (
        <p className="mt-4 text-sm text-fg-muted">This model runtime is available in the native Android app. Desktop conversion continues to use the configured backend.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-fg-muted">Load a compatible lightweight ONNX audio model. The supported contract is mono float32 waveform input and output shaped [1, N]. General RVC/Seed-VC checkpoints are not compatible with this lightweight runner.</p>
          <div className="mt-4 grid gap-2 rounded-md border border-line bg-control p-3 sm:grid-cols-3">
            {[["noiseSuppression", "Noise suppression"], ["echoCancellation", "Echo cancellation"], ["automaticGainControl", "Auto gain control"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs text-fg"><input type="checkbox" checked={enhancements[key]} disabled={!pipeline.isRunning} onChange={async (event) => { const next = { ...enhancements, [key]: event.target.checked }; setEnhancements(next); try { await pipeline.setNativeEnhancements(next); } catch (err) { setError(err.message); } }} />{label}</label>)}
          </div>
          {!pipeline.isRunning && <p className="mt-2 text-[11px] text-fg-faint">Start the Android audio stream to configure the device's available native audio effects.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="chip-button inline-flex cursor-pointer items-center gap-2">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Load ONNX model
              <input type="file" accept=".onnx,application/octet-stream" className="sr-only" disabled={busy} onChange={load} />
            </label>
            {model && <button type="button" className="chip-button inline-flex items-center gap-2" disabled={busy} onClick={unload}><Trash2 className="h-4 w-4" />Unload</button>}
          </div>
          {!model && installed.length > 0 && <div className="mt-4"><p className="mb-2 text-xs font-medium text-fg-muted">Installed models</p><div className="flex flex-wrap gap-2">{installed.map((name) => <button key={name} type="button" className="chip-button" disabled={busy} onClick={() => loadStored(name)}>{name}</button>)}</div></div>}
          {model && <div className="mt-4 rounded-md border border-line bg-control p-3">
            <p className="text-sm font-semibold text-fg">{model.name}</p>
            <p className="mt-1 break-all text-[11px] text-fg-faint">{model.contract}</p>
            <button type="button" className="frost-control mt-3 inline-flex items-center gap-2 px-3 py-2 text-xs" disabled={!pipeline.isRunning || busy} onClick={() => pipeline.setNativeInference(!pipeline.nativeInferenceEnabled)} aria-pressed={pipeline.nativeInferenceEnabled}>
              <Power className="h-3.5 w-3.5" />{pipeline.nativeInferenceEnabled ? 'Disable local processing' : 'Enable local processing'}
            </button>
            {!pipeline.isRunning && <p className="mt-2 text-[11px] text-fg-faint">Start the native audio stream before enabling local inference.</p>}
          </div>}
          {message && <p className="mt-3 text-xs text-ok-fg" role="status">{message}</p>}
          {error && <p className="mt-3 text-xs text-danger-fg" role="alert">{error}</p>}
          <p className="mt-3 text-[11px] text-fg-faint">Model files remain in Opera's private app storage. Import only models you have permission to use. First inference can add latency; if processing falls behind, incoming chunks are bypassed rather than queued indefinitely.</p>
        </>
      )}
    </section>
  );
}
