import { registerPlugin, Capacitor } from '@capacitor/core';

const NativeAudio = registerPlugin('OperaAudioEngine');
export const isNativeAudioAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export async function startNativeAudio(sampleRate = 48000, enhancements = {}) {
  if (!isNativeAudioAvailable()) throw new Error('The native audio engine is available in the Android build only.');
  return NativeAudio.startCapture({ sampleRate, noiseSuppression: true, automaticGainControl: true, echoCancellation: false, ...enhancements });
}
export async function stopNativeAudio() {
  if (isNativeAudioAvailable()) return NativeAudio.stopCapture();
  return undefined;
}
export async function configureNativeEnhancement(settings) {
  if (!isNativeAudioAvailable()) throw new Error('Native enhancement is available in the Android build only.');
  return NativeAudio.configureEnhancement(settings);
}
export async function writeNativePlayback(pcm16) {
  if (!isNativeAudioAvailable()) throw new Error('Native playback is available in the Android build only.');
  return NativeAudio.writePlayback({ pcm16 });
}
export async function loadNativeOnnxModel(file) {
  if (!isNativeAudioAvailable()) throw new Error('On-device ONNX models require the Android build.');
  if (!file || !file.name.toLowerCase().endsWith('.onnx')) throw new Error('Choose an ONNX .onnx model.');
  if (file.size > 128 * 1024 * 1024) throw new Error('The on-device model limit is 128 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const stride = 0x8000;
  for (let i = 0; i < bytes.length; i += stride) binary += String.fromCharCode(...bytes.subarray(i, i + stride));
  return NativeAudio.loadOnDeviceModel({ name: file.name, modelBase64: btoa(binary) });
}
export async function listNativeOnnxModels() {
  if (!isNativeAudioAvailable()) return [];
  const result = await NativeAudio.listOnDeviceModels();
  return result.models || [];
}
export async function loadStoredNativeOnnxModel(name) {
  if (!isNativeAudioAvailable()) throw new Error('On-device ONNX models require Android.');
  return NativeAudio.loadStoredOnDeviceModel({ name });
}
export async function unloadNativeOnnxModel() {
  if (isNativeAudioAvailable()) return NativeAudio.unloadOnDeviceModel();
  return undefined;
}
export async function processNativePcm(pcm16) {
  return NativeAudio.processOnDevice({ pcm16 });
}
export function addNativePcmListener(listener) {
  if (!isNativeAudioAvailable()) return { remove: async () => {} };
  return NativeAudio.addListener('pcm', listener);
}
