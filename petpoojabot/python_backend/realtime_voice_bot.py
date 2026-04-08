import asyncio
import json
import logging
import subprocess
import requests
import difflib
import numpy as np
import whisper
import openai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List, Optional
import os
import uuid
from indic_transliteration import sanscript

# ==============================================================================
# REAL-TIME AI VOICE CALLING AGENT (BACKEND)
# Pipeline: WebSocket Stream -> VAD -> Whisper -> OpenAI Intent -> Menu Match -> Node API -> eSpeak TTS -> WebSocket Stream
# Provides the backend implementation for a full-duplex voice ordering copilot.
#
# Supported Languages: English, Hindi, Gujarati, Arabic, Tamil, Malayalam, Marathi
# ==============================================================================

app = FastAPI()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VoiceAgent")

# ==============================================================================
# LANGUAGE CONFIGURATION REGISTRY
# Central lookup for all language-specific settings (Whisper codes, eSpeak voices,
# greeting text, keyword detection patterns).
# ==============================================================================
LANGUAGE_CONFIG = {
    "english": {
        "whisper_code": "en",
        "espeak_voice": "en-in",
        "keywords": ["english", "eng"],
        "greeting": "Great! What would you like to order today?",
    },
    "hindi": {
        "whisper_code": "hi",
        "espeak_voice": "hi",
        "keywords": ["hindi", "हिंदी", "हिन्दी"],
        "greeting": "नमस्ते! मैं आपकी क्या सहायता कर सकता हूँ? आप क्या ऑर्डर करना चाहेंगे?",
    },
    "gujarati": {
        "whisper_code": "gu",
        "espeak_voice": "gu",
        "keywords": ["gujarati", "guju", "ગુજરાતી"],
        "greeting": "નમસ્તે! હું તમારી શું મદદ કરી શકું? તમે શું ઓર્ડર કરવા માંગો છો?",
    },
    "arabic": {
        "whisper_code": "ar",
        "espeak_voice": "ar",
        "keywords": ["arabic", "arabi", "عربي", "العربية"],
        "greeting": "!مرحباً! ماذا تريد أن تطلب اليوم؟",
    },
    "tamil": {
        "whisper_code": "ta",
        "espeak_voice": "ta",
        "keywords": ["tamil", "தமிழ்"],
        "greeting": "வணக்கம்! இன்று நீங்கள் என்ன ஆர்டர் செய்ய விரும்புகிறீர்கள்?",
    },
    "malayalam": {
        "whisper_code": "ml",
        "espeak_voice": "ml",
        "keywords": ["malayalam", "മലയാളം"],
        "greeting": "നമസ്കാരം! ഇന്ന് നിങ്ങൾ എന്താണ് ഓർഡർ ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?",
    },
    "marathi": {
        "whisper_code": "mr",
        "espeak_voice": "mr",
        "keywords": ["marathi", "मराठी"],
        "greeting": "नमस्कार! आज तुम्हाला काय ऑर्डर करायचे आहे?",
    },
}

CLARIFICATION_TEMPLATES = {
    "english": "Did you mean {item1} or {item2}?",
    "hindi": "क्या आपको {item1} चाहिए या {item2}?",
    "gujarati": "શું તમારો મતલબ {item1} હતો કે {item2}?",
    "marathi": "तुम्हाला {item1} पाहिजे की {item2}?",
    "tamil": "நீங்கள் {item1} அல்லது {item2} என சொன்னீர்களா?",
    "malayalam": "നിങ്ങൾ ഉദ്ദേശിച്ചത് {item1} ആണോ അതോ {item2} ആണോ?",
    "arabic": "هل تقصد {item1} أم {item2}؟",
}

# Build a flat keyword -> language lookup for fast detection
_KEYWORD_TO_LANG: Dict[str, str] = {}
for lang_name, cfg in LANGUAGE_CONFIG.items():
    for kw in cfg["keywords"]:
        _KEYWORD_TO_LANG[kw.lower()] = lang_name

SUPPORTED_LANG_NAMES = ", ".join([name.capitalize() for name in LANGUAGE_CONFIG.keys()])

# ==============================================================================
# 1. Initialize Whisper ASR and OpenAI
# ==============================================================================
logger.info("Loading Whisper Speech Recognition Model (small)...")
try:
    whisper_model = whisper.load_model("small")
    logger.info("Whisper loaded.")
except Exception as e:
    logger.error(f"Failed to load Whisper: {e}")
    whisper_model = None

# Set your OpenAI Key (Normally handled by dotenv)
openai.api_key = os.getenv("OPENAI_API_KEY", "your-openai-api-key")

