# Opera 2.0 — mobile audio architecture and support matrix

## What works in this release

- Capacitor Android client and mobile-responsive studio UI.
- Browser/OS microphone permission flow and low-latency Web Audio capture (`latencyHint: interactive`).
- Selectable input/output devices where the browser exposes them (`setSinkId` support varies by browser/device).
- WebSocket streaming to the desktop AI inference backend; model inference remains on that backend.
- Local custom voice profiles with JSON import/export.
- Converted recording export/share workflows.

## Native audio processing status

This source release does **not** yet contain a production native Android DSP/AI inference engine. The Android app is a Capacitor client using Web Audio and a remote inference backend. Android's native low-latency path would require a separately implemented and benchmarked Kotlin/NDK audio engine (AAudio/Oboe), audio focus/lifecycle handling, route-change handling, echo-cancellation policy, and device-specific testing. Large Seed-VC/RVC inference is not represented as on-device functionality.

## Third-party app compatibility

| Platform / app | Supported workflow |
|---|---|
| Android Discord / Roblox / WhatsApp | Converted audio recording and sharing; no universal live mic replacement |
| iOS Discord / Roblox / WhatsApp | Converted audio recording and sharing; no universal live mic replacement |
| Desktop Discord / Roblox / WhatsApp | Live routing through a separately installed OS virtual audio cable, where the app exposes microphone selection |

A normal mobile app cannot override another app's microphone input across the OS sandbox. Android concurrent microphone capture is subject to system arbitration and privacy rules. This is a platform restriction, not a missing Opera toggle.

## Performance tuning

1. Begin with the default chunk size and `interactive` latency hint.
2. If audio breaks up, increase buffering/chunk size before changing model quality.
3. Prefer a GPU-backed inference host and a stable local network for heavier models.
4. Test each phone/browser combination; sample rate, output-device selection and Web Audio latency differ by device.
5. Keep the phone screen awake during a live session if the device aggressively suspends background audio.

Never publish the backend on an open network. Use authentication, HTTPS and a restrictive origin allowlist for remote operation.
