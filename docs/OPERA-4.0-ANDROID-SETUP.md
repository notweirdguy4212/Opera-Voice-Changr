# Android setup quick reference

The native plugin is source-integrated but must be copied into the generated Capacitor Android project and compiled with Android Studio. Merge `ONNX_RUNTIME_DEPENDENCY.gradle` into the app module's dependencies block before building. Use a physical phone and wired headphones for first tests. Grant microphone permission. Check the three platform-effect availability flags rather than assuming every phone supports every effect.

To use offline mode, import a compatible mono waveform-to-waveform ONNX model in the Models tab, then start the native audio stream. The app reports offline availability only after a local model is loaded. The imported model remains in app-private storage. Removing app data removes imported local models.

This runner is not a generic RVC/Seed-VC importer. Those model families need their complete feature extraction, F0, embedding and vocoder pipeline ported to Android separately.
