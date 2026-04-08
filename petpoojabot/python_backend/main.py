from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import re
from database import SessionLocal, Customer, Order, OrderItem, User, Session as DBSession, Message, VoiceMetadata, AiLog, ErrorLog, LanguagePreference, OTPRecord, engine, Base
import uuid
import time
from datetime import timedelta
from otp_service import OTPService
import random

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="PetpoojaBot Cognitive Engine", version="7.0.0")

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Models
class LoginRequest(BaseModel):
    phone_number: str
    name: str = None

class LoginResponse(BaseModel):
    customer_id: int
    phone_number: str
    name: str = None
    is_new_customer: bool

class OrderItemResponse(BaseModel):
    item_name: str
    quantity: int
    price: float

class OrderHistoryResponse(BaseModel):
    order_id: int
    order_date: str
    status: str
    items: list[OrderItemResponse]
    total_price: float

class OrderHistoryList(BaseModel):
    phone_number: str
    orders: list[OrderHistoryResponse]

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

@app.get("/health/db")
def health_check_db(db: Session = Depends(get_db)):
    """Health check endpoint to verify database connectivity and schema."""
    try:
        # Check if users table is accessible
        count = db.query(User).count()
        return {
            "status": "online",
            "database": "connected",
            "users_count": count,
            "message": "Database connected successfully and tables validated."
        }
    except Exception as e:
        return {
            "status": "error",
            "database": "disconnected",
            "error": str(e)
        }

@app.get("/health/openai")
def health_check_openai():
    """Health check for OpenAI API key presence and client initialization."""
    import os
    api_key = os.getenv("OPENAI_API_KEY", "")
    
    if not api_key:
        return {
            "status": "unconfigured",
            "api_key_present": False,
            "message": "OPENAI_API_KEY environment variable is not set. The bot will use local fallback regex parser only.",
            "required_action": "Set OPENAI_API_KEY=sk-... in python_backend/.env"
        }
    
    # Test client initialization
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        
        # Quick ping — cheapest possible call
        models = client.models.list()
        model_names = [m.id for m in models.data[:3]]
        return {
            "status": "ok",
            "api_key_present": True,
            "api_key_prefix": api_key[:8] + "...",
            "sample_models": model_names,
            "message": "OpenAI API is connected and working correctly."
        }
    except Exception as e:
        return {
            "status": "error",
            "api_key_present": True,
            "api_key_prefix": api_key[:8] + "...",
            "error": str(e),
            "message": "OpenAI API key is set but the connection failed. Check if the key is valid."
        }


class AuthRequest(BaseModel):
    full_name: str
    phone_number: str
    email_id: str
    verification_method: str  # "phone" or "email"

class VerifyRequest(BaseModel):
    contact_value: str
    otp: str

@app.get("/health/otp")
def health_check_otp():
    """Returns the current status of all OTP delivery providers."""
    return OTPService.check_providers()

