import os
import openai
from dotenv import load_dotenv

load_dotenv()

# Configure the OpenAI client with the API key from .env
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class ASRModule:
    # Language-specific context prompts for improved Whisper accuracy
    CONTEXT_PROMPTS = {
        "en": "Restaurant ordering conversation: pizza, burger, fries, biryani, naan, paneer tikka, cold coffee, coke.",
        "hi": "रेस्टोरेंट ऑर्डरिंग: पिज़्ज़ा, बर्गर, फ्राइज, बिरयानी, नान, पनीर टिक्का, कोल्ड कॉफी, कोक",
        "gu": "રેસ્ટોરેન્ટ ઓર્ડરિંગ: પિઝ્ઝા, બર્ગર, ફ્રાઇઝ, બિરિયાની, નાન, પનીર ટિક્કા, કોલ્ડ કોફી",
        "mr": "रेस्टॉरंट ऑर्डर: पिझ्झा, बर्गर, फ्राइज, बिरयानी, नान, पनीर टिक्का, कोल्ड कॉफी",
        "ta": "ரெஸ்டோரெண்ட் ஆர்டர்: பிச்சா, பர்கர், பிரைஸ், பிரியாணி, நான், பனீர் டிக்கா, கோல்ட் காபி",
        "ml": "റെസ്റ്റോറന്റ് ഓർഡർ: പിസ്സ, ബർഗർ, ഫ്രൈസ്, ബിരിയാണി, നാൻ, പനീർ ടിക്ക, കോൾഡ് കാപ്പി",
        "ar": "طلب مطعم: بيتزا، برغر، بطاطس، برياني، نان، بنير تكا، قهوة باردة",
    }

    def transcribe(self, audio_path: str, language=None, initial_prompt=None) -> str:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        print(f"🎙️ Transcribing {audio_path} via OpenAI Whisper API...")

        # Whisper API accepts ISO-639-1 language codes (e.g. 'en', 'hi', 'gu', 'ta', 'ml', 'mr', 'ar')
        lang_code = language.split('-')[0] if language else None

        # If no explicit prompt, use language-specific context
        if not initial_prompt and lang_code:
            initial_prompt = self.CONTEXT_PROMPTS.get(lang_code, self.CONTEXT_PROMPTS.get("en", ""))

        with open(audio_path, "rb") as audio_file:
            kwargs = {
                "model": "whisper-1",
                "file": audio_file,
            }
            if lang_code:
                kwargs["language"] = lang_code
            if initial_prompt:
                kwargs["prompt"] = initial_prompt

            response = client.audio.transcriptions.create(**kwargs)

        final_text = response.text.strip()
        print(f"✅ Transcription: '{final_text}'")
        return final_text


asr = ASRModule()
