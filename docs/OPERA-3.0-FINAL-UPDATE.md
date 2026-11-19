# Opera Voice Changer 3.0 — implementation and capability notes

## Implemented in this source update

- **Android native PCM engine:** a Capacitor Kotlin plugin uses Android `AudioRecord` and streaming `AudioTrack`, requests the low-latency playback performance mode on API 26+, captures mono PCM16 at 48 kHz, and bridges PCM chunks to the JavaScript streaming pipeline. `MainActivity` registers the plugin. The Android app must be generated with `npx cap add android` before syncing/building.
- **Speech cleanup:** browser capture requests platform noise suppression, then applies a local 75 Hz high-pass filter and a gentle dynamics compressor before the streaming worklet. Android native capture uses the OS voice-recognition audio source; the native PCM bridge does not yet apply a neural denoiser.
- **Pitch and formant:** existing Voice Lab pitch/formant controls and model inference remain available; profiles persist the selected settings and effect rack.
- **Custom profiles:** save/load/import/export support remains available in the Profile Vault.
- **Recording library:** the existing IndexedDB take library stores recordings locally and supports playback, rename, download, retry-save, and delete.
- **Model management:** existing Model Bay supports ONNX/RVC checkpoint upload, activation/deactivation and deletion. Model files are local to the configured backend.
- **Offline app shell:** a service worker caches the static app shell only. API calls, WebSockets, voice models and conversion are intentionally not cached. Saved recordings and profiles remain in browser storage.
- **Desktop virtual microphone helper:** the PowerShell installer wrapper accepts only a validly signed VB-Audio installer, checks the publisher, requests explicit confirmation and runs it elevated. The actual third-party driver is not bundled.

## Important limits — do not interpret these as shipped features

- The Kotlin bridge provides native low-latency PCM capture/playback, but JavaScript bridge callbacks and the current WebSocket/backend inference path still add latency. It is not a fully native end-to-end AI engine, and no device-specific latency guarantee is made.
- **On-device neural voice conversion / lightweight AI models are not included.** RVC/ONNX inference remains on the configured backend. A compatible quantized model, Android ONNX Runtime integration, memory budgeting and device benchmarks are still required before claiming offline AI conversion.
- **Voice training is not performed on the phone.** Profiles save settings, not a trained voice identity. Training requires a dataset/training runtime and must only use voices and recordings the user is authorized to use.
- Android app-to-app microphone routing is controlled by Android and the target app. Opera cannot force Discord, Roblox, WhatsApp or another app to select its processed microphone. Device/OS support varies.
- The virtual microphone installer does not bundle or silently download a driver. Download the installer directly from its publisher and verify its signature.

## Android integration

1. From `frontend/`, run `npm install`.
2. Run `npx cap add android` once to generate the Android project if it does not exist.
3. Copy/merge `android-manifest-overrides.xml` into `android/app/src/main/AndroidManifest.xml` (microphone permission is required).
4. Copy `frontend/native/android/app/src/main/java/` into the generated `android/app/src/main/java/` tree, preserving the package paths; if Capacitor generated a different package, update the package declaration and import.
5. Run `npm run android:sync`, then open/build the Android project in Android Studio.
6. Test on a physical device with wired headphones first. Measure round-trip latency and thermal/battery behavior on each target device.

## Build and validation

The repository source can be syntax-checked with Python and tested with the frontend test suite after installing dependencies. An APK is not included in this source archive. Native Android compilation and on-device audio testing must be completed in Android Studio on a machine with the Android SDK.