# ==============================================================================
# PIPER TTS CONFIGURATION
# ==============================================================================
VOICE_MODELS = {
    "english": "en_US-lessac-medium.onnx",
    "hindi": "hi_IN-sarika-medium.onnx",
    "marathi": "hi_IN-sarika-medium.onnx",
    "gujarati": "hi_IN-sarika-medium.onnx",
    "tamil": "ml_IN-maya-medium.onnx",
    "malayalam": "ml_IN-maya-medium.onnx",
    "arabic": "ar_JO-kareem-medium.onnx"
}

def resolve_piper_voice(lang: str) -> str:
    """Return the Piper voice model path for a language, with English fallback."""
    model_name = VOICE_MODELS.get(lang.lower())
    if not model_name:
        logger.warning(f"Piper voice model for '{lang}' not found. Falling back to english.")
        model_name = VOICE_MODELS.get("english", "en_US-lessac-medium.onnx")
    
    # Assumes models are downloaded inside a 'models' directory locally
    model_path = os.path.join(os.path.dirname(__file__), "models", model_name)
    return model_path


# ==============================================================================
# SESSION MANAGER
# Each WebSocket connection gets an isolated session so parallel callers don't
# interfere with each other.
# ==============================================================================
class CallSession:
    """Holds per-caller state: language, conversation phase, order context."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state: str = "greeting"          # greeting -> ordering
        self.language: str = "english"        # locked after greeting
        self.order_items: List[Dict] = []     # cumulative items added this call

    def reset(self):
        self.state = "greeting"
        self.language = "english"
        self.order_items.clear()


# ==============================================================================
# REAL-TIME VOICE AGENT
# ==============================================================================
class RealTimeVoiceAgent:
    def __init__(self, session: CallSession):
        self.NODE_API_URL = "http://localhost:3001"
        self.session = session
        self.menu_cache = self._fetch_menu()

    # ── Menu Fetcher ──────────────────────────────────────────────────────────
    def _fetch_menu(self) -> list:
        try:
            resp = requests.get(f"{self.NODE_API_URL}/api/menu", timeout=3)
            if resp.status_code == 200:
                logger.info(f"[{self.session.session_id}] Menu cache loaded from Node API.")
                return resp.json().get("items", [])
        except Exception as e:
            logger.error(f"[{self.session.session_id}] Failed to fetch menu: {e}")
        return []

    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE STAGE 1 & 2: WEBSOCKET AUDIO RECEIVER & VAD
    # ──────────────────────────────────────────────────────────────────────────
    async def process_audio_stream(self, websocket: WebSocket):
        await websocket.accept()

        # Initial AI Greeting — list ALL supported languages
        greeting = (
            "Hello! Welcome to our restaurant. I can take your order. "
            f"Please tell me your preferred language: {SUPPORTED_LANG_NAMES}."
        )
        await self.generate_tts_audio(websocket, greeting, "english")

        audio_buffer = np.array([], dtype=np.float32)
        # Silence frame counter to improve VAD accuracy
        silence_frames = 0
        SILENCE_THRESHOLD = 0.008   # RMS threshold for silence
        MIN_UTTERANCE_SAMPLES = 8000  # Minimum ~0.5s at 16kHz to be considered speech
        SILENCE_FRAMES_TO_COMMIT = 4  # Number of consecutive silent frames before committing

        try:
            while True:
                # Receive raw data from the frontend WebRTC/Mic tunnel
                data = await websocket.receive()

                # ── Handle JSON control messages (e.g. language selection from UI) ──
                if "text" in data:
                    try:
                        msg = json.loads(data["text"])
                        if msg.get("type") == "language_select":
                            lang_code = msg.get("language", "english").lower()
                            if lang_code in LANGUAGE_CONFIG:
                                self.session.language = lang_code
                                self.session.state = "ordering"
                                lang_greeting = LANGUAGE_CONFIG[lang_code]["greeting"]
                                logger.info(f"[{self.session.session_id}] Language set from UI: {lang_code}")
                                await self.generate_tts_audio(websocket, lang_greeting, lang_code)
                            continue
                    except (json.JSONDecodeError, KeyError):
                        pass
                    continue

                # ── AUDIO PIPELINE SAFETY ─────────────────────────────
                raw_bytes = data.get("bytes", b"")
                if not raw_bytes:
                    continue

                # 1. Ensure buffer length is a multiple of element size (int16 = 2 bytes)
                remainder = len(raw_bytes) % 2
                if remainder != 0:
                    raw_bytes = raw_bytes[:-remainder]

                if not raw_bytes:
                    continue

                # 2. Decode int16 → normalised float32 for Whisper
                try:
                    chunk = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                except ValueError:
                    logger.warning(f"[{self.session.session_id}] Skipped malformed audio packet ({len(raw_bytes)} bytes)")
                    continue

                # 3. Clamp to Whisper’s expected range
                chunk = np.clip(chunk, -1.0, 1.0)

                # ── VAD (Voice Activity Detection) with improved silence handling ──
                rms = np.sqrt(np.mean(chunk ** 2))
                if rms > SILENCE_THRESHOLD:
                    audio_buffer = np.append(audio_buffer, chunk)
                    silence_frames = 0
                elif len(audio_buffer) > MIN_UTTERANCE_SAMPLES:
                    silence_frames += 1
                    if silence_frames >= SILENCE_FRAMES_TO_COMMIT:
                        logger.info(f"[{self.session.session_id}] Processing utterance ({len(audio_buffer)} samples, {len(audio_buffer)/16000:.1f}s)...")
                        await self._run_pipeline(websocket, audio_buffer)
                        audio_buffer = np.array([], dtype=np.float32)
                        silence_frames = 0
                else:
                    # Too short, discard
                    silence_frames += 1
                    if silence_frames > 10:
                        audio_buffer = np.array([], dtype=np.float32)
                        silence_frames = 0

        except WebSocketDisconnect:
            logger.info(f"[{self.session.session_id}] Call disconnected by user.")

    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE STAGE 3 & 4: WHISPER ASR & LANGUAGE SELECTION
    # ──────────────────────────────────────────────────────────────────────────
    # Language-specific Whisper context prompts for improved accuracy
    WHISPER_CONTEXT_PROMPTS = {
        "english": "Restaurant ordering conversation: pizza, burger, fries, biryani, naan, paneer tikka, cold coffee, coke.",
        "hindi": "रेस्टोरेंट ऑर्डरिंग: पिज़्ज़ा, बर्गर, फ्राइज, बिरयानी, नान, पनीर टिक्का, कोल्ड कॉफी, कोक",
        "gujarati": "રેસ્ટોરેન્ટ ઓર્ડરિંગ: પિઝ્ઝા, બર્ગર, ફ્રાઇઝ, બિરિયાની, નાન, પનીર ટિક્કા, કોલ્ડ કોફી",
        "arabic": "طلب مطعم: بيتزا، برغر، بطاطس، برياني، نان، بنير تكا، قهوة باردة",
        "tamil": "ரெஸ்டோரெண்ட் ஆர்டர்: பிச்சா, பர்கர், பிரைஸ், பிரியாணி, நான், பனீர் டிக்கா, கோல்ட் காபி",
        "malayalam": "റെസ്റ്റോറന്റ് ഓർഡർ: പിസ്സ, ബർഗർ, ഫ്രൈസ്, ബിരിയാണി, നാൻ, പനീർ ടിക്ക, കോൾഡ് കാപ്പി",
        "marathi": "रेस्टॉरंट ऑर्डर: पिझ्झा, बर्गर, फ्राइज, बिरयानी, नान, पनीर टिक्का, कोल्ड कॉफी",
    }

    async def _run_pipeline(self, websocket: WebSocket, audio_data: np.ndarray):
        if not whisper_model:
            return

        # Transcribe — hint Whisper with the session language + context prompt
        whisper_lang = LANGUAGE_CONFIG.get(self.session.language, {}).get("whisper_code")
        transcribe_opts = {}
        if self.session.state == "ordering" and whisper_lang:
            # Once language is locked, hint Whisper to improve accuracy
            transcribe_opts["language"] = whisper_lang

        # Add language-specific context prompt for improved recognition
        context_prompt = self.WHISPER_CONTEXT_PROMPTS.get(self.session.language, "")
        if context_prompt:
            transcribe_opts["initial_prompt"] = context_prompt

        result = whisper_model.transcribe(audio_data, **transcribe_opts)
        transcript = result["text"].strip()
        if not transcript:
            return

        # Normalise non-Latin scripts: strip zero-width joiners, normalise whitespace
        transcript = transcript.replace("\u200c", "").replace("\u200d", "").strip()

        logger.info(f"[{self.session.session_id}] User Said: \"{transcript}\"")

        # ── State: Greeting — detect language ────────────────────────────
        if self.session.state == "greeting":
            self._handle_language_selection(transcript)
            lang = self.session.language
            resp = LANGUAGE_CONFIG.get(lang, {}).get("greeting", "What would you like to order?")
            self.session.state = "ordering"
            await self.generate_tts_audio(websocket, resp, lang)
            return

        # ── State: Ordering — AI reasoning layer ─────────────────────────
        await self._process_order_intent(websocket, transcript)

    def _handle_language_selection(self, text: str):
        """Detect language from spoken keywords across all supported languages."""
        text_lower = text.lower()
        for keyword, lang_name in _KEYWORD_TO_LANG.items():
            if keyword in text_lower:
                self.session.language = lang_name
                logger.info(f"[{self.session.session_id}] Language locked to: {lang_name}")
                return
        # Fallback: keep English
        self.session.language = "english"
        logger.info(f"[{self.session.session_id}] Language defaulted to: english")

    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE STAGE 5 & 6: OPENAI INTENT PARSING & MENU CONTEXT MATCHER
    # ──────────────────────────────────────────────────────────────────────────
    async def _process_order_intent(self, websocket: WebSocket, text: str):
        menu_names = ", ".join([m["name"] for m in self.menu_cache])
        lang = self.session.language

        system_prompt = f"""
