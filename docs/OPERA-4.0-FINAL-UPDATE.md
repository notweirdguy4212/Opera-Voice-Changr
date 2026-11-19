# Opera Voice Changer 4.0 — final implementation update

## Shipped in this source update

- **Android native audio engine:** Kotlin `AudioRecord` capture and streaming `AudioTrack` playback at 48 kHz mono PCM16; requests Android's low-latency playback mode on API 26+.
- **Device speech effects:** exposes Android `NoiseSuppressor`, `AcousticEchoCanceler`, and `AutomaticGainControl` when the device implements them. The UI allows toggling each supported effect. Availability is hardware/OS dependent.
- **On-device ONNX runtime:** Android integration uses ONNX Runtime Android, stores imported `.onnx` files in Opera's private app storage, lists previously imported models, loads/unloads them, and runs local waveform inference. The supported model contract is mono float32 waveform input/output `[1, N]`; the current stream sends short 20 ms chunks. A compatible model must accept the exact chunk dimensions and sample rate.
- **Offline local mode:** when a compatible local ONNX model is installed, Android can start the native stream without a backend connection, run local inference, and play the result locally. Saved takes and profiles remain in local app/browser storage. This does not make backend-only RVC/Seed-VC models work offline.
- **Training-data preparation:** the Training Dataset Builder packages selected WAV recordings plus a JSON manifest into a ZIP. It prepares data for a separate compatible training workflow; it does not train model weights.
- **Personal profiles and recording library:** retained from previous versions, including local profile persistence/import/export and IndexedDB recording management.
- **Desktop virtual microphone helper:** retained signed-publisher validation and explicit confirmation for the VB-Audio installer. The driver remains third-party and is not bundled.
- **Offline web app shell:** static shell caching remains enabled; API requests, WebSockets and model binaries are not placed in the service-worker cache.

## Honest compatibility limits

- The local ONNX runner is a generic waveform-to-waveform audio model runner, **not a full RVC or Seed-VC implementation**. Most voice conversion checkpoints need feature extraction, pitch estimation, speaker embeddings, model-specific chunking and vocoder stages; they are not interchangeable with this waveform contract.
- No neural voice-model training engine is included. The dataset ZIP is preparation/export only. Training must be performed by a compatible training tool with the speaker's consent.
- Android effects are optional platform effects; some devices do not expose all three. Low-latency mode is a request, not a guarantee. Bridge overhead and model inference can add latency.
- When local inference cannot keep up, chunks may be skipped instead of building an unbounded queue. This avoids runaway delay but can create audio gaps.
- Local mode plays through the phone's selected audio route. It cannot force Discord, Roblox, WhatsApp or other apps to select Opera's processed microphone. Android's microphone-sharing and routing policy remains in control.
- Desktop virtual-microphone routing requires the separately installed OS driver and user configuration.

## Android build integration

1. In `frontend/`, run `npm install`.
2. Generate the Android project once with `npx cap add android` if `android/` does not exist.
3. Merge `frontend/android-manifest-overrides.xml` into `android/app/src/main/AndroidManifest.xml`.
4. Merge the dependency line from `frontend/native/android/ONNX_RUNTIME_DEPENDENCY.gradle` into the generated `android/app/build.gradle` dependencies block.
5. Copy `frontend/native/android/app/src/main/java/` into the generated `android/app/src/main/java/` tree, preserving package paths. If the generated package differs, update the Kotlin package declaration/import.
6. Ensure `MainActivity` registers `OperaAudioEnginePlugin` as shown in the supplied native source.
7. Run `npm run android:sync`, open the project in Android Studio, then build and test on a physical device.

## Local model contract

The Android model importer accepts `.onnx` files up to 128 MB. The runner supplies a float32 tensor shaped `[1, N]` from mono PCM16 converted to floats and expects a float32 waveform output. The default 48 kHz capture chunk is approximately 960 samples (20 ms). Models that expect spectrograms, HuBERT features, pitch tensors, multiple inputs, fixed incompatible sequence lengths, or different sample rates are not supported by this runner. Use a model explicitly exported for this contract.

## Validation status

The source archive can be inspected and the JavaScript utility modules can be syntax-checked independently. A production frontend build, Kotlin/Gradle compilation, ONNX model compatibility test, APK signing and real-device latency/thermal tests require installed frontend dependencies and the Android SDK/device. No APK is included in this source package.
