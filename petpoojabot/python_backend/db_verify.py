import os
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from database import User, Session, Message, VoiceMetadata, AiLog, ErrorLog, LanguagePreference, Base
import uuid
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///local_dev.db")
print(f"🔍 Testing Database Connection to: {DATABASE_URL}")

try:
    engine = create_engine(DATABASE_URL)
    connection = engine.connect()
    print("✅ Database connected successfully")
    connection.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
    exit(1)

print("\n🔍 Checking Schema / Tables...")
inspector = inspect(engine)
tables = inspector.get_table_names()

expected_tables = [
    "users", "sessions", "messages", "voice_metadata", 
    "ai_logs", "error_logs", "language_preferences",
    "customers", "orders", "order_items", "menu_items"
]

missing = []
for table in expected_tables:
    if table in tables:
        print(f"✅ Table '{table}' exists.")
    else:
        print(f"❌ Table '{table}' is MISSING. Ensure database.init_db() is called.")
        missing.append(table)

if missing:
    print("\nAttempting to create missing tables...")
    Base.metadata.create_all(bind=engine)
    print("🛠️ Tables created.")
else:
    print("✅ All required tables verified.")

print("\n🔍 Performing Sample Insert & Fetch...")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # 1. Insert Test
    test_uid = f"usr_test_{uuid.uuid4().hex[:6]}"
    test_sid = f"sess_test_{uuid.uuid4().hex[:6]}"
    
    test_user = User(user_id=test_uid, name="Integration Test User")
    db.add(test_user)
    
    test_session = Session(session_id=test_sid, user_id=test_uid, detected_language="en-US")
    db.add(test_session)
    
    test_msg = Message(
        message_id=f"msg_test_{uuid.uuid4().hex[:6]}",
        session_id=test_sid,
        sender_type="user",
        original_text="Hello DB Test",
        language="en-US"
    )
    db.add(test_msg)
    
    db.commit()
    print(f"✅ Successfully inserted User ({test_uid}), Session ({test_sid}), and Message.")
    
    # 2. Fetch Test
    fetched_user = db.query(User).filter(User.user_id == test_uid).first()
    fetched_session = db.query(Session).filter(Session.session_id == test_sid).first()
    fetched_msg = db.query(Message).filter(Message.session_id == test_sid).first()
    
    print("\n--- Fetched Records ---")
    print(f"User: ID={fetched_user.user_id}, Name={fetched_user.name}")
    print(f"Session: ID={fetched_session.session_id}, Lang={fetched_session.detected_language}")
    print(f"Message: ID={fetched_msg.message_id}, Text='{fetched_msg.original_text}'")
    print("-----------------------")
    print("✅ Read operation successful")

finally:
    db.close()

print("\n🎉 Database Verification Complete!")
