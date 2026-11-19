# Opera Voice Changer 5.0.0

> [English](../../README.md) · [Start guide](../START_HERE.md)

面向桌面和 Android 配套应用的实时语音处理工作室。包含 React 界面、Python 服务、DSP 音效、模型管理和预设库。

## 功能 / Features

- 536 built-in presets / 536 ajustes / 536 préréglages across 13 categories.
- Search, filters, favourites, personal presets and progressive loading.
- Pitch/formant controls, supported DSP effects, recordings and model management.
- Desktop Python inference backend and Capacitor Android companion.

## 重要说明 / Important notes

内置 13 个类别共 536 个预设。这些是参数处理方案，不是 536 个神经网络模型或真人声音克隆。神经语音转换需要兼容模型和对应运行环境。

- This repository contains source code, not a signed APK. Android Studio build and device testing are required.
- Model weights are not bundled. Use only models and voice recordings you are authorised to use.
- Do not expose an unauthenticated backend to the public internet.

## 开始使用 / Getting started

安装、启动、Android 构建和故障排查请参阅[入门指南](../START_HERE.md)。Android 无法强制其他应用将 Opera 设为麦克风。

For full commands and troubleshooting, see the [complete start guide](../START_HERE.md) and the [English project README](../../README.md).
