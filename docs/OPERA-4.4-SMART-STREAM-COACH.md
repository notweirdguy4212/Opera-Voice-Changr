# Opera 4.4 — Smart stream coach and connection safety

## Smart stream coach

The stream diagnostics panel now evaluates the live measurements already collected by the audio transport:

- Processing time compared with the capture-chunk duration.
- Pending capture frames compared with the expected buffer budget.
- Transport drops and timeouts.
- Playback underruns and trimmed samples.

It shows one prioritized, actionable recommendation: reduce model/F0/effect load, investigate network congestion, stabilize the output device/increase the buffer, or inspect CPU/network conditions after dropped frames. If no issue is measured, it reports that the stream looks healthy. This is a measurement-based heuristic, not a guarantee of audio quality.

## Connection lifecycle safety

WebSocket handlers now verify that the event belongs to the currently active socket before updating connection state, diagnostics, or delivering audio. Late packets and close/error events from a socket abandoned during manual retry are ignored. This prevents a stale connection from resetting a newer connection's state.

## Verification scope

Added frontend regression tests cover the coach's processing-over-budget, queue-growth, and healthy-stream paths. They require the frontend development dependencies (`npm ci`, then `npm test`). The project has not been built or exercised on physical Android/desktop audio devices as part of this source packaging step.