You are a highly capable multilingual restaurant AI voice assistant.
The user's currently locked language is: {lang}. All your responses MUST be in {lang}.

Available Menu Items:
{menu_names}

RULES:
1. Extract food order items, their quantities, and ANY special modifications in the user's speech.
2. CRITICAL: Any spoken modifiers (e.g. "extra spicy", "less cheese", "no mayo", "make it jain", "bina pyaaz", "without ice") MUST be extracted entirely into "special_instructions". Do not include them in the item name!
3. Intent options: "add_to_cart" (ordering), "checkout", "question" (asking about menu), "remove_item", "modify_quantity", "cancel_order".
4. If the user asks a question about the menu, answer it conversationally.
5. If the user is cancelling or removing, map the intent and name the item to remove.

Respond STRICTLY with this JSON object:
{{
    "intent": "add_to_cart" | "checkout" | "question" | "remove_item" | "modify_quantity" | "cancel_order",
    "items": [{{ "name": "Exact item name without modifiers", "quantity": 1, "special_instructions": "Extracted modifiers here" }}],
    "response": "<YOUR_NATURAL_VOICE_REPLY_IN_{lang.upper()}>"
}}
"""

        try:
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.1
            )

            raw_content = response.choices[0].message.content
            # Strip markdown fences if the model wraps JSON in ```json ... ```
            if raw_content.startswith("```"):
                raw_content = raw_content.split("\n", 1)[-1].rsplit("```", 1)[0]

            ai_data = json.loads(raw_content)
            logger.info(f"[{self.session.session_id}] AI Intent: {json.dumps(ai_data, ensure_ascii=False)}")

            from smart_matcher import smart_matcher
            
            clarification_needed = False
            clarification_msg = ""

            if "items" in ai_data:
                for item in list(ai_data["items"]):  # copy list to modify safely
                    # Run it through our massive 3-tier multilingual matcher
                    sm_result = smart_matcher.match(item.get("name", ""))
                    if sm_result:
                        item["name"] = sm_result['item']['name']
                        item["item_id"] = sm_result['item']['id']
                        
                        # Handle Ambiguity
                        if sm_result.get('needs_clarification'):
                            alt_name = sm_result['alternatives'][0]['name']
                            clarification_needed = True
                            fallback_template = CLARIFICATION_TEMPLATES.get(lang.lower(), CLARIFICATION_TEMPLATES["english"])
                            clarification_msg = fallback_template.format(item1=item["name"], item2=alt_name)
                            # Remove this ambiguous item from cart until clarified
                            ai_data["items"].remove(item)
                            continue
                            
                        # Track in session if correctly validated
                        self.session.order_items.append(item)
                    else:
                        item["name"] = item.get("name", "Unknown Item")

            # Execute node cart logic
            self._trigger_existing_app_api(ai_data)

            # Stream response back
            # If ambiguous, completely override the AI's standard TTS response to ask the question natively
            if clarification_needed:
                reply = clarification_msg
            else:
                reply = ai_data.get("response", "Done! Anything else?")
                
            await self.generate_tts_audio(websocket, reply, lang)

        except json.JSONDecodeError as e:
            logger.error(f"[{self.session.session_id}] JSON parse error from OpenAI: {e}")
            await self.generate_tts_audio(
                websocket,
                "I'm sorry, I didn't catch that. Could you please repeat?",
                lang
            )
        except Exception as e:
            logger.error(f"[{self.session.session_id}] Intent Extraction Error: {e}")
            await self.generate_tts_audio(
                websocket,
                "I'm sorry, I didn't catch that. Could you please repeat?",
                lang
            )

    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE STAGE 7: INTEGRATION WITH EXISTING ORDERING SYSTEM APIs
    # ──────────────────────────────────────────────────────────────────────────
    def _trigger_existing_app_api(self, ai_data: Dict[str, Any]):
        """
        Connects the Voice AI strictly to existing backend API hooks.
        Prevents breaking UI/Cart functionality.
        """
        intent = ai_data.get("intent")
        if intent == "add_to_cart":
            for item in ai_data.get("items", []):
                logger.info(
                    f"[{self.session.session_id}] API: Add-to-Cart "
                    f"{item.get('quantity', 1)}x {item['name']}"
                    f" | instructions: {item.get('special_instructions', 'none')}"
                )
                # In production, uncomment to call the existing Node API:
                # requests.post(f"{self.NODE_API_URL}/api/ai/intent", json={
                #     "text": f"add {item.get('quantity',1)} {item['name']}",
                #     "language": "en-IN"
                # })

    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE STAGE 8: PIPER TEXT-TO-SPEECH (TTS)
    # ──────────────────────────────────────────────────────────────────────────
    async def generate_tts_audio(self, websocket: WebSocket, text: str, lang: str):
        """
        Selects the correct Piper voice model, generates audio output,
        and streams the audio back through the existing WebSocket pipeline.
        """
        logger.info(f"[{self.session.session_id}] Detected Language for TTS: {lang}")
        logger.info(f"[{self.session.session_id}] Original TTS Text: {text}")
        
        pronunciation_text = text
        try:
            # --- TRANSLITERATION FOR PIPER COMPATIBILITY ---
            # Piper supports a subset of Indian scripts accurately.
            # We mapped Gujarati and Marathi to Hindi (Devanagari), and Tamil to Malayalam.
            lang_lower = lang.lower()
            if lang_lower == "gujarati" or lang_lower == "marathi":
                source_script = sanscript.GUJARATI if lang_lower == "gujarati" else sanscript.DEVANAGARI
                pronunciation_text = sanscript.transliterate(text, source_script, sanscript.DEVANAGARI)
            elif lang_lower == "tamil":
                pronunciation_text = sanscript.transliterate(text, sanscript.TAMIL, sanscript.MALAYALAM)
        except Exception as trans_err:
            logger.warning(f"[{self.session.session_id}] Transliteration warning: {trans_err}")
            
        logger.info(f"[{self.session.session_id}] Transliterated/Final TTS Text: {pronunciation_text}")

        model_path = resolve_piper_voice(lang)
        logger.info(f"[{self.session.session_id}] Selected Piper Model Path: {model_path}")

        cmd = ["piper", "-m", model_path, "--output_file", "-"]
        try:
            # Run TTS in a thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            audio_bytes = await loop.run_in_executor(None, self._run_piper_sync, cmd, pronunciation_text)

            if audio_bytes:
                await websocket.send_bytes(audio_bytes)
        except Exception as e:
            logger.error(f"[{self.session.session_id}] TTS Error: {e}")

    @staticmethod
    def _run_piper_sync(cmd: list, text: str) -> Optional[bytes]:
        """Synchronous PIPER call — run inside executor to stay non-blocking."""
        try:
            # Piper operates by taking the input text via STDIN
            # We encode the unicode text properly for languages like Hindi, Tamil, Arabic
            process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            audio_bytes, stderr = process.communicate(input=text.encode("utf-8"), timeout=15)
            
            if process.returncode != 0:
                logger.warning(f"Piper returned code {process.returncode}: {stderr.decode()}")
                
            return audio_bytes
        except subprocess.TimeoutExpired:
            process.kill()
            logger.error("Piper TTS timed out")
            return None
        except FileNotFoundError:
            logger.error("Piper not found. Ensure Piper is installed and available in PATH.")
            return None


# ==============================================================================
# WEBSOCKET ENDPOINT
# ==============================================================================
@app.websocket("/ws/voice-call")
async def voice_call_endpoint(websocket: WebSocket):
    session_id = str(uuid.uuid4())[:8]
    session = CallSession(session_id)
    logger.info(f"New call session: {session_id}")

    agent = RealTimeVoiceAgent(session)
    await agent.process_audio_stream(websocket)

    logger.info(f"Session {session_id} ended. Items ordered: {session.order_items}")


if __name__ == "__main__":
    import uvicorn
    # Runs the Voice Service alongside the main app on port 8002
    uvicorn.run(app, host="0.0.0.0", port=8002)
