from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic import BaseModel

app = FastAPI(title="PetpoojaBot Cognitive Engine", version="7.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "online", "service": "PetpoojaBot Cognitive Engine"}

from faiss_matcher import matcher
from translator import translator
from llm_parser import llm_nlu
from asr_module import asr
from smart_matcher import smart_matcher
from phrase_cleaner import clean as clean_phrase
from quantity_parser import parse_quantity, strip_quantity_words
import time

class TranscriptionRequest(BaseModel):
    audio_blob: str
    language: str = "en-IN"
    text: str = None  # Allow direct text injection for testing without audio logic

@app.post("/nlp/pipeline")
async def execute_voice_pipeline(file: UploadFile = File(...), language: str = Form("en-IN")):
    # 1. Save audio to disk temporarily
    temp_audio_path = f"temp_req_{__import__('uuid').uuid4().hex[:6]}.wav"
    with open(temp_audio_path, "wb") as buffer:
        buffer.write(await file.read())
        
    try:
        # 2. Whisper Speech Recognition & Language Detect
        # We enforce context for menu items
        context_prompt = "Restaurant ordering conversation including items like pizza, burger, fries, cold coffee, paneer pizza, coke."
        
        transcript = asr.transcribe(
            temp_audio_path, 
            language=language, 
            initial_prompt=context_prompt
        )
        # Normalize transcript: lowercase + strip for consistent matching
        transcript = transcript.strip()
        print(f"🎙️ Whisper Raw Output: {transcript}")
        
        # 3. Translate to English if needed
        english_text = translator.translate_to_english(transcript, source_lang=language.split('-')[0])
        english_text = english_text.strip()
        
        # 4. Intent Parser (LLM + Menu Matching context built-in)
        intent_data = llm_nlu.parse_intent(english_text)
        
        # 5. Build standard English response structure for action
        base_reply = "I couldn't process your request."
        if intent_data["action"] == "add":
            item = intent_data.get("itemData", {})
            name = item.get("name", "that item")
            base_reply = f"Added {intent_data['quantity']} {name} to your cart."
        elif intent_data["action"] == "remove":
            item = intent_data.get("itemData", {})
            name = item.get("name", "that item")
            base_reply = f"Removed {name} from your cart."
        elif intent_data["action"] == "increase":
            base_reply = f"Increased quantity."
        elif intent_data["action"] == "checkout":
            base_reply = "Proceeding to checkout."
        elif intent_data["action"] == "category_qa":
            base_reply = f"Sure, querying our {intent_data.get('category')} section."
        elif intent_data["action"] == "address":
            base_reply = f"Got it, setting delivery address to {intent_data.get('instructions')}."
        
        # 6. Translate back to native language
        final_reply = translator.translate_from_english(base_reply, target_lang=language)
        
        return {
            "transcript": transcript,
            "intent": intent_data,
            "reply": final_reply
        }
    except Exception as e:
        print(f"❌ Pipeline error: {e}")
        return {"error": str(e), "reply": "There was an error."}
    finally:
        if __import__('os').path.exists(temp_audio_path):
            __import__('os').remove(temp_audio_path)

@app.post("/nlp/transcribe")
def process_nlp(request: TranscriptionRequest):
    # This route stays purely for testing the text pathway from frontend UI
    text = request.text
    if not text:
        return {"error": "Missing text stream."}
    
    start_time = time.time()
    print(f"\n{'='*60}")
    print(f"🎤 [VOICE DEBUG] ── New Request ──")
    print(f"  📝 Raw Transcript: '{text}'")
    print(f"  🌐 Language: {request.language}")
        
    english_text = translator.translate_to_english(text, source_lang=request.language.split('-')[0])
    print(f"  🔄 English Translation: '{english_text}'")
    
    # Parse quantity from raw text BEFORE LLM strips it
    voice_quantity = parse_quantity(text)
    print(f"  🔢 Extracted Quantity: {voice_quantity}")
    
    intent_data = llm_nlu.parse_intent(english_text)
    print(f"  🎯 LLM Intent: action={intent_data.get('action')}, item_id={intent_data.get('item_id')}")
    
    # Override quantity if voice parser found one and LLM defaulted to 1
    if voice_quantity > 1 and intent_data.get('quantity', 1) == 1:
        intent_data['quantity'] = voice_quantity
        print(f"  🔢 Quantity overridden to {voice_quantity} from voice parser")
    
    # If LLM/NLU didn't find an item, try smart matching on the raw text directly
    if not intent_data.get('itemData') and not intent_data.get('item_id'):
        print(f"  🔄 [SMART MATCH FALLBACK] LLM found no item, trying smart matcher...")
        # Strip quantity words before matching to improve accuracy
        cleaned_for_match = strip_quantity_words(text)
        sm_result = smart_matcher.match(cleaned_for_match)
        if not sm_result:
            sm_result = smart_matcher.match(text)  # Try original if stripped fails
        if sm_result:
            intent_data['item_id'] = int(sm_result['item']['id'])
            intent_data['itemData'] = sm_result['item']
            intent_data['search_query'] = sm_result['item']['name']
            intent_data['match_score'] = sm_result['score']
            intent_data['match_method'] = sm_result['method']
            # Only default to 'add' if action is truly unknown — preserve 'remove', 'checkout', etc.
            if intent_data['action'] == 'unknown':
                intent_data['action'] = 'add'
            print(f"  ✅ [SMART MATCH] Resolved: {sm_result['item']['name']} (action: {intent_data['action']}, score: {sm_result['score']:.2f}, method: {sm_result['method']})")
    
    elapsed = (time.time() - start_time) * 1000
    print(f"  ⏱️ Processing Time: {elapsed:.0f}ms")
    print(f"  📊 Final: action={intent_data.get('action')}, item={intent_data.get('itemData', {}).get('name', 'None')}, qty={intent_data.get('quantity', 1)}, score={intent_data.get('match_score', 'N/A')}")
    print(f"{'='*60}\n")
    
    return {"intent": intent_data}

class MatchRequest(BaseModel):
    query: str
    top_k: int = 1

@app.post("/nlp/match")
def match_menu_item(request: MatchRequest):
    if not request.query:
        return {"error": "Empty query"}
    
    result = matcher.match(request.query, top_k=request.top_k)
    return {"matches": result}

from upsell_engine import engine

class UpsellRequest(BaseModel):
    cart_items: list[str]

@app.post("/analytics/upsell")
def get_upsell(request: UpsellRequest):
    if not request.cart_items:
        return {"recommendation": None}
        
    rec = engine.get_upsell(request.cart_items)
    return {"recommendation": rec}

class POSOrderRequest(BaseModel):
    order_type: str = "delivery"
    total_amount: float
    items: list[dict]
    instructions: str = ""
    customer_language_pref: str = "en-IN"

@app.post("/pos/sync")
def sync_pos_order(request: POSOrderRequest):
    # This simulates pushing the normalized JSON order into the restaurant's legacy POS
    print(f"📠 [POS SYNC] Received order for ₹{request.total_amount}")
    ticket = {
        "kitchen_ticket_id": f"KOT-{__import__('uuid').uuid4().hex[:6].upper()}",
        "type": request.order_type,
        "items": request.items,
        "notes": request.instructions
    }
    print(f"🎫 [KOT GENERATED]: {ticket}")
    return {"status": "success", "ticket": ticket}

# ── Voice Ordering Flow Endpoints ─────────────────────────────────────────

from voice_flow import detect_flow_intent
from address_geocoder import geocode_address
from delivery_validator import validate_delivery

class VoiceConfirmRequest(BaseModel):
    cart_items: list[dict]  # [{name, quantity, price}]
    language: str = "en-IN"

class VoiceTextRequest(BaseModel):
    text: str
    language: str = "en-IN"
    state: str = "idle"  # current conversation state

class VoiceAddressRequest(BaseModel):
    text: str
    language: str = "en-IN"

class VoiceFinalRequest(BaseModel):
    cart: list[dict]
    address: dict
    language: str = "en-IN"

@app.post("/voice/confirm")
def voice_confirm_order(request: VoiceConfirmRequest):
    """Read back cart summary and generate upsell suggestions."""
    cart_names = [item.get("name", "") for item in request.cart_items]
    
    # Build cart summary
    summary_parts = []
    total = 0
    for item in request.cart_items:
        qty = item.get("quantity", 1)
        name = item.get("name", "item")
        price = item.get("price", 0)
        summary_parts.append(f"{qty} {name}")
        total += qty * price
    
    summary = ", ".join(summary_parts)
    
    # Get upsell suggestions
    upsell_suggestions = engine.get_voice_upsell(cart_names)
    
    # Build upsell prompt
    if upsell_suggestions:
        suggestion_names = [s["name"] for s in upsell_suggestions]
        if len(suggestion_names) == 1:
            upsell_text = f"Would you like to add {suggestion_names[0]}?"
        else:
            upsell_text = f"Would you like to add {', '.join(suggestion_names[:-1])}, or {suggestion_names[-1]}?"
    else:
        upsell_text = ""
    
    print(f"📋 [VoiceConfirm] Cart: {summary}, Total: ₹{total}")
    print(f"🎯 [VoiceConfirm] Upsell: {[s['name'] for s in upsell_suggestions]}")
    
    return {
        "summary": summary,
        "total": total,
        "upsell_suggestions": upsell_suggestions,
        "upsell_prompt": upsell_text,
        "reply": f"Your order includes {summary}. Total is ₹{total}. {upsell_text}"
    }

@app.post("/voice/upsell-response")
def voice_upsell_response(request: VoiceTextRequest):
    """Handle upsell accept/decline voice response."""
    flow = detect_flow_intent(request.text, current_state="upselling")
    
    result = {"intent": flow["intent"]}
    
    if flow["intent"] == "upsell_accept":
        # Try to find what item they want to add
        raw_text = flow.get("raw_text", request.text)
        sm_result = smart_matcher.match(raw_text)
        if sm_result:
            result["item"] = sm_result["item"]
            result["match_score"] = sm_result["score"]
            result["match_method"] = sm_result["method"]
            print(f"✅ [UpsellResponse] Accepted: {sm_result['item']['name']}")
        else:
            print(f"⚠️ [UpsellResponse] Accepted but no item match in: '{raw_text}'")
    else:
        print(f"⏭️ [UpsellResponse] Declined upsell")
    
    return result

@app.post("/voice/address")
def voice_address(request: VoiceAddressRequest):
    """Geocode spoken address and validate delivery radius."""
    # Translate if needed
    text = request.text
    lang = request.language.split('-')[0]
    if lang != "en":
        text = translator.translate_to_english(request.text, source_lang=lang)
    
    print(f"🗺️ [VoiceAddress] Input: '{request.text}' → English: '{text}'")
    
    # Geocode
    geo = geocode_address(text)
    if not geo:
        return {
            "success": False,
            "reply": "Sorry, I couldn't find that address. Could you please provide more details?",
            "geocoded": None,
        }
    
    # Validate delivery range
    validation = validate_delivery(geo["lat"], geo["lng"])
    
    if validation["within_range"]:
        reply = f"I found your location near {geo['area']}. Is this your delivery location?"
    else:
        reply = f"Sorry, {geo['area']} is {validation['distance_km']}km away, which is outside our {validation['max_radius_km']}km delivery area."
    
    return {
        "success": True,
        "geocoded": geo,
        "validation": validation,
        "reply": reply,
    }

@app.post("/voice/final-confirm")
def voice_final_confirm(request: VoiceFinalRequest):
    """Process the final order via existing order system."""
    import uuid
    
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    
    # Build order summary
    total = sum(item.get("price", 0) * item.get("quantity", 1) for item in request.cart)
    
    print(f"🎉 [FinalConfirm] Order {order_id} placed! ₹{total}")
    print(f"📍 [FinalConfirm] Delivery: {request.address.get('display_name', 'N/A')}")
    
    return {
        "confirmed": True,
        "order_id": order_id,
        "total": total,
        "delivery_address": request.address,
        "reply": f"Your order {order_id} has been placed successfully! Total: ₹{total}. We'll deliver to {request.address.get('area', 'your address')}.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
