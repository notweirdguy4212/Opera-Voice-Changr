# Start Opera Voice Changer

This guide is the practical installation and first-run checklist for Opera 5.0.0. The project is delivered as source; it is not a signed APK or desktop installer.

## 1. Prerequisites

- Python 3.10 or 3.11 recommended for the current RVC dependency ecosystem.
- Node.js 20 LTS and npm.
- Windows 10/11, macOS or Linux for desktop use.
- Optional: Android Studio, Android SDK and a physical Android device for APK builds.
- Optional: a compatible RVC/ONNX model and the runtime required by that model. Model weights are not bundled.

## 2. Install the backend

From the repository root:

```bash
python -m venv .venv
```

Activate it:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
source .venv/bin/activate
```

Install packages:

```bash
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

RVC is an optional model runtime. Install and validate it separately, following the upstream project's current instructions and license. Do not assume every checkpoint or model format is compatible.

## 3. Install and build the frontend

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
cd ..
```

For live development, run `npm run dev` inside `frontend` and run the backend in another terminal. Check `frontend/vite.config.js` for the configured development proxy.

## 4. Start Opera

```bash
python launch.py
```

Open `http://127.0.0.1:8000`. Keep the backend bound to loopback for desktop-only use. Check Settings / Runtime Readiness if an optional inference dependency is missing.

## 5. First voice conversion

1. Confirm the microphone is connected and grant browser microphone permission.
2. Open Models and import a model whose format is supported by the installed runtime.
3. Wait for the model to finish loading and confirm runtime readiness.
4. Select a preset. The preset adjusts processing parameters; it is not a neural identity on its own.
5. Start the audio stream and watch Stream Diagnostics for processing time, queue depth and dropped frames.
6. Make a short test recording before using a live call.

If no neural model is loaded, you can still explore available DSP-only effects and presets, but neural conversion will not be available.

## 6. Android companion build

Android build is optional and requires Android Studio / SDK. First set a backend URL reachable from the phone. For a private LAN example only:

```powershell
# Windows PowerShell, from frontend directory
$env:VITE_SERVER_URL = "http://192.168.1.20:8000"
npm ci
npx cap add android
npm run android:sync
npx cap open android
```

```bash
# macOS/Linux, from frontend directory
export VITE_SERVER_URL="http://192.168.1.20:8000"
npm ci
npx cap add android
npm run android:sync
npx cap open android
```

Build the APK from Android Studio. Merge microphone permission entries from `android-manifest-overrides.xml` into the generated Android manifest and verify permission prompts. The backend must be reachable from the phone. Restrict LAN access; for untrusted networks use HTTPS and authentication. Rebuild if `VITE_SERVER_URL` changes because it is compiled into the app.

**Android limitations:** the native PCM bridge does not bypass Android microphone privacy or input-sharing policy. It cannot force Discord, Roblox, WhatsApp or another app to select Opera as its microphone. The local ONNX runner supports only its documented mono float32 waveform model contract; it is not a generic RVC/Seed-VC implementation.

## 7. Desktop virtual microphone

Install a reputable virtual audio cable separately (for example, a platform-appropriate virtual audio device). Route Opera's output to the virtual device's playback endpoint, then select its recording endpoint as the microphone in the target desktop app. Review the dedicated guide at `docs/OPERA-2.0-DESKTOP-VIRTUAL-MIC.md`. Opera does not bundle a kernel driver or silently install one.

## 8. Troubleshooting

| Symptom | Checks |
|---|---|
| Backend does not start | Activate the correct virtual environment; review Python version and missing dependency output. |
| Frontend cannot connect | Confirm backend is running, URL/port is correct and CORS origin is allowed. |
| Microphone unavailable | Check OS privacy permission, browser permission and selected input device. |
| Model won't load | Confirm model format, runtime version, file integrity and available memory. |
| Audio stutters | Try a smaller/lighter model, stable network, GPU backend or different buffer settings. |
| Android can't reach backend | Use the computer's LAN IP, same trusted Wi-Fi and firewall rule for the backend port. |
| Target mobile app doesn't receive Opera | Mobile OS sandboxing usually prevents one app replacing another app's mic input; use supported recording export or desktop virtual mic routing. |

When reporting a bug, include Opera version, OS/device, exact steps and sanitized logs. Never attach API keys, passwords, private voice recordings or personal model files to a public issue.

## 9. Run tests

```bash
# frontend
cd frontend && npm ci && npm run lint && npm test && npm run build
# backend, from project root
pip install -r backend/requirements-test.txt
python -m pytest
```

A passing test suite is not a substitute for testing the audio path on the actual hardware, OS version and target app.