@app.post("/api/auth/request-otp")
def request_otp(request: AuthRequest, db: Session = Depends(get_db)):
    """Request an OTP. Returns truthful delivery status. Never lies about delivery."""
    from datetime import datetime

    # Validate method
    if request.verification_method not in ["phone", "email"]:
        raise HTTPException(status_code=400, detail="Invalid verification method. Use 'phone' or 'email'.")

    # Normalize inputs
    raw_phone = re.sub(r'[^\d+]', '', request.phone_number.strip())
    raw_email = request.email_id.strip().lower()

    # Validate phone
    if request.verification_method == "phone":
        if not re.match(r'^[+]?[\d]{10,15}$', raw_phone):
            raise HTTPException(status_code=400, detail="Invalid phone number format. Must be 10-15 digits.")

    # Validate email
    if request.verification_method == "email":
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', raw_email):
            raise HTTPException(status_code=400, detail="Invalid email address format.")

    contact_val = raw_phone if request.verification_method == "phone" else raw_email

    # ── Cooldown Check (60 seconds) ──────────────────────────────────────
    recent = db.query(OTPRecord).filter(OTPRecord.contact_value == contact_val).first()
    if recent and recent.last_sent_at:
        elapsed = (datetime.utcnow() - recent.last_sent_at).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting a new OTP."
            )

    # ── Find or Create User ──────────────────────────────────────────────
    user = db.query(User).filter(
        (User.phone_email == raw_phone) | (User.phone_email == raw_email)
    ).first()

    if not user:
        user_id = f"usr_{uuid.uuid4().hex[:8]}"
        user = User(
            user_id=user_id,
            name=request.full_name,
            phone_email=contact_val,
            verification_method=request.verification_method
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.name = request.full_name
        user.verification_method = request.verification_method
        db.commit()

    # ── Generate OTP ─────────────────────────────────────────────────────
    otp_code = str(random.randint(100000, 999999))
    expires  = datetime.utcnow() + timedelta(minutes=5)

    # Invalidate old OTPs for this contact
    db.query(OTPRecord).filter(OTPRecord.contact_value == contact_val).delete()

    otp_record = OTPRecord(
        user_id=user.user_id,
        contact_value=contact_val,
        otp_hash=otp_code,
        expires_at=expires,
        last_sent_at=datetime.utcnow()
    )
    db.add(otp_record)
    db.commit()

    # ── Send OTP (with truthful result) ──────────────────────────────────
    fallback_email = raw_email if request.verification_method == "phone" and raw_email else None
    result = OTPService.send_otp(
        method=request.verification_method,
        contact_value=contact_val,
        otp=otp_code,
        fallback_email=fallback_email
    )

    # Update delivery tracking in DB
    otp_record.delivery_channel = result.channel
    otp_record.delivery_status  = "sent" if result.success else "failed"
    db.commit()

    if not result.success:
        # Truthfully surface the error — do NOT return 200 OK
        raise HTTPException(
            status_code=503,
            detail={
                "error": result.message,
                "provider_error": result.provider_error,
                "action": "Please configure TWILIO or SMTP environment variables, or set APP_ENV=development for local testing."
            }
        )

    # ── Build Response ────────────────────────────────────────────────────
    response = {
        "message": result.message,
        "contact": contact_val,
        "channel": result.channel,
        "is_dev_fallback": result.is_dev_fallback,
    }
    # Include OTP in response ONLY in development fallback mode
    if result.is_dev_fallback and result.dev_otp:
        response["dev_otp"] = result.dev_otp
        response["dev_notice"] = "⚠️ Development mode active. OTP shown here because no SMS/email provider is configured."

    return response

@app.post("/api/auth/verify-otp")
def verify_otp(request: VerifyRequest, db: Session = Depends(get_db)):
    """Verify an OTP. Returns truthful result with proper error reasons."""
    from datetime import datetime

    # Normalize contact value
    contact_val = request.contact_value.strip()
    if "@" not in contact_val:
        contact_val = re.sub(r'[^\d+]', '', contact_val)

    record = db.query(OTPRecord).filter(
        OTPRecord.contact_value == contact_val
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="No OTP requested for this contact. Please request a new OTP.")

    if record.expires_at < datetime.utcnow():
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    if record.attempt_count >= 5:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="Too many failed attempts. Please request a new OTP.")

    if record.otp_hash != request.otp.strip():
        record.attempt_count += 1
        remaining_attempts = 5 - record.attempt_count
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect OTP. {remaining_attempts} attempt(s) remaining."
        )

    # ── Verification Success ──────────────────────────────────────────────
    user = db.query(User).filter(User.user_id == record.user_id).first()
    if user:
        if "@" in contact_val:
            user.email_verified = True
        else:
            user.phone_verified = True
        db.commit()

    db.delete(record)
    db.commit()

    return {
        "message": "Verification successful",
        "token": f"auth_{uuid.uuid4().hex}",
        "user_id": user.user_id if user else None,
        "verified": True
    }

@app.post("/api/login", response_model=LoginResponse)
def login_customer(request: LoginRequest, db: Session = Depends(get_db)):
    """Login or register customer using phone number."""
    
    # Validate phone number format (basic validation)
    phone_pattern = r'^[+]?[\d\s\-\(\)]{10,15}$'
    if not re.match(phone_pattern, request.phone_number):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Clean phone number (remove spaces, dashes, parentheses)
    clean_phone = re.sub(r'[^\d+]', '', request.phone_number)
    
    # Check if customer exists
    customer = db.query(Customer).filter(Customer.phone_number == clean_phone).first()
    
    if customer:
        # Existing customer
        return LoginResponse(
            customer_id=customer.id,
            phone_number=customer.phone_number,
            name=customer.name,
            is_new_customer=False
        )
    else:
        # Create new customer
        new_customer = Customer(
            phone_number=clean_phone,
            name=request.name
        )
        db.add(new_customer)
        db.commit()
        db.refresh(new_customer)
        
        return LoginResponse(
            customer_id=new_customer.id,
            phone_number=new_customer.phone_number,
            name=new_customer.name,
            is_new_customer=True
        )

