import sounddevice as sd
from scipy.io.wavfile import write
import numpy as np
import os
import time
from gtts import gTTS
import subprocess
import requests
import json

# Backend URL config
BACKEND_URL = "http://localhost:8000"

def play_audio(file_path):
    print(f"🔊 Playing audio: {file_path}")
    try:
        # MacOS native audio player
        subprocess.run(["afplay", file_path])
    except Exception as e:
        print(f"Error playing audio: {e}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

def speak_text(text, language="hi"):
    """
    Generate and play TTS audio using gTTS.
    """
    tts = gTTS(text=text, lang=language, slow=False)
    filename = f"response_{int(time.time())}.mp3"
    tts.save(filename)
    play_audio(filename)

def record_audio(filename="user_audio.wav", duration=6, fs=44100):
    """
    Records audio from the microphone using sounddevice and saves it as a WAV file.
    """
    print("🟢 Listening... Speak your order now! (Recording for 6 seconds)")
    try:
        recording = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='int16')
        sd.wait()  # Wait until recording is finished
        print("✅ Recording complete. Processing...")
        
        write(filename, fs, recording)  # Save as WAV file 
        return filename
    except Exception as e:
        print(f"❌ Recording error: {e}")
        return None

def main():
    print("====================================")
    print("🎙️ PETPOOJA VOICE COPILOT TERMINAL 🎙️")
    print("====================================")
    
    # Select preferred language
    print("Select Language: 1) English, 2) Hindi, 3) Gujarati")
    choice = input("Enter 1, 2, or 3: ").strip()
    
    if choice == '2':
        lang = "hi"
        lang_code = "hi-IN"
        intro = "नमस्ते! मैं आपका AI ऑर्डर असिस्टेंट हूँ। आप बोलकर ऑर्डर कर सकते हैं।"
    elif choice == '3':
        lang = "gu"
        lang_code = "gu-IN"
        intro = "નમસ્તે! હું તમારો AI ઓર્ડર સહાયક છું. તમે બોલીને ઓર્ડર આપી શકો છો."
    else:
        lang = "en"
        lang_code = "en-IN"
        intro = "Hello! I am your AI Order Assistant. You can speak to order."
        
    print(intro)
    speak_text(intro, language=lang)
    
    while True:
        input("\nPress ENTER to start recording (or CTRL+C to quit)...")
        
        audio_file = record_audio("temp_recording.wav")
        if not audio_file:
            retry_msg = "माफ़ कीजिए, मैं ठीक से समझ नहीं पाया। कृपया दोबारा बोलिए।" if lang == "hi" else "Sorry, I didn't catch that. Please try again."
            speak_text(retry_msg, language=lang)
            continue
            
        # Send audio to Python Backend for the full pipeline processing
        print("📡 Sending audio to Cognitive Engine Pipeline...")
        try:
            with open(audio_file, 'rb') as f:
                files = {'file': (audio_file, f, 'audio/wav')}
                data = {'language': lang_code}
                
                response = requests.post(f"{BACKEND_URL}/nlp/pipeline", files=files, data=data)
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"📄 Transcript: {result.get('transcript')}")
                    print(f"🧠 Intent Parsed: {json.dumps(result.get('intent'), indent=2)}")
                    print(f"💬 Reply: {result.get('reply')}")
                    
                    # Play the translated response audio
                    reply_text = result.get('reply')
                    if reply_text:
                        speak_text(reply_text, language=lang)
                else:
                    print(f"❌ Server Error: {response.status_code} - {response.text}")
                    speak_text("Server error occurred.", language="en")
                    
        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to backend (http://localhost:8000). Is it running?")
        except Exception as e:
            print(f"❌ Error during pipeline execution: {e}")
        finally:
            if os.path.exists(audio_file):
                os.remove(audio_file)

if __name__ == "__main__":
    main()
