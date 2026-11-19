import React, { useEffect, useRef, useState } from 'react';

export default function StreamDiagnostics({ streamInfo, playbackStats, transport = {}, serverMs = 0 }) {
  const previous = useRef(0);
  const [recentIssue, setRecentIssue] = useState(false);
  const running = Boolean(streamInfo);
  const loss = (transport.dropped || 0) + (transport.timedOut || 0)
    + (playbackStats?.underruns || 0) + (playbackStats?.droppedSamples || 0);
  useEffect(() => {
    if (!running || loss < previous.current) { previous.current = loss; setRecentIssue(false); return undefined; }
    if (loss === previous.current) return undefined;
    previous.current = loss;
    setRecentIssue(true);
    const timer = setTimeout(() => setRecentIssue(false), 5000);
    return () => clearTimeout(timer);
  }, [loss, running]);

  const rate = streamInfo?.sampleRate || 0;
  const chunkMs = rate ? streamInfo.chunkSize / rate * 1000 : 0;
  const queuedMs = (transport.pending || 0) * chunkMs;
  const processingOverBudget = Boolean(chunkMs && serverMs > chunkMs);
  const hasTransportLoss = (transport.dropped || 0) + (transport.timedOut || 0) > 0;
  const hasPlaybackLoss = (playbackStats?.underruns || 0) > 0 || (playbackStats?.droppedSamples || 0) > 0;
  const coach = !running ? null
    : processingOverBudget ? { title: 'Processing is slower than real time', advice: 'Choose a lighter voice model or F0 method, disable optional effects, or increase the audio buffer.' }
      : queuedMs > chunkMs * 3 ? { title: 'The connection queue is building up', advice: 'Check Wi-Fi stability, close bandwidth-heavy apps, or switch to the Balanced/Stable performance profile.' }
        : hasPlaybackLoss ? { title: 'Playback is struggling to keep up', advice: 'Use headphones, select a stable output device, and increase the buffer one step.' }
          : hasTransportLoss || recentIssue ? { title: 'Audio frames were delayed or dropped', advice: 'Check network quality and CPU load. A larger buffer may improve continuity at the cost of latency.' }
            : null;
  const ms = (value) => rate && value != null ? `${Math.round(value)} ms` : '--';
  const rows = [
    ['Capture chunk', ms(chunkMs)],
    ['Queued capture', ms((transport.pending || 0) * chunkMs)],
    ['Playback buffered', ms(playbackStats == null ? null : playbackStats.bufferedSamples / rate * 1000)],
    ['Browser output latency', ms(streamInfo?.outputLatency == null ? null : streamInfo.outputLatency * 1000)],
    ['In flight / queued', rate ? `${transport.inFlight || 0} / ${transport.pending || 0}` : '--'],
    ['Dropped / timed out frames', rate ? `${transport.dropped || 0} / ${transport.timedOut || 0}` : '--'],
    ['Playback underruns', rate && playbackStats ? playbackStats.underruns : '--'],
    ['Playback trimmed', ms(playbackStats == null ? null : playbackStats.droppedSamples / rate * 1000)],
  ];
  return (
    <details className="mt-4 border-t border-line pt-3">
      <summary className="cursor-pointer text-xs font-medium text-fg-secondary">Stream diagnostics</summary>
      <dl className="mt-3 space-y-2 text-xs">
        {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3">
          <dt className="text-fg-subtle">{label}</dt><dd className="shrink-0 font-mono tabular-nums text-fg-secondary">{value}</dd>
        </div>)}
      </dl>
      {coach && <div role="status" className="mt-3 rounded-lg border border-line bg-sunken p-3">
        <p className="text-xs font-semibold text-fg-secondary">Smart stream coach · {coach.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{coach.advice}</p>
      </div>}
      {running && !coach && <p role="status" className="mt-3 text-xs text-ok-fg">Stream looks healthy based on the current measurements.</p>}
    </details>
  );
}
