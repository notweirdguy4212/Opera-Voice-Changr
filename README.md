# Opera Voice Changer 5.0.0

**A real-time voice-processing studio for desktop and Android companion workflows.** Opera combines a React interface, a Python audio/inference service, configurable DSP effects, optional RVC/ONNX model runtimes, recording tools and a large searchable preset library.

> **Honest capability note:** Opera is a source project, not a prebuilt APK. Live neural conversion requires a compatible model and backend runtime. Android's native audio bridge and optional ONNX runner have narrower capabilities than the desktop RVC/Seed-VC backend. Read [Start here](docs/START_HERE.md) before installing.

[![CI](https://github.com/sioaeko/OpenVoiceChanger/actions/workflows/ci.yml/badge.svg)](https://github.com/sioaeko/OpenVoiceChanger/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/sioaeko/OpenVoiceChanger)](https://github.com/notweirdguy4212/Opera-Voice-Changr/release)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Opera-5.0.0-10b981)](VERSION)

## Documentation languages

| Language | README |
|---|---|
| English | This page |
| Español | [README_es](docs/i18n/README_es.md) |
| Français | [README_fr](docs/i18n/README_fr.md) |
| Deutsch | [README_de](docs/i18n/README_de.md) |
| 日本語 | [README_ja](docs/i18n/README_ja.md) |
| 한국어 | [README_ko](docs/i18n/README_ko.md) |
| Português | [README_pt](docs/i18n/README_pt.md) |
| Italiano | [README_it](docs/i18n/README_it.md) |
| हिन्दी | [README_hi](docs/i18n/README_hi.md) |
| العربية | [README_ar](docs/i18n/README_ar.md) |
| Русский | [README_ru](docs/i18n/README_ru.md) |
| Türkçe | [README_tr](docs/i18n/README_tr.md) |
| Bahasa Indonesia | [README_id](docs/i18n/README_id.md) |
| Nederlands | [README_nl](docs/i18n/README_nl.md) |
| 简体中文 | [README_zh-CN](docs/i18n/README_zh-CN.md) |

## Highlights

- **536 built-in presets:** 16 classic recipes plus 520 deterministic processing recipes in 13 categories. Includes natural, deep/bass, bright, whisper/intimate, classic/retro, game/stream, documentary/audiobook, sci-fi/synthetic, stage/character, studio, radio and creator styles.
- **Progressive voice library:** search, category filters, favourites, personal presets, cached browsing and Load more pagination.
- **Voice Lab:** pitch/formant controls and advanced RVC tuning where supported by the selected backend/model.
- **Effects rack:** supported DSP effects such as EQ, compression, reverb, echo, chorus, gate and character effects.
- **Model management:** import and manage compatible models; model formats and runtime requirements vary.
- **Audio workflow:** live stream diagnostics, recording library, offline file conversion and dataset export for external training workflows.
- **Android companion:** Capacitor app shell and Kotlin PCM capture/playback bridge. Optional local ONNX inference supports only the documented mono float32 waveform contract; it is not a generic RVC/Seed-VC runtime.
- **Desktop virtual mic:** documented routing with a separately installed virtual audio device. Opera does not silently install a kernel audio driver.

Presets are **parameter recipes**, not separate trained neural identities. They change pitch, formant and available DSP settings. Neural voice conversion still depends on compatible models. Opera does not include unauthorized celebrity voice clones or claim that a preset is a real person's voice. Use only recordings and models you have permission to use.

## Quick start

Requirements: Python 3.10/3.11 recommended for the inference stack, Node.js 20 LTS, and a supported desktop OS. Optional Android build requires Android Studio and Android SDK.

1. Clone or extract the project.
2. Create and activate a Python virtual environment.
3. Install backend dependencies.
4. Install frontend dependencies and build.
5. Start the backend and open the local studio.

See the complete OS-specific commands, Android steps and troubleshooting in **[docs/START_HERE.md](docs/START_HERE.md)**.

## Repository map

```text
backend/                 FastAPI service, model lifecycle, DSP and WebSocket stream
frontend/                React + Vite studio and Capacitor Android wrapper
frontend/native/android/  Kotlin native PCM bridge and optional ONNX runner
docs/                    Setup, architecture, release notes and translations
models/                  User-managed model directory (weights are not bundled)
scripts/                 Setup checks, packaging and desktop audio helpers
tests/                   Backend tests
.github/                 CI, release automation, issue templates and Dependabot
```

## GitHub project workflow

- **Issues:** use the bug report or feature request templates; include OS, version, steps and sanitized logs.
- **Pull requests:** follow the PR checklist and keep changes focused.
- **Actions:** CI runs frontend lint/tests/build, backend tests and Windows setup checks. Release workflow validates tagged releases before publishing.
- **Security:** report vulnerabilities privately using GitHub Security Advisories where enabled; see [SECURITY.md](SECURITY.md).
- **Contributing:** read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## Run locally (summary)

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

Install the RVC runtime only if you need RVC conversion and have reviewed its upstream installation/licensing requirements:

```bash
pip install --no-deps git+https://github.com/RVC-Project/Retrieval-based-Voice-Conversion
```

Then:

```bash
cd frontend
npm ci
npm run build
cd ..
python launch.py
```

Open `http://127.0.0.1:8000`. Load a compatible model before selecting neural conversion. DSP-only presets can be explored without a neural model. For development, run `cd frontend && npm run dev` in one terminal and `python launch.py` in another; see START_HERE for proxy and environment details.

## Android build overview

Android is a companion client, not a universal system microphone injector. Third-party apps choose their own audio input under OS policy. Build with Capacitor and Android Studio following [START_HERE](docs/START_HERE.md) and [Android setup](docs/OPERA-4.0-ANDROID-SETUP.md). For remote backend use, restrict access to a trusted LAN and prefer HTTPS plus authentication; never expose an unauthenticated model-upload service to the public internet.

## Performance and reliability

Latency depends on capture hardware, device audio policy, network, chunk size, backend CPU/GPU, selected model and buffer settings. The Stream Coach reports measurements and suggestions; it cannot guarantee a target latency. Test on the actual devices and apps you intend to use. See [Smart Stream Coach](docs/OPERA-4.4-SMART-STREAM-COACH.md).

## Tests

```bash
# Frontend
cd frontend
npm ci
npm run lint
npm test
npm run build

# Backend (from repository root)
pip install -r backend/requirements-test.txt
python -m pytest
```

Some model-loading tests require PyTorch. CI installs a CPU-only wheel. Full model inference also needs the runtime dependencies and compatible model assets described by upstream projects.

## Models, datasets and licensing

- Application code retains the upstream MIT license in [LICENSE](LICENSE). Check individual folders and dependencies for their own terms.
- Model weights, indexes, training datasets and third-party voice packs are not automatically included. Review each source's license and usage permissions.
- Obtain explicit consent before recording, training or converting another person's voice. Do not impersonate real people, mislead listeners about generated speech, or use the software for harassment or fraud.
- Voice training is not performed by the preset library. Dataset export prepares files for an external, compatible training pipeline.

## Support

Please open a GitHub issue with a reproducible description, version, platform and relevant logs with secrets removed. For general questions, use GitHub Discussions if enabled for the repository.

---

**Opera Voice Changer 5.0.0** · Community-maintained source project · Verify platform compatibility before production use.
