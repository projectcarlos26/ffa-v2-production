"""
Furniture Forensic Analyst v2 - Database Models
Updated for new form structure
"""

from sqlalchemy import create_engine, Column, String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from pathlib import Path

DB_PATH = Path("/tmp/ffa_mvp.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# SQLite database path (absolute path so Render always uses the same file)
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "ffa_mvp.db"

DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

print("DB_URL:", DATABASE_URL)
print("DB_PATH:", DB_PATH)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Case model - Updated with new fields
class Case(Base):
    __tablename__ = "cases"
    
    id = Column(String, primary_key=True)
    
    # Case Details (Step 1)
    ship_date = Column(String, nullable=True)
    delivery_date = Column(String, nullable=True)
    notification_date = Column(String, nullable=True)
    bol_status = Column(String, nullable=True)  # signed_clean, not_signed, damage_notated, no_bol
    bol_damage_desc = Column(Text, nullable=True)
    carrier = Column(String, nullable=True)
    warehouse = Column(String, nullable=True)
    
    # Item Details (Step 2)
    category = Column(String, nullable=True)
    subcategory = Column(String, nullable=True)
    item_name = Column(String, nullable=True)
    
    # Damage Info (Step 3)
    damage_types = Column(String, nullable=True)  # Comma-separated list
    severity = Column(String, nullable=True)  # Minor, Moderate, Major, Severe
    damage_description = Column(Text, nullable=False)
    damage_location = Column(Text, nullable=True)
    discovery_time = Column(String, nullable=True)
    damage_context = Column(Text, nullable=True)
    
    # Status
    status = Column(String, nullable=False, default="pending")  # pending, processing, complete
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    evidence_items = relationship("EvidenceItem", back_populates="case", cascade="all, delete-orphan")
    verdict = relationship("Verdict", back_populates="case", uselist=False)

# Evidence Item model
class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    angle = Column(String, nullable=True)  # e.g., "front", "side", "top", "bottom"
    upload_order = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationship
    case = relationship("Case", back_populates="evidence_items")

# Verdict model
class Verdict(Base):
    __tablename__ = "verdicts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False, unique=True)
    verdict = Column(String, nullable=False)  # manufacturing, transit, inconclusive
    confidence_score = Column(Integer, nullable=False)  # 0-100
    reasoning = Column(Text, nullable=True)
    pattern_match_score = Column(Integer, nullable=False)  # 0-25
    photo_quality_score = Column(Integer, nullable=False)  # 0-25
    evidence_consistency_score = Column(Integer, nullable=False)  # 0-25
    historical_correlation_score = Column(Integer, nullable=False)  # 0-25
    report_sections = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationship
    case = relationship("Case", back_populates="verdict")

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables