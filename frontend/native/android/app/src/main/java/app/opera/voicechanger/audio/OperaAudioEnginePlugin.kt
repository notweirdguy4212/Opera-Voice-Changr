package app.opera.voicechanger.audio

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.util.Base64
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import java.nio.FloatBuffer
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/** Native PCM engine with Android speech effects and optional local ONNX audio-to-audio inference. */
@CapacitorPlugin(name = "OperaAudioEngine", permissions = [
    Permission(alias = "microphone", strings = [android.Manifest.permission.RECORD_AUDIO])
])
class OperaAudioEnginePlugin : Plugin() {
    private val running = AtomicBoolean(false)
    @Volatile private var recorder: AudioRecord? = null
    @Volatile private var player: AudioTrack? = null
    @Volatile private var captureThread: Thread? = null
    @Volatile private var sampleRate = 48000
    private var noiseSuppressor: NoiseSuppressor? = null
    private var echoCanceler: AcousticEchoCanceler? = null
    private var gainControl: AutomaticGainControl? = null
    private val ortEnvironment: OrtEnvironment by lazy { OrtEnvironment.getEnvironment() }
    @Volatile private var ortSession: OrtSession? = null
    @Volatile private var loadedModelName: String? = null

    @PluginMethod
    fun startCapture(call: PluginCall) {
        if (running.get()) { call.resolve(capabilities()); return }
        sampleRate = call.getInt("sampleRate", 48000).coerceIn(16000, 48000)
        if (Build.VERSION.SDK_INT >= 23 && !hasPermission("microphone")) {
            requestPermissionForAlias("microphone", call, "permissionResult"); return
        }
        try {
            val minBytes = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            if (minBytes <= 0) throw IllegalStateException("AudioRecord does not support this sample rate")
            val bufferBytes = maxOf(minBytes * 2, sampleRate / 25 * 2)
            val input = AudioRecord.Builder()
                .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
                .setBufferSizeInBytes(bufferBytes).build()
            if (input.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("Microphone engine failed to initialize")
            val output = createPlayer(sampleRate, bufferBytes)
            recorder = input; player = output
            attachPlatformEffects(input.audioSessionId, call.getBoolean("noiseSuppression", true),
                call.getBoolean("echoCancellation", false), call.getBoolean("automaticGainControl", true))
            running.set(true)
            input.startRecording(); output.play()
            captureThread = thread(name = "OperaAudioCapture", priority = Thread.MAX_PRIORITY) {
                val pcm = ShortArray(maxOf(160, sampleRate / 50))
                while (running.get()) {
                    val count = input.read(pcm, 0, pcm.size, AudioRecord.READ_BLOCKING)
                    if (count > 0) {
                        val bytes = ByteArray(count * 2)
                        for (i in 0 until count) {
                            bytes[i * 2] = (pcm[i].toInt() and 0xff).toByte()
                            bytes[i * 2 + 1] = ((pcm[i].toInt() shr 8) and 0xff).toByte()
                        }
                        notifyListeners("pcm", JSObject().put("pcm16", Base64.encodeToString(bytes, Base64.NO_WRAP))
                            .put("frames", count).put("sampleRate", sampleRate))
                    }
                }
            }
            call.resolve(capabilities().put("sampleRate", sampleRate).put("bufferBytes", bufferBytes)
                .put("lowLatencyRequested", Build.VERSION.SDK_INT >= 26))
        } catch (error: Exception) { stopEngine(); call.reject("Could not start native audio: ${error.message}", error) }
    }

    @PluginMethod
    fun configureEnhancement(call: PluginCall) {
        val sessionId = recorder?.audioSessionId ?: run { call.reject("Start the audio engine first"); return }
        attachPlatformEffects(sessionId, call.getBoolean("noiseSuppression", true),
            call.getBoolean("echoCancellation", false), call.getBoolean("automaticGainControl", true))
        call.resolve(capabilities())
    }

    @PluginMethod
    fun writePlayback(call: PluginCall) {
        val encoded = call.getString("pcm16") ?: run { call.reject("pcm16 is required"); return }
        val track = player ?: run { call.reject("Audio engine is not running"); return }
        try {
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            val written = track.write(bytes, 0, bytes.size, AudioTrack.WRITE_BLOCKING)
            call.resolve(JSObject().put("bytesWritten", written))
        } catch (error: Exception) { call.reject("Playback write failed: ${error.message}", error) }
    }

    /** Load a user-supplied ONNX model from base64. Contract: float32 [1, N] waveform in/out, mono. */
    @PluginMethod
    fun loadOnDeviceModel(call: PluginCall) {
        val name = call.getString("name") ?: run { call.reject("Model name is required"); return }
        val safeName = name.substringAfterLast('/').substringAfterLast('\\')
        if (!safeName.matches(Regex("[A-Za-z0-9_.-]{1,80}\\.onnx", RegexOption.IGNORE_CASE))) {
            call.reject("Use a simple .onnx filename"); return
        }
        val encoded = call.getString("modelBase64") ?: run { call.reject("modelBase64 is required"); return }
        try {
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            if (bytes.isEmpty() || bytes.size > 128 * 1024 * 1024) throw IllegalArgumentException("Model must be between 1 byte and 128 MB")
            val directory = File(context.filesDir, "opera-models").apply { mkdirs() }
            val modelFile = File(directory, safeName)
            modelFile.writeBytes(bytes)
            val options = OrtSession.SessionOptions().apply { setIntraOpNumThreads(2); setInterOpNumThreads(1) }
            val next = ortEnvironment.createSession(modelFile.absolutePath, options)
            val inputName = next.inputNames.firstOrNull() ?: throw IllegalArgumentException("Model has no input tensor")
            val outputName = next.outputNames.firstOrNull() ?: throw IllegalArgumentException("Model has no output tensor")
            val old = ortSession
            ortSession = next; loadedModelName = safeName
            old?.close(); options.close()
            call.resolve(JSObject().put("name", safeName).put("input", inputName).put("output", outputName)
                .put("contract", "float32 mono waveform [1,N] to float32 mono waveform [1,N]"))
        } catch (error: Exception) { call.reject("Could not load on-device ONNX model: ${error.message}", error) }
    }

    @PluginMethod
    fun processOnDevice(call: PluginCall) {
        val session = ortSession ?: run { call.reject("No on-device ONNX model is loaded"); return }
        val encoded = call.getString("pcm16") ?: run { call.reject("pcm16 is required"); return }
        try {
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            if (bytes.size < 2 || bytes.size > 256 * 1024) throw IllegalArgumentException("PCM chunk size is outside the supported range")
            val input = FloatArray(bytes.size / 2) { i ->
                val value = (bytes[i * 2].toInt() and 0xff) or (bytes[i * 2 + 1].toInt() shl 8)
                value.toShort().toFloat() / 32768f
            }
            val inputName = session.inputNames.first()
            OnnxTensor.createTensor(ortEnvironment, FloatBuffer.wrap(input), longArrayOf(1, input.size.toLong())).use { tensor ->
                session.run(mapOf(inputName to tensor)).use { result ->
                    val outputValue = result[0].value
                    val output = flattenFloatTensor(outputValue)
                    val outBytes = ByteArray(output.size * 2)
                    for (i in output.indices) {
                        val sample = (output[i].coerceIn(-1f, 1f) * 32767f).toInt()
                        outBytes[i * 2] = (sample and 0xff).toByte(); outBytes[i * 2 + 1] = ((sample shr 8) and 0xff).toByte()
                    }
                    call.resolve(JSObject().put("pcm16", Base64.encodeToString(outBytes, Base64.NO_WRAP))
                        .put("frames", output.size).put("model", loadedModelName))
                }
            }
        } catch (error: Exception) { call.reject("On-device inference failed: ${error.message}", error) }
    }

    @PluginMethod
    fun loadStoredOnDeviceModel(call: PluginCall) {
        val name = call.getString("name") ?: run { call.reject("Model name is required"); return }
        val safeName = name.substringAfterLast('/').substringAfterLast('\\')
        if (!safeName.matches(Regex("[A-Za-z0-9_.-]{1,80}\\.onnx", RegexOption.IGNORE_CASE))) { call.reject("Invalid model name"); return }
        try {
            val modelFile = File(File(context.filesDir, "opera-models"), safeName)
            if (!modelFile.isFile) throw IllegalArgumentException("Model is not installed")
            val options = OrtSession.SessionOptions().apply { setIntraOpNumThreads(2); setInterOpNumThreads(1) }
            val next = ortEnvironment.createSession(modelFile.absolutePath, options)
            val old = ortSession; ortSession = next; loadedModelName = safeName
            old?.close(); options.close()
            call.resolve(JSObject().put("name", safeName).put("contract", "float32 mono waveform [1,N] to float32 mono waveform [1,N]"))
        } catch (error: Exception) { call.reject("Could not load stored model: ${error.message}", error) }
    }

    @PluginMethod
    fun listOnDeviceModels(call: PluginCall) {
        val directory = File(context.filesDir, "opera-models")
        val names = directory.listFiles()?.filter { it.isFile && it.extension.equals("onnx", true) }
            ?.map { it.name } ?: emptyList()
        val array = JSArray(); names.forEach { array.put(it) }; call.resolve(JSObject().put("models", array))
    }

    @PluginMethod
    fun unloadOnDeviceModel(call: PluginCall) {
        try { ortSession?.close() } catch (_: Exception) {}
        ortSession = null; loadedModelName = null
        call.resolve()
    }

    @PluginMethod
    fun stopCapture(call: PluginCall) { stopEngine(); call.resolve() }

    @PermissionCallback
    fun permissionResult(call: PluginCall) {
        if (hasPermission("microphone")) startCapture(call) else call.reject("Microphone permission is required")
    }

    private fun attachPlatformEffects(sessionId: Int, ns: Boolean, aec: Boolean, agc: Boolean) {
        fun setEffect(effect: android.media.audiofx.AudioEffect?, enabled: Boolean) { try { effect?.enabled = enabled } catch (_: Exception) {} }
        if (NoiseSuppressor.isAvailable()) {
            if (noiseSuppressor == null) noiseSuppressor = NoiseSuppressor.create(sessionId)
            setEffect(noiseSuppressor, ns)
        }
        if (AcousticEchoCanceler.isAvailable()) {
            if (echoCanceler == null) echoCanceler = AcousticEchoCanceler.create(sessionId)
            setEffect(echoCanceler, aec)
        }
        if (AutomaticGainControl.isAvailable()) {
            if (gainControl == null) gainControl = AutomaticGainControl.create(sessionId)
            setEffect(gainControl, agc)
        }
    }

    private fun capabilities(): JSObject = JSObject().put("noiseSuppressorAvailable", NoiseSuppressor.isAvailable())
        .put("echoCancelerAvailable", AcousticEchoCanceler.isAvailable()).put("automaticGainControlAvailable", AutomaticGainControl.isAvailable())
        .put("onDeviceModelLoaded", ortSession != null).put("onDeviceModelName", loadedModelName)

    private fun flattenFloatTensor(value: Any): FloatArray {
        return when (value) {
            is FloatArray -> value
            is Array<*> -> value.flatMap { item -> flattenFloatTensor(item ?: throw IllegalArgumentException("Null tensor value")).toList() }.toFloatArray()
            else -> throw IllegalArgumentException("Model output must be a float32 tensor")
        }
    }

    private fun createPlayer(rate: Int, bufferBytes: Int): AudioTrack {
        val format = AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build()
        val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
        val builder = AudioTrack.Builder().setAudioAttributes(attributes).setAudioFormat(format)
            .setTransferMode(AudioTrack.MODE_STREAM).setBufferSizeInBytes(bufferBytes)
        if (Build.VERSION.SDK_INT >= 26) builder.setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
        return builder.build().also { if (it.state != AudioTrack.STATE_INITIALIZED) throw IllegalStateException("Playback engine failed to initialize") }
    }

    private fun stopEngine() {
        running.set(false)
        try { recorder?.stop() } catch (_: Exception) {}
        try { player?.pause(); player?.flush(); player?.stop() } catch (_: Exception) {}
        try { captureThread?.join(500) } catch (_: InterruptedException) { Thread.currentThread().interrupt() }
        listOf(noiseSuppressor, echoCanceler, gainControl).forEach { try { it?.release() } catch (_: Exception) {} }
        noiseSuppressor = null; echoCanceler = null; gainControl = null
        recorder?.release(); player?.release()
        recorder = null; player = null; captureThread = null
    }

    override fun handleOnDestroy() {
        stopEngine(); try { ortSession?.close() } catch (_: Exception) {}; ortSession = null
        super.handleOnDestroy()
    }
}
