
# GuardDrive AI Desktop Setup (Windows)

This project provides high-performance standalone versions of the Fatigue Monitoring system.

## 1. Python Version (Recommended)

### Requirements
- Python 3.9+
- Webcam

### Installation
```bash
pip install opencv-python google-generativeai pyttsx3 pycaw comtypes Pillow
```

### Running
1. Set your Gemini API Key in your environment:
   ```bash
   set API_KEY=your_key_here
   ```
2. Run the monitor:
   ```bash
   python fatigue_monitor.py
   ```

## 2. C++ Version

### Requirements
- Visual Studio 2022
- OpenCV C++ SDK
- libcurl (for API requests)

### Building
1. Configure OpenCV in your project properties.
2. Link `Windows.lib` and `Ole32.lib` for TTS/Volume control.
3. Compile `fatigue_monitor.cpp`.

## Features
- **Real-time Monitoring**: Low-latency video capture.
- **AI Scene Understanding**: Advanced blink and posture analysis using Gemini 2.0.
- **Hardware Integration**: Direct control over Windows system volume and native speech synthesis.
