import os
import json
import pandas as pd
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime

# SQLite connection - fallback since PostgreSQL download failed due to network restrictions. Use DATABASE_URL for Postgres in prod.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///local_dev.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String, index=True)
    price = Column(Float)
    cost = Column(Float)
    popularity = Column(Float)
    is_veg = Column(Boolean, default=True)
    tags = Column(JSON)  # Will store list of tags
    engine_category = Column(String) # Star, Dog, Puzzle, Plowhorse

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship with orders
    orders = relationship("Order", back_populates="customer")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    total_price = Column(Float, nullable=False)
    status = Column(String, default="pending")  # pending, confirmed, preparing, ready, delivered, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    customer = relationship("Customer", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    item_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)  # Price per item
    
    # Relationship
    order = relationship("Order", back_populates="order_items")

# --- Voice Assistant AI Database Models ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False) # e.g. UUID
    name = Column(String, nullable=True)
    phone_email = Column(String, nullable=True)
    preferred_language = Column(String, default="en-IN")
    verification_method = Column(String, nullable=True)
    phone_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class OTPRecord(Base):
    __tablename__ = "otp_records"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    contact_value = Column(String, nullable=False) # phone or email
    otp_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempt_count = Column(Integer, default=0)
    last_sent_at = Column(DateTime, default=datetime.utcnow)  # For cooldown enforcement
    delivery_channel = Column(String, nullable=True)  # 'sms', 'email', 'dev_fallback'
    delivery_status = Column(String, nullable=True)   # 'sent', 'failed', 'fallback'
    created_at = Column(DateTime, default=datetime.utcnow)

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    active_status = Column(Boolean, default=True)
    detected_language = Column(String, nullable=True)
    device_platform = Column(String, nullable=True)

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String, unique=True, index=True, nullable=False)
    session_id = Column(String, ForeignKey("sessions.session_id"), nullable=False, index=True)
    sender_type = Column(String, nullable=False) # 'user' or 'assistant'
    original_text = Column(String, nullable=False)
    translated_text = Column(String, nullable=True)
    language = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class VoiceMetadata(Base):
    __tablename__ = "voice_metadata"
    id = Column(Integer, primary_key=True, index=True)
    audio_id = Column(String, unique=True, index=True, nullable=False)
    session_id = Column(String, ForeignKey("sessions.session_id"), nullable=False, index=True)
    input_audio = Column(String, nullable=True)
    output_audio = Column(String, nullable=True)
    stt_status = Column(String, nullable=True)
    tts_status = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class AiLog(Base):
    __tablename__ = "ai_logs"
    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String, unique=True, index=True, nullable=False)
    session_id = Column(String, ForeignKey("sessions.session_id"), nullable=False, index=True)
    model_used = Column(String, nullable=True)
    prompt_type = Column(String, nullable=True)
    response_status = Column(String, nullable=True)
    latency = Column(Float, nullable=True)
    token_usage = Column(Integer, nullable=True)
    parsed_intent = Column(String, nullable=True) # JSON structured string
    match_confidence = Column(Float, nullable=True)
    clarification_needed = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class ErrorLog(Base):
    __tablename__ = "error_logs"
    id = Column(Integer, primary_key=True, index=True)
    error_id = Column(String, unique=True, index=True, nullable=False)
    session_id = Column(String, ForeignKey("sessions.session_id"), nullable=True, index=True)
    error_message = Column(String, nullable=False)
    stack_trace = Column(String, nullable=True)
    module_name = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class LanguagePreference(Base):
    __tablename__ = "language_preferences"
    id = Column(Integer, primary_key=True, index=True)
    settings_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    selected_language = Column(String, nullable=False)
    selected_voice = Column(String, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db():
    print("🗄️ Initializing Database Schema...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database ready.")

def seed_database_from_csv():
    db = SessionLocal()
    # Check if seeded
    if db.query(MenuItem).first():
        print("✅ Database already seeded with Menu Items.")
        db.close()
        return
        
    print("🌱 Seeding PostgreSQL/SQLite from CSV...")
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'data', 'menu.csv')
    try:
        df = pd.read_csv(csv_path)
        for _, row in df.iterrows():
            margin = row['price'] - row['cost']
            is_high_margin = margin > 150
            is_high_pop = row['popularity'] > 0.8
            
            cat = 'Dog 🐶'
            if is_high_margin and is_high_pop: cat = 'Star ⭐'
            elif not is_high_margin and is_high_pop: cat = 'Plowhorse 🐎'
            elif is_high_margin and not is_high_pop: cat = 'Puzzle 🧩'
            
            tags = row['tags'].split('|') if pd.notna(row['tags']) else []
            
            item = MenuItem(
                id=int(row['id']),
                name=row['name'],
                category=row['category'],
                price=float(row['price']),
                cost=float(row['cost']),
                popularity=float(row['popularity']),
                is_veg=str(row['isVeg']).lower() == 'true',
                tags=tags,
                engine_category=cat
            )
            db.add(item)
        db.commit()
        print("✅ Menu seeded successfully!")
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    seed_database_from_csv()
