import os
import openai
from dotenv import load_dotenv

load_dotenv()

# Configure the OpenAI client with the API key from .env
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class ASRModule:
    def transcribe(self, audio_path: str, language=None, initial_prompt=None) -> str:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        print(f"🎙️ Transcribing {audio_path} via OpenAI Whisper API...")

        # Whisper API accepts ISO-639-1 language codes (e.g. 'en', 'hi', 'gu')
        lang_code = language.split('-')[0] if language else None

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