@app.get("/api/order-history/{phone_number}", response_model=OrderHistoryList)
def get_order_history(phone_number: str, db: Session = Depends(get_db)):
    """Get order history for a customer by phone number."""
    
    # Clean and validate phone number
    clean_phone = re.sub(r'[^\d+]', '', phone_number)
    phone_pattern = r'^[+]?[\d]{10,15}$'
    if not re.match(phone_pattern, clean_phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Find customer
    customer = db.query(Customer).filter(Customer.phone_number == clean_phone).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get orders with items, sorted by newest first
    orders = db.query(Order).filter(
        Order.customer_id == customer.id
    ).order_by(Order.created_at.desc()).all()
    
    if not orders:
        return OrderHistoryList(
            phone_number=clean_phone,
            orders=[]
        )
    
    order_responses = []
    for order in orders:
        # Get order items
        order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        
        items_response = [
            OrderItemResponse(
                item_name=item.item_name,
                quantity=item.quantity,
                price=item.price
            )
            for item in order_items
        ]
        
        order_response = OrderHistoryResponse(
            order_id=order.id,
            order_date=order.created_at.isoformat(),
            status=order.status,
            items=items_response,
            total_price=order.total_price
        )
        order_responses.append(order_response)
    
    return OrderHistoryList(
        phone_number=clean_phone,
        orders=order_responses
    )

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
async def execute_voice_pipeline(
    file: UploadFile = File(...), 
    language: str = Form("en-IN"),
    session_id: str = Form(None),
    user_id: str = Form(None),
    db: Session = Depends(get_db)):
    
    start_time = time.time()
    
    # Context ID Management
    if not user_id: user_id = f"usr_{uuid.uuid4().hex[:8]}"
    if not session_id: session_id = f"sess_{uuid.uuid4().hex[:12]}"
    
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
        
        
        elapsed = (time.time() - start_time) * 1000
        
        # --- DB Logging ---
        try:
            # 1. Track User
            user = db.query(User).filter(User.user_id == user_id).first()
            if not user:
                user = User(user_id=user_id, preferred_language=language)
                db.add(user)
                
            # 2. Track Session
            session_rec = db.query(DBSession).filter(DBSession.session_id == session_id).first()
            if not session_rec:
                session_rec = DBSession(session_id=session_id, user_id=user_id, detected_language=language)
                db.add(session_rec)
                
            # 3. Track User Message & AI Reply
            user_msg = Message(message_id=f"msg_{uuid.uuid4().hex[:8]}", session_id=session_id, sender_type="user", 
                               original_text=transcript, translated_text=english_text, language=language)
            ai_msg = Message(message_id=f"msg_{uuid.uuid4().hex[:8]}", session_id=session_id, sender_type="assistant", 
                             original_text=final_reply, translated_text=base_reply, language=language)
            db.add(user_msg)
            db.add(ai_msg)
            
            # 4. Track Voice & AI Logs
            db.add(VoiceMetadata(audio_id=f"aud_{uuid.uuid4().hex[:8]}", session_id=session_id, 
                                 input_audio=temp_audio_path, stt_status="success", tts_status="success"))
            db.add(AiLog(log_id=f"log_{uuid.uuid4().hex[:8]}", session_id=session_id, model_used="whisper+llm", 
                         prompt_type=intent_data.get("action"), response_status="success", latency=elapsed))
            db.commit()
        except Exception as log_e:
            print(f"⚠️ DB Logging Error (Pipeline): {log_e}")
            db.rollback()

        return {
            "transcript": transcript,
            "intent": intent_data,
            "reply": final_reply,
            "session_id": session_id,
            "user_id": user_id
        }
    except Exception as e:
        print(f"❌ Pipeline error: {e}")
        try:
            db.add(ErrorLog(error_id=f"err_{uuid.uuid4().hex[:8]}", session_id=session_id, 
                            error_message=str(e), module_name="execute_voice_pipeline"))
            db.commit()
        except: pass
        return {"error": str(e), "reply": "There was an error."}
    finally:
        if __import__('os').path.exists(temp_audio_path):
            __import__('os').remove(temp_audio_path)

@app.post("/nlp/transcribe")
def process_nlp(request: TranscriptionRequest, db: Session = Depends(get_db)):
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
    
    # --- DB Logging for Text Pathway ---
    try:
        user_id = f"usr_{uuid.uuid4().hex[:8]}"
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        
        user = User(user_id=user_id, preferred_language=request.language)
        session_rec = DBSession(session_id=session_id, user_id=user_id, detected_language=request.language)
        db.add(user)
        db.add(session_rec)
        
        user_msg = Message(message_id=f"msg_{uuid.uuid4().hex[:8]}", session_id=session_id, sender_type="user", 
                           original_text=text, translated_text=english_text, language=request.language)
                           
        # We don't have a generated AI string directly here because this is just NLP transcription, 
        # so we rely on the intent_data for logs.
        db.add(user_msg)
        
        db.add(AiLog(log_id=f"log_{uuid.uuid4().hex[:8]}", session_id=session_id, model_used="llm_text_only", 
                     prompt_type=intent_data.get("action"), response_status="success", latency=elapsed))
        db.commit()
    except Exception as log_e:
        print(f"⚠️ DB Logging Error (Transcribe): {log_e}")
        db.rollback()
    
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
    phone_number: str = None  # Add phone number for customer identification

@app.post("/pos/sync")
def sync_pos_order(request: POSOrderRequest, db: Session = Depends(get_db)):
    # This simulates pushing the normalized JSON order into the restaurant's legacy POS
    print(f"📠 [POS SYNC] Received order for ₹{request.total_amount}")
    
    # Save to database if phone number is provided
    db_order_id = None
    if request.phone_number:
        # Clean and validate phone number
        clean_phone = re.sub(r'[^\d+]', '', request.phone_number)
        phone_pattern = r'^[+]?[\d]{10,15}$'
        if re.match(phone_pattern, clean_phone):
            # Find or create customer
            customer = db.query(Customer).filter(Customer.phone_number == clean_phone).first()
            if not customer:
                customer = Customer(phone_number=clean_phone)
                db.add(customer)
                db.commit()
                db.refresh(customer)
            
            # Create order
            new_order = Order(
                customer_id=customer.id,
                total_price=request.total_amount,
                status="confirmed"
            )
            db.add(new_order)
            db.commit()
            db.refresh(new_order)
            
            # Create order items
            for item in request.items:
                order_item = OrderItem(
                    order_id=new_order.id,
                    item_name=item.get("name", "Unknown Item"),
                    quantity=item.get("quantity", 1),
                    price=item.get("price", 0)
                )
                db.add(order_item)
            
            db.commit()
            db_order_id = new_order.id
            print(f"💾 [POS SYNC] Saved order {new_order.id} for customer {clean_phone}")
    
    ticket = {
        "kitchen_ticket_id": f"KOT-{__import__('uuid').uuid4().hex[:6].upper()}",
        "type": request.order_type,
        "items": request.items,
        "notes": request.instructions,
        "db_order_id": db_order_id
    }
    print(f"🎫 [KOT GENERATED]: {ticket}")
    return {"status": "success", "ticket": ticket, "db_order_id": db_order_id}

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
    phone_number: str  # Add phone number for customer identification
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
def voice_final_confirm(request: VoiceFinalRequest, db: Session = Depends(get_db)):
    """Process the final order and save to database."""
    import uuid
    
    # Clean and validate phone number
    clean_phone = re.sub(r'[^\d+]', '', request.phone_number)
    phone_pattern = r'^[+]?[\d]{10,15}$'
    if not re.match(phone_pattern, clean_phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Find or create customer
    customer = db.query(Customer).filter(Customer.phone_number == clean_phone).first()
    if not customer:
        customer = Customer(phone_number=clean_phone)
        db.add(customer)
        db.commit()
        db.refresh(customer)
    
    # Calculate total
    total = sum(item.get("price", 0) * item.get("quantity", 1) for item in request.cart)
    
    # Create order
    new_order = Order(
        customer_id=customer.id,
        total_price=total,
        status="confirmed"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    # Create order items
    for item in request.cart:
        order_item = OrderItem(
            order_id=new_order.id,
            item_name=item.get("name", "Unknown Item"),
            quantity=item.get("quantity", 1),
            price=item.get("price", 0)
        )
        db.add(order_item)
    
    db.commit()
    
    order_id = f"ORD-{new_order.id:06d}"
    
    print(f"🎉 [FinalConfirm] Order {order_id} placed! ₹{total}")
    print(f"� [FinalConfirm] Customer: {customer.phone_number}")
    print(f"�📍 [FinalConfirm] Delivery: {request.address.get('display_name', 'N/A')}")
    
    return {
        "confirmed": True,
        "order_id": order_id,
        "customer_id": customer.id,
        "total": total,
        "delivery_address": request.address,
        "reply": f"Your order {order_id} has been placed successfully! Total: ₹{total}. We'll deliver to {request.address.get('area', 'your address')}.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
