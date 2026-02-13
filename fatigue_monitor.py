
import cv2
import os
import time
import json
import pyttsx3
import base64
import google.generativeai as genai
from PIL import Image
import io

# =================================================================
# GuardDrive AI - Fatigue Monitoring System (PYTHON CORE)
# Author: Senior Frontend/AI Engineer Simulation
# =================================================================

# 1. Configuration
API_KEY = os.environ.get("API_KEY", "YOUR_API_KEY_HERE")
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash-lite-latest')

# 2. Hardware Initialization (TTS)
engine = pyttsx3.init()
engine.setProperty('rate', 150)

def speak_alert(message):
    print(f"[HW_TTS] Speaking: {message}")
    engine.say(message)
    engine.runAndWait()

def analyze_frame(frame, lang="CN"):
    """
    Core AI logic: Encodes frame to base64 and calls Gemini Vision API
    """
    _, buffer = cv2.imencode('.jpg', frame)
    img_bytes = buffer.tobytes()
    
    # Construct the instruction
    prompt = f"""
    DRIVER SAFETY MONITOR:
    Analyze this driver face for fatigue. 
    Detect eyes (OPEN/CLOSED), blink frequency, and head posture.
    Return JSON only: {{ "level": "LOW|MODERATE|HEAVY", "reason": "Explain in {'Chinese' if lang=='CN' else 'English'}" }}
    """
    
    try:
        # Simulate Multimodal API Call
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': img_bytes},
            prompt
        ])
        
        # Parse result
        raw_text = response.text.strip()
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0]
            
        return json.loads(raw_text)
    except Exception as e:
        print(f"[AI_ERR] Vision analysis failed: {e}")
        return None

def main():
    print(">>> GUARDDRIVE PYTHON ENGINE STARTING <<<")
    cap = cv2.VideoCapture(0)
    
    last_analysis = 0
    analysis_interval = 5 # seconds
    
    while True:
        ret, frame = cap.read()
        if not ret: break
        
        # Basic HUD
        cv2.putText(frame, "GUARDDRIVE: RUNNING", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow('Driver Monitoring Feed', frame)
        
        current_time = time.time()
        if current_time - last_check > analysis_interval:
            print("[ENGINE] Initiating AI analysis...")
            result = analyze_frame(frame)
            
            if result:
                level = result.get('level', 'LOW')
                reason = result.get('reason', '')
                print(f"[RESULT] Level: {level} | {reason}")
                
                if level == "HEAVY":
                    speak_alert("Warning! Critical fatigue detected. Please pull over.")
                elif level == "MODERATE":
                    speak_alert("Fatigue detected. Suggest taking a rest.")
            
            last_check = current_time
            
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
