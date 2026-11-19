import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useRecordingLibrary from './useRecordingLibrary';
import { SAMPLE_RATE, CHUNK_SIZE } from '../lib/constants';
import { encodeWav } from '../lib/wav';
import { formatFileTimestamp } from '../lib/format';
import { createMeterStore, rms } from '../lib/meters';
import {
  MAX_RECORD_SECONDS,
  appendRecordingChunk,
  formatRecordLimit,
  maxRecordingSamples,
} from '../lib/recording';
import { isNativeAudioAvailable, startNativeAudio, stopNativeAudio, writeNativePlayback, addNativePcmListener, processNativePcm, configureNativeEnhancement } from '../lib/nativeAudio';
import {
  buildAudioConstraintCandidates,
  describeGetUserMediaError,
  getMediaDeviceSupport,
  isDeviceConstraintError,
  supportsOutputDeviceSelection,
} from '../lib/audioSupport';

// The worklet ships from public/ so it resolves relative to the app's base
// URL, wherever the studio happens to be mounted.
const WORKLET_URL = `${import.meta.env.BASE_URL}audioWorklet.js`;

export default function useAudioPipeline(wsHook) {
  // Only the stable callbacks are needed here. Depending on the whole hook
  // object would recreate start/stop every time a latency sample arrives.
  const { sendAudio, setOnAudioReceived, setStreamSampleRate } = wsHook;

  const [isRunning, setIsRunning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const library = useRecordingLibrary();
  const { addTake } = library;
  const [recordNotice, setRecordNotice] = useState(null); // {tone, message}
  const [streamInfo, setStreamInfo] = useState(null); // {sampleRate, requestedSampleRate, inputFallback}
  const [playbackStats, setPlaybackStats] = useState(null);

  const audioContextRef = useRef(null);
  const nativeListenerRef = useRef(null);
  const nativeAudioRef = useRef(false);
  const nativeInferenceEnabledRef = useRef(false);
  const nativeInferenceBusyRef = useRef(false);
  const [nativeInferenceEnabled, setNativeInferenceEnabled] = useState(false);
  const [nativeModelLoaded, setNativeModelLoaded] = useState(false);
  const captureSinkRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const captureNodeRef = useRef(null);
  const playbackNodeRef = useRef(null);
  const inputAnalyserRef = useRef(null);
  const outputAnalyserRef = useRef(null);
  const inputBufferRef = useRef(null);
  const outputBufferRef = useRef(null);
  const animFrameRef = useRef(null);
  const seqNumRef = useRef(0);
  const recordingRef = useRef(false);
  const recordChunksRef = useRef([]);
  const recordSamplesRef = useRef(0);
  const recordLimitRef = useRef(0);
  // The rate the AudioContext actually runs at — not the rate we asked for.
  const sampleRateRef = useRef(SAMPLE_RATE);

  // Animation-rate values live outside React state so meter updates never
  // re-render the App. Components that paint them subscribe individually.
  const meters = useMemo(
    () => createMeterStore({ input: 0, output: 0, recordSeconds: 0 }),
    []
  );

  const outputSelectionSupported = useMemo(() => supportsOutputDeviceSelection(), []);

  // Starts the animation-rate meter loop; stop() cancels it via animFrameRef.
  const startLevelLoop = useCallback(() => {
    function tick() {
      let input = 0;
      let output = 0;

      if (inputAnalyserRef.current && inputBufferRef.current) {
        inputAnalyserRef.current.getFloatTimeDomainData(inputBufferRef.current);
        input = rms(inputBufferRef.current);
      }
      if (outputAnalyserRef.current && outputBufferRef.current) {
        outputAnalyserRef.current.getFloatTimeDomainData(outputBufferRef.current);
        output = rms(outputBufferRef.current);
      }

      meters.set({
        input,
        output,
        recordSeconds: recordingRef.current
          ? recordSamplesRef.current / sampleRateRef.current
          : 0,
      });

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [meters]);

  const finalizeRecording = useCallback((notice = null) => {
    recordingRef.current = false;
    setIsRecording(false);

    const chunks = recordChunksRef.current;
    const samples = recordSamplesRef.current;
    recordChunksRef.current = [];
    recordSamplesRef.current = 0;
    meters.set({ recordSeconds: 0 });

    if (!chunks.length) {
      if (notice) setRecordNotice(notice);
      return null;
    }

    const recording = (() => {
      try {
        const blob = encodeWav(chunks, sampleRateRef.current);
        return {
          blob,
          seconds: samples / sampleRateRef.current,
          size: blob.size,
          // Named once, when the take ends, so the download keeps one name.
          fileName: `voice-take-${formatFileTimestamp()}.wav`,
        };
      } catch (err) {
        console.error('Failed to encode recording:', err);
        setRecordNotice({
          tone: 'error',
          message: 'The take could not be encoded — it may have been too long for available memory.',
        });
        return null;
      }
    })();

    if (!recording) return null;

    addTake(recording);
    setRecordNotice(notice);
    return recording;
  }, [meters, addTake]);

  const stop = useCallback(() => {
    if (recordingRef.current) {
      finalizeRecording();
    }
    if (nativeListenerRef.current) {
      nativeListenerRef.current.remove?.();
      nativeListenerRef.current = null;
    }
    if (nativeAudioRef.current) {
      nativeAudioRef.current = false;
      void stopNativeAudio();
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    try {
      sourceRef.current?.disconnect();
    } catch { /* already disconnected */ }
    try {
      captureNodeRef.current?.disconnect();
    } catch { /* already disconnected */ }
    try {
      captureSinkRef.current?.disconnect();
    } catch { /* already disconnected */ }
    try {
      playbackNodeRef.current?.disconnect();
    } catch { /* already disconnected */ }
    try {
      inputAnalyserRef.current?.disconnect();
    } catch { /* already disconnected */ }
    try {
      outputAnalyserRef.current?.disconnect();
    } catch { /* already disconnected */ }

    captureNodeRef.current?.port?.close?.();
    playbackNodeRef.current?.port?.close?.();

    streamRef.current?.getTracks().forEach((track) => track.stop());
    // close() rejects if the context is already closed (a failed start that
    // never resumed it, or a second stop) — that is not worth an unhandled
    // rejection in the console.
    const context = audioContextRef.current;
    if (context && context.state !== 'closed') {
      context.close().catch(() => {});
    }

    audioContextRef.current = null;
    captureSinkRef.current = null;
    streamRef.current = null;
    sourceRef.current = null;
    captureNodeRef.current = null;
    playbackNodeRef.current = null;
    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
    inputBufferRef.current = null;
    outputBufferRef.current = null;

    setOnAudioReceived(null);

    meters.set({ input: 0, output: 0, recordSeconds: 0 });
    setStreamInfo(null);
    setPlaybackStats(null);
    setIsRunning(false);
    nativeInferenceEnabledRef.current = false;
    setNativeInferenceEnabled(false);
  }, [finalizeRecording, setOnAudioReceived, meters]);

  const start = useCallback(
    async (inputDeviceId, outputDeviceId) => {
      try {
        if (isNativeAudioAvailable()) {
          const actualSampleRate = 48000;
          const nativeInfo = await startNativeAudio(actualSampleRate);
          nativeAudioRef.current = true;
          const hasLocalModel = Boolean(nativeInfo.onDeviceModelLoaded);
          setNativeModelLoaded(hasLocalModel);
          if (hasLocalModel) { nativeInferenceEnabledRef.current = true; setNativeInferenceEnabled(true); }
          sampleRateRef.current = nativeInfo.sampleRate || actualSampleRate;
          recordLimitRef.current = maxRecordingSamples(sampleRateRef.current);
          setStreamSampleRate?.(sampleRateRef.current);
          nativeListenerRef.current = await addNativePcmListener(({ pcm16 }) => {
            if (!pcm16) return;
            const decode = (encoded) => {
              const raw = atob(encoded);
              const view = new DataView(new ArrayBuffer(raw.length));
              for (let i = 0; i < raw.length; i += 1) view.setUint8(i, raw.charCodeAt(i));
              const samples = new Float32Array(Math.floor(raw.length / 2));
              for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 32768;
              return samples;
            };
            const deliverServer = (encoded) => {
              const samples = decode(encoded);
              sendAudio(samples, seqNumRef.current++);
              meters.set({ input: rms(samples), output: meters.get().output, recordSeconds: recordingRef.current ? recordSamplesRef.current / sampleRateRef.current : 0 });
            };
            const deliverLocal = (encoded) => {
              const samples = decode(encoded);
              void writeNativePlayback(encoded).catch((error) => console.warn('Local playback failed:', error));
              if (recordingRef.current) {
                const result = appendRecordingChunk(samples, recordSamplesRef.current, recordLimitRef.current);
                if (result.accepted?.length) recordChunksRef.current.push(result.accepted.slice(0));
                recordSamplesRef.current = result.samples;
                if (result.full) finalizeRecording({ tone: 'warning', message: `Recording stopped at the ${formatRecordLimit()} limit. The WAV is ready to download.` });
              }
              meters.set({ input: meters.get().input, output: rms(samples), recordSeconds: recordingRef.current ? recordSamplesRef.current / sampleRateRef.current : 0 });
            };
            if (nativeInferenceEnabledRef.current && !nativeInferenceBusyRef.current) {
              nativeInferenceBusyRef.current = true;
              void processNativePcm(pcm16).then((result) => deliverLocal(result.pcm16)).catch((error) => {
                console.warn('Local ONNX inference failed; bypassing the model for this chunk:', error);
                deliverLocal(pcm16);
              }).finally(() => { nativeInferenceBusyRef.current = false; });
            } else if (!nativeInferenceEnabledRef.current) deliverServer(pcm16);
          });
          setOnAudioReceived((pcmData) => {
            const bytes = new Uint8Array(pcmData.length * 2);
            const view = new DataView(bytes.buffer);
            for (let i = 0; i < pcmData.length; i += 1) {
              const sample = Math.max(-1, Math.min(1, pcmData[i]));
              view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
            }
            let binary = ''; for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
            void writeNativePlayback(btoa(binary)).catch((error) => console.warn('Native playback write failed:', error));
            if (!recordingRef.current) return;
            const result = appendRecordingChunk(pcmData, recordSamplesRef.current, recordLimitRef.current);
            if (result.accepted?.length) recordChunksRef.current.push(result.accepted.slice(0));
            recordSamplesRef.current = result.samples;
            if (result.full) finalizeRecording({ tone: 'warning', message: `Recording stopped at the ${formatRecordLimit()} limit. The WAV is ready to download.` });
          });
          setStreamInfo({ sampleRate: sampleRateRef.current, requestedSampleRate: actualSampleRate, chunkSize: Math.round(actualSampleRate / 50), nativeEngine: true, lowLatencyRequested: Boolean(nativeInfo.lowLatencyRequested), localSpeechEnhancement: true, nativeEnhancements: nativeInfo });
          setIsRunning(true);
          return;
        }
        const support = getMediaDeviceSupport();
        if (!support.supported) throw new Error(support.reason);

        // The browser may refuse the requested rate outright (or silently pick
        // another); fall back to its preferred rate rather than failing.
        let audioContext;
        try {
          audioContext = new AudioContext({
            sampleRate: SAMPLE_RATE,
            latencyHint: 'interactive',
          });
        } catch (rateErr) {
          console.warn(
            `AudioContext rejected sampleRate=${SAMPLE_RATE} (${rateErr?.name}); using the browser default.`
          );
          audioContext = new AudioContext({ latencyHint: 'interactive' });
        }
        audioContextRef.current = audioContext;

        // Canonical rate for everything downstream: WebSocket config, WAV
        // header, record timer. Asking for 40 kHz and getting 48 kHz would
        // otherwise mis-tune conversion and save recordings at the wrong speed.
        const actualSampleRate = Math.round(audioContext.sampleRate);
        sampleRateRef.current = actualSampleRate;
        recordLimitRef.current = maxRecordingSamples(actualSampleRate);

        if (outputDeviceId && outputSelectionSupported) {
          try {
            await audioContext.setSinkId(outputDeviceId);
          } catch (sinkErr) {
            const error = new Error('The selected output device could not be opened. Reconnect it or select another output before starting.', { cause: sinkErr });
            error.name = 'OutputRoutingError';
            throw error;
          }
        }

        const candidates = buildAudioConstraintCandidates(inputDeviceId, actualSampleRate);
        let stream = null;
        let inputFallback = null;
        let lastError = null;

        for (const candidate of candidates) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { ...candidate.audio, noiseSuppression: true, autoGainControl: false },
            });
            inputFallback = candidate.fallback || null;
            break;
          } catch (err) {
            lastError = err;
            // Only a device-specific failure is worth retrying looser; a
            // permission denial or a busy device will fail the same way again.
            if (!isDeviceConstraintError(err)) throw err;
          }
        }

        if (!stream) throw lastError || new Error('No usable microphone was found.');
        streamRef.current = stream;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        await audioContext.audioWorklet.addModule(WORKLET_URL);

        const captureNode = new AudioWorkletNode(audioContext, 'capture-processor', {
          processorOptions: { chunkSize: CHUNK_SIZE },
        });
        captureNodeRef.current = captureNode;

        const playbackNode = new AudioWorkletNode(audioContext, 'playback-processor', {
          processorOptions: { chunkSize: CHUNK_SIZE },
          outputChannelCount: [1],
        });
        playbackNodeRef.current = playbackNode;
        playbackNode.port.onmessage = ({ data }) => {
          if (data?.type === 'diagnostics') setPlaybackStats(data);
        };

        const captureSink = audioContext.createGain();
        captureSink.gain.value = 0;
        captureSinkRef.current = captureSink;

        // Local pre-processing stage: suppress rumble and stabilize speech
        // before chunks leave the device. Browser/OS NS is also requested above.
        const voiceHighPass = audioContext.createBiquadFilter();
        voiceHighPass.type = 'highpass';
        voiceHighPass.frequency.value = 75;
        voiceHighPass.Q.value = 0.707;
        const voiceCompressor = audioContext.createDynamicsCompressor();
        voiceCompressor.threshold.value = -30;
        voiceCompressor.knee.value = 18;
        voiceCompressor.ratio.value = 2.2;
        voiceCompressor.attack.value = 0.004;
        voiceCompressor.release.value = 0.18;

        const inputAnalyser = audioContext.createAnalyser();
        inputAnalyser.fftSize = 2048;
        inputAnalyser.smoothingTimeConstant = 0.82;
        inputAnalyserRef.current = inputAnalyser;
        inputBufferRef.current = new Float32Array(inputAnalyser.fftSize);

        const outputAnalyser = audioContext.createAnalyser();
        outputAnalyser.fftSize = 2048;
        outputAnalyser.smoothingTimeConstant = 0.82;
        outputAnalyserRef.current = outputAnalyser;
        outputBufferRef.current = new Float32Array(outputAnalyser.fftSize);

        source.connect(voiceHighPass);
        voiceHighPass.connect(voiceCompressor);
        voiceCompressor.connect(inputAnalyser);
        inputAnalyser.connect(captureNode);
        captureNode.connect(captureSink);
        captureSink.connect(audioContext.destination);
        playbackNode.connect(outputAnalyser);
        outputAnalyser.connect(audioContext.destination);

        // Tell the server the rate we are really streaming at before any audio
        // goes out, so the first chunk is interpreted correctly.
        setStreamSampleRate?.(actualSampleRate);

        captureNode.port.onmessage = (event) => {
          const buffer = event.data;
          if (buffer instanceof Float32Array) {
            sendAudio(buffer, seqNumRef.current++);
          }
        };

        setOnAudioReceived((pcmData) => {
          if (playbackNodeRef.current) {
            playbackNodeRef.current.port.postMessage(pcmData);
          }
          if (!recordingRef.current) return;

          const { accepted, samples, full } = appendRecordingChunk(
            pcmData,
            recordSamplesRef.current,
            recordLimitRef.current
          );
          if (accepted && accepted.length > 0) {
            recordChunksRef.current.push(accepted.slice(0));
          }
          recordSamplesRef.current = samples;

          if (full) {
            finalizeRecording({
              tone: 'warning',
              message: `Recording stopped at the ${formatRecordLimit()} limit. The WAV is ready to download.`,
            });
          }
        });

        await audioContext.resume();
        startLevelLoop();

        setStreamInfo({
          sampleRate: actualSampleRate,
          requestedSampleRate: SAMPLE_RATE,
          chunkSize: CHUNK_SIZE,
          baseLatency: audioContext.baseLatency ?? null,
          outputLatency: audioContext.outputLatency ?? null,
          inputFallback,
          noiseSuppression: true,
          localSpeechEnhancement: true,
        });
        setIsRunning(true);
      } catch (err) {
        console.error('Failed to start audio pipeline:', err);
        stop();
        throw new Error(err.name === 'OutputRoutingError' ? err.message : describeGetUserMediaError(err), { cause: err });
      }
    },
    [
      sendAudio, setOnAudioReceived, setStreamSampleRate, startLevelLoop, finalizeRecording,
      stop, outputSelectionSupported, meters,
    ]
  );

  const setNativeModelReady = useCallback((ready) => setNativeModelLoaded(Boolean(ready)), []);

  const setNativeInference = useCallback((enabled) => {
    nativeInferenceEnabledRef.current = Boolean(enabled);
    setNativeInferenceEnabled(Boolean(enabled));
  }, []);

  const setNativeEnhancements = useCallback(async (settings) => {
    if (!isNativeAudioAvailable()) throw new Error('Native audio enhancements require Android.');
    return configureNativeEnhancement(settings);
  }, []);

  const startRecording = useCallback(() => {
    if (recordingRef.current) return;
    recordChunksRef.current = [];
    recordSamplesRef.current = 0;
    recordLimitRef.current = maxRecordingSamples(sampleRateRef.current);
    recordingRef.current = true;
    meters.set({ recordSeconds: 0 });
    setRecordNotice(null);
    setIsRecording(true);
  }, [meters]);

  const stopRecording = useCallback(() => finalizeRecording(), [finalizeRecording]);

  useEffect(() => {
    if (!isRecording) return undefined;
    const guard = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [isRecording]);

  // Stable accessor so canvas components can read the live analyser nodes.
  const getAnalysers = useCallback(() => ({
    input: inputAnalyserRef.current,
    output: outputAnalyserRef.current,
  }), []);

  // Stable identity between state changes, so memoized panels that receive the
  // whole pipeline do not re-render on unrelated App updates.
  return useMemo(() => ({
    start,
    stop,
    setNativeInference,
    setNativeModelReady,
    setNativeEnhancements,
    nativeInferenceEnabled,
    nativeModelLoaded,
    canRunOffline: isNativeAudioAvailable() && nativeModelLoaded,
    isRunning,
    meters,
    getAnalysers,
    isRecording,
    library,
    recordNotice,
    startRecording,
    stopRecording,
    maxRecordSeconds: MAX_RECORD_SECONDS,
    outputSelectionSupported,
    streamInfo,
    playbackStats,
  }), [
    start, stop, setNativeInference, setNativeModelReady, setNativeEnhancements, nativeInferenceEnabled, nativeModelLoaded, isRunning, meters, getAnalysers, isRecording, library, recordNotice,
    startRecording, stopRecording, outputSelectionSupported, streamInfo, playbackStats,
  ]);
}
