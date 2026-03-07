import os
import json
import pandas as pd
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, JSON, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

# In production, use environment variables:
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/petpooja")
DATABASE_URL = "sqlite:///./local_dev.db"  # Fallback to local SQLite for immediate prototyping

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
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

class OrderTransaction(Base):
    __tablename__ = "orders"
    
    order_id = Column(String, primary_key=True, index=True)
    status = Column(String, default="Received")
    payment_method = Column(String)
    total = Column(Float)
    items_json = Column(JSON) # Store raw cart arrays for now
    created_at = Column(DateTime, default=datetime.utcnow)

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
