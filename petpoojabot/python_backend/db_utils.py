"""
Database utilities and error handling for PetpoojaBot
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from database import Base, Customer, Order, OrderItem

# Database connection with error handling
def get_database_url():
    """Get database URL from environment variables or default to PostgreSQL"""
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/petpooja_db")
    return database_url

def create_database_engine():
    """Create database engine with proper error handling"""
    try:
        engine = create_engine(get_database_url())
        return engine
    except Exception as e:
        print(f"❌ Failed to create database engine: {e}")
        raise

def get_db_session():
    """Get database session with error handling"""
    try:
        engine = create_database_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        return SessionLocal()
    except Exception as e:
        print(f"❌ Failed to create database session: {e}")
        raise

def init_database():
    """Initialize database tables with error handling"""
    try:
        engine = create_database_engine()
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        return True
    except SQLAlchemyError as e:
        print(f"❌ Database initialization failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error during database initialization: {e}")
        return False

def validate_phone_number(phone_number: str) -> str:
    """Validate and clean phone number"""
    import re
    
    if not phone_number:
        raise ValueError("Phone number is required")
    
    # Remove all non-digit characters except +
    clean_phone = re.sub(r'[^\d+]', '', phone_number)
    
    # Basic validation
    phone_pattern = r'^[+]?[\d]{10,15}$'
    if not re.match(phone_pattern, clean_phone):
        raise ValueError("Invalid phone number format")
    
    return clean_phone

def handle_database_error(func):
    """Decorator for database error handling"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except SQLAlchemyError as e:
            print(f"❌ Database error: {e}")
            raise
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            raise
    return wrapper

if __name__ == "__main__":
    # Test database initialization
    if init_database():
        print("🎉 Database is ready!")
    else:
        print("💥 Database initialization failed!")
