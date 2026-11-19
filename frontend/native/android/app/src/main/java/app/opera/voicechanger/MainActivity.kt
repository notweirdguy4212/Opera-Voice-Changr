package app.opera.voicechanger

import app.opera.voicechanger.audio.OperaAudioEnginePlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(OperaAudioEnginePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
