import os
from google.cloud import translate_v2 as translate

# Ensure GOOGLE_APPLICATION_CREDENTIALS is set in production
class TranslationService:
    def __init__(self):
        try:
            self.client = translate.Client()
            self.is_active = True
            print("✅ Google Cloud Translation Client initialized.")
        except Exception as e:
            print(f"⚠️ Google Cloud Translation Client could not initialize (missing credentials?). Fallback mode active. Error: {e}")
            self.is_active = False

    def translate_to_english(self, text: str, source_lang="hi") -> str:
        """
        Translates Hinglish/Hindi/Gujarati text into English for intent parsing.
        """
        if not self.is_active:
            # Fallback for local testing without an API key
            print(f"⚠️ [Fallback translation ignored]: {text}")
            return text 
            
        try:
            # We enforce targeting english 'en'
            result = self.client.translate(text, target_language="en")
            # The result dict contains translatedText
            translated = result['translatedText']
            print(f"🌐 Translated ({source_lang}): '{text}' -> '{translated}'")
            return translated
        except Exception as e:
            print(f"❌ Translation error: {e}")
            return text

    def translate_from_english(self, text: str, target_lang="hi") -> str:
        """
        Translates the synthesized English system response back into the User's native language.
        """
        if not self.is_active or target_lang.startswith("en"):
            return text 
            
        try:
            # We enforce targeting the origin native string
            lang_code = target_lang.split('-')[0]
            result = self.client.translate(text, target_language=lang_code)
            translated = result['translatedText']
            print(f"🌐 Reverse Translation ({target_lang}): '{text}' -> '{translated}'")
            return translated
        except Exception as e:
            print(f"❌ Reverse Translation error: {e}")
            return text

translator = TranslationService()
