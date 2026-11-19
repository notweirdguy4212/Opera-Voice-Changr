# Opera 2.0 — Desktop virtual microphone bridge

Opera's converted playback can be routed to an OS virtual audio cable. The virtual cable is the bridge between Opera's playback output and a conferencing/game app's microphone input. This is a desktop OS audio route, not an Android/iOS system-wide microphone replacement.

## Windows 10/11

1. Install a reputable virtual audio cable driver (for example, VB-Audio Virtual Cable) from its official publisher. Review its installer and licensing before use.
2. Start Opera's backend and open the studio in a Chromium-based browser.
3. In the audio device selector, choose the virtual cable's **playback/output** endpoint as Opera's output. If output selection is unavailable in the browser, set that endpoint as the browser/Windows app output in Windows Volume Mixer.
4. Start Opera audio. Confirm the converted output meter is moving.
5. In Discord, Roblox (where supported), or WhatsApp Desktop, choose the virtual cable's **recording/input** endpoint as the microphone.
6. Use each app's mic test and keep its input sensitivity/noise suppression from clipping or gating the converted signal.
7. To hear yourself, enable monitoring to headphones only. Avoid routing the virtual cable back into speakers; that creates feedback.

## macOS

Install a virtual audio device such as BlackHole from its official source. Select it as Opera's output and as the target app's microphone input. Use a Multi-Output Device only if you understand its clock-drift and feedback implications.

## Linux

Use a PipeWire/PulseAudio virtual source/sink. Route Opera's playback stream to the virtual sink; select the corresponding monitor/source in the target app. `pavucontrol` can make the per-application route visible.

## Safety and troubleshooting

- Use a private, trusted network for the AI backend. For remote access, use HTTPS and authentication; never expose an unauthenticated microphone/model endpoint to the public internet.
- Do not select a loopback/monitor source as both input and output. Use headphones to prevent acoustic feedback.
- If the target app does not list the virtual microphone, restart that app after installing/enabling the driver and check OS microphone permissions.
- App policies, age requirements, account settings and device support may restrict voice chat independently of Opera.
- Do not use voice conversion to impersonate a real person or mislead listeners. Use voices and models you have permission to use.

## Bridge architecture

`Microphone → Opera capture/worklet → WebSocket AI backend → Opera playback → OS virtual cable → target app microphone`

The cable driver is supplied by the OS/vendor, not bundled in this repository. Opera does not silently install kernel audio drivers.
