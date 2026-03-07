from faster_whisper import WhisperModel
import os

class ASRModule:
    def __init__(self, model_size="tiny"):
        print(f"🎙️ Loading Faster-Whisper '{model_size}' model...")
        # Using CPU for dev environment; can be swapped to 'cuda' in production
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("✅ Whisper model loaded successfully.")

    def transcribe(self, audio_path: str, language=None) -> str:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
        print(f"🎙️ Transcribing {audio_path}...")
        
        # We can optionally force a language if we know the user's selection (e.g. 'en', 'hi', 'gu')
        lang_code = language.split('-')[0] if language else None
        
        segments, info = self.model.transcribe(audio_path, beam_size=5, language=lang_code)
        
        transcription = []
        for segment in segments:
            transcription.append(segment.text)
            
        final_text = "".join(transcription).strip()
        print(f"✅ Transcription: '{final_text}' (Lang: {info.language}, Prob: {info.language_probability:.2f})")
        return final_text

asr = ASRModule("tiny")
