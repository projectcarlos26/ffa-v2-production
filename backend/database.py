"""
Furniture Forensic Analyst v2 - Database Models
Safe, idempotent schema migration with absolute DB path.
"""

from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime, ForeignKey, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# DB PATH: use directory of this file so Render
# always resolves to /app/ffa_mvp.db
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "ffa_mvp.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

logger.info(f"Database path: {DB_PATH}")

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# ─────────────────────────────────────────────
# ORM MODELS
# ─────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True)

    # Case Details (Step 1)
    ship_date = Column(String, nullable=True)
    delivery_date = Column(String, nullable=True)
    notification_date = Column(String, nullable=True)
    bol_status = Column(String, nullable=True)
    bol_damage_desc = Column(Text, nullable=True)
    carrier = Column(String, nullable=True)
    warehouse = Column(String, nullable=True)

    # Item Details (Step 2)
    category = Column(String, nullable=True)
    subcategory = Column(String, nullable=True)
    item_name = Column(String, nullable=True)

    # Damage Info (Step 3)
    damage_types = Column(String, nullable=True)
    severity = Column(String, nullable=True)
    damage_description = Column(Text, nullable=False)
    damage_location = Column(Text, nullable=True)
    discovery_time = Column(String, nullable=True)
    damage_context = Column(Text, nullable=True)

    # Status
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    evidence_items = relationship("EvidenceItem", back_populates="case", cascade="all, delete-orphan")
    verdict = relationship("Verdict", back_populates="case", uselist=False)


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    angle = Column(String, nullable=True)
    upload_order = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="evidence_items")


class Verdict(Base):
    __tablename__ = "verdicts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False, unique=True)
    verdict = Column(String, nullable=False)
    confidence_score = Column(Integer, nullable=False)
    reasoning = Column(Text, nullable=True)
    pattern_match_score = Column(Integer, nullable=False, default=0)
    photo_quality_score = Column(Integer, nullable=False, default=0)
    evidence_consistency_score = Column(Integer, nullable=False, default=0)
    historical_correlation_score = Column(Integer, nullable=False, default=0)
    report_sections = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="verdict")


# ─────────────────────────────────────────────
# SAFE IDEMPOTENT SCHEMA MIGRATION
# ─────────────────────────────────────────────

REQUIRED_CASES_COLUMNS = {
    "ship_date":          "TEXT",
    "delivery_date":      "TEXT",
    "notification_date":  "TEXT",
    "bol_status":         "TEXT",
    "bol_damage_desc":    "TEXT",
    "carrier":            "TEXT",
    "warehouse":          "TEXT",
    "category":           "TEXT",
    "subcategory":        "TEXT",
    "item_name":          "TEXT",
    "damage_types":       "TEXT",
    "severity":           "TEXT",
    "damage_location":    "TEXT",
    "discovery_time":     "TEXT",
    "damage_context":     "TEXT",
    "status":             "TEXT NOT NULL DEFAULT 'pending'",
}

REQUIRED_EVIDENCE_COLUMNS = {
    "angle":        "TEXT",
    "upload_order": "INTEGER NOT NULL DEFAULT 0",
    "uploaded_at":  "TEXT",
}

REQUIRED_VERDICT_COLUMNS = {
    "pattern_match_score":          "INTEGER NOT NULL DEFAULT 0",
    "photo_quality_score":          "INTEGER NOT NULL DEFAULT 0",
    "evidence_consistency_score":   "INTEGER NOT NULL DEFAULT 0",
    "historical_correlation_score": "INTEGER NOT NULL DEFAULT 0",
    "report_sections":              "TEXT",
}


def _migrate_table(conn, table_name: str, required_columns: dict):
    rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    existing = {row[1] for row in rows}
    for col_name, col_def in required_columns.items():
        if col_name not in existing:
            try:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                conn.commit()
                logger.info(f"Added column {table_name}.{col_name}")
            except Exception as e:
                logger.warning(f"Could not add {table_name}.{col_name}: {e}")


def ensure_schema():
    """Create all tables then add any missing columns. Fully idempotent."""
    Base.metadata.create_all(bind=engine)
    logger.info("Base tables ensured.")
    with engine.connect() as conn:
        _migrate_table(conn, "cases",          REQUIRED_CASES_COLUMNS)
        _migrate_table(conn, "evidence_items", REQUIRED_EVIDENCE_COLUMNS)
        _migrate_table(conn, "verdicts",       REQUIRED_VERDICT_COLUMNS)
    logger.info("Schema migration complete.")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()