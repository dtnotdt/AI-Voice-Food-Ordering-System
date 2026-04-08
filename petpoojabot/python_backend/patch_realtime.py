import sys
import os

filepath = "realtime_voice_bot.py"
with open(filepath, "r") as f:
    code = f.read()

# Replace eSpeak logic with Piper logic
old_espeak_code = """# ==============================================================================
# eSpeak Voice Availability Cache
# We probe espeak-ng once at startup to know which voices are actually installed.
# If a language voice is missing, we fall back to English.
# ==============================================================================
_AVAILABLE_ESPEAK_VOICES: set = set()

def _probe_espeak_voices():
    \"\"\"Run `espeak-ng --voices` once and cache which voice codes are available.\"\"\"
    global _AVAILABLE_ESPEAK_VOICES
    try:
        result = subprocess.run(
            ["espeak-ng", "--voices"],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines()[1:]:  # skip header
            parts = line.split()
            if len(parts) >= 2:
                _AVAILABLE_ESPEAK_VOICES.add(parts[1])  # language code column
        logger.info(f"eSpeak voices available: {len(_AVAILABLE_ESPEAK_VOICES)} entries")
    except Exception as e:
        logger.warning(f"Could not probe eSpeak voices (will use fallback): {e}")

_probe_espeak_voices()


def _resolve_espeak_voice(lang: str) -> str:
    \"\"\"Return the best eSpeak voice flag for a language, with English fallback.\"\"\"
    desired = LANGUAGE_CONFIG.get(lang, {}).get("espeak_voice", "en-in")
    if desired in _AVAILABLE_ESPEAK_VOICES:
        return desired
    # Try base language code (e.g. "en" from "en-in")
    base = desired.split("-")[0]
    if base in _AVAILABLE_ESPEAK_VOICES:
        return base
    logger.warning(f"eSpeak voice '{desired}' not installed, falling back to en-in")
    return "en-in"
"""


new_piper_code = """# ==============================================================================
# PIPER TTS CONFIGURATION
# ==============================================================================
VOICE_MODELS = {
    "english": "en_US-lessac-medium.onnx",
    "hindi": "hi_IN-model.onnx",
    "gujarati": "gu_IN-model.onnx",
    "marathi": "mr_IN-model.onnx",
    "tamil": "ta_IN-model.onnx",
    "malayalam": "ml_IN-model.onnx",
    "arabic": "ar-model.onnx"
}

def _resolve_piper_voice(lang: str) -> str:
    \"\"\"Return the Piper voice model path for a language, with English fallback.\"\"\"
    model_name = VOICE_MODELS.get(lang)
    if not model_name:
        logger.warning(f"Piper voice model for '{lang}' not found. Falling back to english.")
        model_name = VOICE_MODELS.get("english", "en_US-lessac-medium.onnx")
    
    # Assumes models are downloaded inside a 'models' directory locally
    model_path = os.path.join(os.path.dirname(__file__), "models", model_name)
    return model_path
"""

old_tts_method = """    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE STAGE 8: eSpeak NG TEXT-TO-SPEECH (TTS)
    # ──────────────────────────────────────────────────────────────────────────
    async def _stream_tts(self, websocket: WebSocket, text: str, lang: str):
        logger.info(f"[{self.session.session_id}] AI Speaking ({lang}): {text}")
        voice_flag = _resolve_espeak_voice(lang)

        cmd = ["espeak-ng", "-v", voice_flag, "-s", "150", "--stdout", text]
        try:
            # Run TTS in a thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            audio_bytes = await loop.run_in_executor(None, self._run_tts_sync, cmd)

            if audio_bytes:
                await websocket.send_bytes(audio_bytes)
        except Exception as e:
            logger.error(f"[{self.session.session_id}] TTS Error: {e}")

    @staticmethod
    def _run_tts_sync(cmd: list) -> Optional[bytes]:
        \"\"\"Synchronous subprocess call — run inside executor to stay non-blocking.\"\"\"
        try:
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            audio_bytes, stderr = process.communicate(timeout=10)
            if process.returncode != 0:
                logger.warning(f"eSpeak returned code {process.returncode}: {stderr.decode()}")
            return audio_bytes
        except subprocess.TimeoutExpired:
            process.kill()
            logger.error("eSpeak TTS timed out")
            return None
        except FileNotFoundError:
            logger.error("espeak-ng not found. Install with: brew install espeak")
            return None"""

new_tts_method = """    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE STAGE 8: PIPER TEXT-TO-SPEECH (TTS)
    # ──────────────────────────────────────────────────────────────────────────
    async def generate_tts_audio(self, websocket: WebSocket, text: str, lang: str):
        \"\"\"
        Selects the correct Piper voice model, generates audio output,
        and streams the audio back through the existing WebSocket pipeline.
        \"\"\"
        logger.info(f"[{self.session.session_id}] AI Speaking ({lang}): {text}")
        model_path = _resolve_piper_voice(lang)

        cmd = ["piper", "-m", model_path, "--output_file", "-"]
        try:
            # Run TTS in a thread pool to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            audio_bytes = await loop.run_in_executor(None, self._run_piper_sync, cmd, text)

            if audio_bytes:
                await websocket.send_bytes(audio_bytes)
        except Exception as e:
            logger.error(f"[{self.session.session_id}] TTS Error: {e}")

    @staticmethod
    def _run_piper_sync(cmd: list, text: str) -> Optional[bytes]:
        \"\"\"Synchronous PIPER call — run inside executor to stay non-blocking.\"\"\"
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
            return None"""

# Perform Replacements
if old_espeak_code in code:
    code = code.replace(old_espeak_code, new_piper_code)
else:
    print("Error: Could not find espeak cache setup block to replace.")
    
if old_tts_method in code:
    code = code.replace(old_tts_method, new_tts_method)
else:
    print("Error: Could not find original _stream_tts block to replace.")

# Rename all instances of self._stream_tts to self.generate_tts_audio
code = code.replace("self._stream_tts(", "self.generate_tts_audio(")

with open(filepath, "w") as f:
    f.write(code)

print("Patch applied successfully.")
