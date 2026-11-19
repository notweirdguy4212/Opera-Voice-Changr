# Model management and voice-training workflow

## Model management

- Use the Model Bay to upload `.onnx`, `.pth`, `.pt`, and associated `.index` files to the configured backend.
- Keep one active conversion model at a time. Use ONNX where a supported runtime/provider is available; RVC checkpoints require the backend's compatible runtime.
- Store large checkpoints on the backend machine, not in the Android app shell cache. Check available disk space before uploading.
- Export your profile JSON separately. A profile is a settings preset and does not contain model weights or training data.

## Training readiness

Opera 3.0 does not claim to train a voice model locally. For a future training integration, prepare clean, authorized speech recordings with consistent microphone distance, quiet surroundings, no music, and a range of natural speech. Keep the original recordings private, label the dataset clearly, and only train on your own voice or a voice for which you have explicit permission. The model training runtime and compatible training scripts must be installed separately.

## Lightweight mobile model roadmap

The Android native bridge currently handles PCM capture/playback. Before mobile neural conversion can be enabled, the project needs an Android ONNX Runtime dependency, a supported quantized model format, model download/verification, per-device RAM/accelerator capability checks, and profiling for latency, heat and battery use. Until those pieces are integrated and tested, model conversion continues through the backend.
