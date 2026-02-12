
import cv2
import os
import time
import json
import base64
import pyttsx3
import io
import google.generativeai as genai
from PIL import Image
from ctypes import cast, POINTER
from comtypes import CLSCTX_ALL

# Optional: Windows volume control dependencies
try:
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
except ImportError:
    print("Warning: 'pycaw' not found. Volume control will be disabled.")
    AudioUtilities = None

# 1. INITIALIZATION
# Ensure your API_KEY is set in your environment variables
API_KEY = os.environ.get("API_KEY", "")
if not API_KEY:
    print("Error: API_KEY environment variable not set.")
    exit(1)

genai.configure(api_key=API_KEY)
# Using gemini-2.0-flash for high-speed scene understanding
model = genai.GenerativeModel('gemini-2.0-flash')

# Initialize TTS Engine
engine = pyttsx3.init()
voices = engine.getProperty('voices')
# Try to find a Chinese voice if available
for voice in voices:
    if "Chinese" in voice.name or "Huihui" in voice.name:
        engine.setProperty('voice', voice.id)
        break

def set_system_volume(level):
    """Sets master volume on Windows (0.0 to 1.0)"""
    if not AudioUtilities: return
    try:
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        volume.SetMasterVolumeLevelScalar(level, None)
    except Exception as e:
        print(f"Volume error: {e}")

def analyze_frame(frame):
    """Sends frame to Gemini for Fatigue Scene Understanding"""
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb_frame)
    
    # Save to buffer
    img_byte_arr = io.BytesIO()
    pil_img.save(img_byte_arr, format='JPEG')
    img_data = img_byte_arr.getvalue()

    prompt = """
    Identify signs of driver fatigue in this image. 
    Analyze: eye closure, blink frequency, head tilt, and yawning.
    Return ONLY a JSON object with this schema:
    {
      "fatigueLevel": "LOW" | "MODERATE" | "HEAVY",
      "reason": "Brief Chinese explanation",
      "blinkRate": number
    }
    """
    
    try:
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': img_data},
            prompt
        ])
        # Clean response text
        text = response.text.strip()
        if text.startswith("```json"): text = text[7:-3]
        elif text.startswith("```"): text = text[3:-3]
        return json.loads(text)
    except Exception as e:
        print(f"Analysis failed: {e}")
        return None

def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not access camera.")
        return

    print("GuardDrive AI Active. Monitoring driver state...")
    print("Press 'q' to quit.")

    last_analysis_time = 0
    analysis_interval = 4  # seconds

    while True:
        ret, frame = cap.read()
        if not ret: break

        # Visual Overlay
        cv2.putText(frame, "GuardDrive AI: Active", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow('GuardDrive AI - System Monitor', frame)

        now = time.time()
        if now - last_analysis_time > analysis_interval:
            result = analyze_frame(frame)
            if result:
                level = result.get("fatigueLevel", "LOW")
                reason = result.get("reason", "状态正常")
                print(f"[{level}] {reason}")

                if level == "MODERATE":
                    engine.say("建议您到下一个服务区休息，安全驾驶。")
                    engine.runAndWait()
                elif level == "HEAVY":
                    print("!!! ALERT: HEAVY FATIGUE DETECTED !!!")
                    set_system_volume(0.2) # Lower music volume
                    engine.say("警告！检测到严重疲劳！请立即靠边停车！")
                    engine.runAndWait()
            
            last_analysis_time = now

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
