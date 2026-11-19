// Defaults — overridden by /api/config response at runtime
export let SAMPLE_RATE = 40000;
export let CHUNK_SIZE = 4096;
// Set VITE_SERVER_URL when building the Android client, e.g. http://192.168.1.20:8000.
// Leave unset for the desktop/same-origin deployment.
const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\\/+$/, '');
const WS_ORIGIN = SERVER_URL
  ? SERVER_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
export const WS_URL = `${WS_ORIGIN}/ws/audio`;
export const API_BASE = `${SERVER_URL}/api`;

// Matches backend.config.DEFAULT_F0_METHOD so the live stream, the offline
// converter and the UI all start from the same pitch-detection method.
export const DEFAULT_F0_METHOD = 'pm';

// SAMPLE_RATE above is only what we *ask* the browser for. An AudioContext may
// run at a different rate (the hardware rate, or a UA-clamped one), and every
// consumer — the WebSocket config, the WAV header, the record timer — has to
// use the rate the context actually reports instead.
export function applyConfig(config) {
  if (config.sample_rate) SAMPLE_RATE = config.sample_rate;
  if (config.chunk_size) CHUNK_SIZE = config.chunk_size;
}
