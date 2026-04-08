import asyncio
import json
import logging
import subprocess
import numpy as np
import openai
from typing import Dict, Any

# Mock/Placeholder imports for WebRTC and Audio Modules
# In production, replace `webrtc_lib` with `aiortc` or `agora-python-sdk`
import webrtc_lib as webrtc  
import whisper
import difflib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VoiceCallingSystem")

class WebRTCVoiceCallModule:
    """
    Independent Voice Calling System for realtime ordering.
    Implements: WebRTC Streaming, Whisper ASR, AI Intent Parsing, eSpeak TTS.
    """
    def __init__(self, menu_data_path="menu.json", openai_api_key=""):
        self.menu_data = self._load_menu(menu_data_path)
        
        # Load Whisper (Speech Recognition)
        logger.info("Loading Whisper model (small)...")
        # In production, we load 'small' or 'medium'
        self.whisper_model = whisper.load_model("small")
        
        # Initialize OpenAI for Intent Parsing (LLM reasoning)
        openai.api_key = openai_api_key
        
    def _load_menu(self, filepath) -> list:
        # Mock load menu returning a generic structure for fuzzy matching
        # Assuming existing menu.json exists somewhere in the app, we mock it here.
        return [
            {"id": "1", "name": "Veg Burger", "price": 50},
            {"id": "2", "name": "Paneer Tikka Pizza", "price": 200},
            {"id": "3", "name": "Coke", "price": 40},
            {"id": "4", "name": "Pepsi", "price": 40},
            {"id": "5", "name": "Cold Coffee", "price": 80},
            {"id": "6", "name": "Iced Tea", "price": 60}
        ]

    async def handle_incoming_call(self, channel_id: str):
        """
        1. WEBRTC PIPELINE
        Connects to Agora/ZEGO via server-side WebRTC components.
        For illustration, using generic WebRTC connection methods.
        """
        logger.info(f"Connecting to Call Channel: {channel_id}")
        connection = webrtc.connect(channel_id, mode="broadcaster")
        
        # Greet user immediately using eSpeak NG TTS
        greeting = "Hello, welcome to our restaurant. You can place your order using voice."
        await self._stream_tts_to_call(connection, greeting)
        
        # Start continuous listening loop
        audio_buffer = np.array([], dtype=np.float32)
        
        while connection.is_active():
            # Receive audio chunk from WebRTC stream (e.g., 100ms chunks)
            chunk = await connection.receive_audio()
            
            # Simple VAD (Voice Activity Detection): wait until silence to process buffer
            if not self._is_silence(chunk):
                audio_buffer = np.append(audio_buffer, chunk)
            else:
                if len(audio_buffer) > 16000: # at least 1 second of audio at 16kHz
                    # Process completed utterance
                    await self._process_utterance(connection, audio_buffer)
                    audio_buffer = np.array([], dtype=np.float32)

    def _is_silence(self, audio_chunk: np.ndarray, threshold=0.01) -> bool:
        """Basic volume threshold for VAD."""
        return np.max(np.abs(audio_chunk)) < threshold

    async def _process_utterance(self, connection, audio_buffer: np.ndarray):
        """
        Processes speech -> text -> intent -> action -> TTS response
        """
        # 2. WHISPER TRANSCRIPTION PIPELINE
        transcript = self._transcribe_audio(audio_buffer)
        logger.info(f"User Transcribed: {transcript}")
        
        if not transcript.strip():
            return
            
        # 3. AI INTENT PARSER
        intent_response = await self._parse_intent(transcript)
        logger.info(f"AI Intent Parsed: {json.dumps(intent_response, indent=2)}")
        
        # Handle matching missing/imperfect names
        intent_response = self._fuzzy_match_menu(intent_response)
        
        # 4. EXECUTE EXISTING CART LOGIC API
        self._execute_action(intent_response)
        
        # 5. eSpeak NG TTS GENERATION & STREAMING
        spoken_response = intent_response.get("spoken_response", "Sorry, I didn't get that.")
        await self._stream_tts_to_call(connection, spoken_response)

    def _transcribe_audio(self, audio_data: np.ndarray) -> str:
        """Uses local OpenAI Whisper to convert audio bytes to text."""
        # Convert audio to 16k Float32 if required by whisper model
        result = self.whisper_model.transcribe(audio_data, language="en")
        return result["text"]

    async def _parse_intent(self, text: str) -> Dict[str, Any]:
        """
        Lightweight LLM Reasoning model for Intent Extraction.
        Understands food commands, quantities, and menu questions.
        """
        menu_context = ", ".join([item["name"] for item in self.menu_data])
        
        system_prompt = f"""
        You are a smart restaurant voice ordering assistant.
        Available Menu Items: {menu_context}
        Extract intents from the user's speech.
        Intents: add_item, remove_item, change_quantity, show_menu, checkout_order, cancel_order, special_instruction, menu_question.
        
        Respond ONLY with a JSON object:
        {{
            "intent": "action_name",
            "items": [{{ "name": "Item Name", "quantity": 1 }}],
            "spoken_response": "Conversational reply confirming the action or answering the query."
        }}
        """
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini", # Keep latency minimal
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.1
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Intent Extraction Failed: {e}")
            return {
                "intent": "unknown", 
                "items": [], 
                "spoken_response": "I'm sorry, I didn't catch that. Could you please repeat your order?"
            }

    def _fuzzy_match_menu(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """Context menu fuzzy matching logic."""
        menu_names = [item["name"] for item in self.menu_data]
        
        if "items" in intent_data:
            for item in intent_data["items"]:
                # thefuzz or difflib approach
                matches = difflib.get_close_matches(item["name"], menu_names, n=1, cutoff=0.6)
                if matches:
                    item["name"] = matches[0]
                    
        return intent_data

    def _execute_action(self, intent_data: Dict[str, Any]):
        """
        Placeholder to trigger EXISTING application cart/order logic via RestAPI/RPC
        DO NOT CHANGE EXISTING UI. Modifying state strictly through APIs.
        """
        intent = intent_data.get("intent")
        items = intent_data.get("items", [])
        
        if intent == "add_item":
            # e.g., requests.post("http://localhost:5000/api/cart/add", json=items)
            logger.info(f"API Trigger: Adding items to cart -> {items}")
        elif intent == "checkout_order":
            # e.g., requests.post("http://localhost:5000/api/checkout")
            logger.info("API Trigger: Checkout initiated.")

    async def _stream_tts_to_call(self, connection, text: str):
        """
        6. eSpeak NG Voice Synthesis & Streaming back to user call.
        """
        logger.info(f"AI Speaking: {text}")
        
        # eSpeak command for Indian English accent
        # Generates RAW PCM data to standard output
        cmd = ["espeak-ng", "-v", "en-in", "-s", "150", "--stdout", text]
        
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        raw_audio, _ = process.communicate()
        
        # Assume WebRTC connection streams PCM bytes back to Agora/Zego Cloud channel
        await connection.send_audio(raw_audio)

if __name__ == "__main__":
    # Standard entry point
    bot = WebRTCVoiceCallModule()
    # Mock starting a call on a specific WebRTC channel ID
    # asyncio.run(bot.handle_incoming_call("agora-channel-123"))
