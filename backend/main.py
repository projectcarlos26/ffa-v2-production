"""
Furniture Forensic Analyst v2 - Backend API
All fixes applied: CORS, DB migration, required field validation,
OpenAI vision analysis, endpoint cleanup.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import (
    Base, Case, EvidenceItem, SessionLocal, Verdict,
    engine, ensure_schema, get_db,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────

app = FastAPI(
    title="Furniture Forensic Analyst v2",
    description="AI-powered damage attribution for furniture",
    version="2.0.0-MVP",
)

# ─────────────────────────────────────────────
# STARTUP: schema migration
# ─────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    ensure_schema()
    logger.info("Schema ensured on startup.")

# ─────────────────────────────────────────────
# CORS — must allow Vercel frontend
# ─────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ffa-v2-production.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# FILE UPLOADS
# ─────────────────────────────────────────────

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://ffa-v2-backend2.onrender.com")

# ─────────────────────────────────────────────
# CATEGORIES
# ─────────────────────────────────────────────

SUBCATEGORIES = {
    "dining":   ["Dining Chairs", "Dining Tables", "Bar/Counter Stools", "Dining Sets",
                 "Buffet Tables/Sideboards", "Side/End Tables", "Coffee Tables", "Other"],
    "living":   ["Sectionals", "Side/End Tables", "Accent Chairs", "Sofas", "Ottomans",
                 "TV Stands/Media Consoles", "Coffee Tables", "Other"],
    "bedroom":  ["Nightstands", "Beds", "Dressers/Chests", "Headboards", "Mirrors/Wall Art", "Other"],
    "office":   ["Bookcases/Shelving", "Desks", "TV Stands/Media Consoles", "Office Chairs",
                 "Side/End Tables", "Other"],
    "accent":   ["Floor Decor", "Console Tables", "Rugs", "Benches", "Pet Furniture", "Pillows", "Other"],
    "outdoor":  ["Outdoor Seating", "Outdoor Tables", "Outdoor Dining", "Accessories", "Other"],
}

# ─────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────

class CaseSubmission(BaseModel):
    # Step 1 — required fields
    deliveryDate:     str  = Field(..., description="Delivery date (required)")
    notificationDate: str  = Field(..., description="Notification date (required)")
    bolStatus:        str  = Field(..., description="BOL status (required)")

    # Step 1 — optional fields
    shipDate:      Optional[str] = None
    bolDamageDesc: Optional[str] = None
    carrier:       Optional[str] = None
    warehouse:     Optional[str] = None

    # Step 2
    category:    Optional[str] = None
    subcategory: Optional[str] = None
    itemName:    Optional[str] = None

    # Step 3
    damageTypes:   List[str]    = Field(default_factory=list)
    severity:      Optional[str] = None
    damageDesc:    str           = Field(..., min_length=30)
    damageLocation: Optional[str] = None
    discoveryTime:  Optional[str] = None
    damageContext:  Optional[str] = None

    # Photos
    photos: List[str] = Field(default_factory=list)

    @field_validator("deliveryDate", "notificationDate", "bolStatus")
    @classmethod
    def not_empty(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise ValueError(f"{info.field_name} is required and cannot be empty")
        return v.strip()

    @field_validator("bolStatus")
    @classmethod
    def validate_bol_status(cls, v: str) -> str:
        valid = ["signed_clean", "not_signed", "damage_notated", "no_bol"]
        if v not in valid:
            raise ValueError(f"bolStatus must be one of: {', '.join(valid)}")
        return v


class CaseResponse(BaseModel):
    case_id:    str
    status:     str
    message:    str
    created_at: str


class CaseListItem(BaseModel):
    id:         str
    created_at: str
    updated_at: str
    status:     str
    carrier:    Optional[str] = None
    warehouse:  Optional[str] = None
    category:   Optional[str] = None
    subcategory: Optional[str] = None
    item_name:  Optional[str] = None
    severity:   Optional[str] = None
    verdict:    Optional[str] = None
    confidence_score:    Optional[int] = None
    verdict_created_at:  Optional[str] = None


class CaseListResponse(BaseModel):
    total: int
    items: List[CaseListItem]


# ─────────────────────────────────────────────
# OPENAI ANALYSIS
# ─────────────────────────────────────────────

def _build_absolute_url(path: str) -> str:
    """Convert /uploads/x.png → https://ffa-v2-backend2.onrender.com/uploads/x.png"""
    if path.startswith("http"):
        return path
    return f"{BACKEND_BASE_URL.rstrip('/')}/{path.lstrip('/')}"


def run_openai_analysis(case: Case, evidence_items: list) -> dict:
    """
    Call OpenAI vision API with all case data and photos.
    Returns a dict matching the required JSON schema.
    Falls back to inconclusive on any error.
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    model   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    fallback = {
        "verdict": "inconclusive",
        "confidence_score": 0,
        "scores": {
            "pattern_match": 0,
            "photo_quality": 0,
            "evidence_consistency": 0,
            "historical_correlation": 0,
        },
        "photo_observations": [],
        "reasoning": "AI analysis unavailable: OPENAI_API_KEY not configured.",
        "missing_information": ["OpenAI API key required for AI analysis"],
        "report_sections": {
            "primary_damage": "Unknown",
            "damage_type": "Unknown",
            "severity": case.severity or "Not specified",
            "confidence_level": "Low",
            "next_steps": ["Configure OPENAI_API_KEY environment variable to enable AI analysis"],
        },
    }

    if not api_key:
        logger.warning("OPENAI_API_KEY not set — returning inconclusive fallback.")
        return fallback

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        # Build image content blocks
        image_blocks = []
        for item in evidence_items:
            url = _build_absolute_url(item.file_path)
            image_blocks.append({
                "type": "image_url",
                "image_url": {"url": url, "detail": "high"},
            })

        # Build text summary of case data
        case_summary = f"""
CASE DETAILS:
- Delivery Date: {case.delivery_date or 'Not provided'}
- Notification Date: {case.notification_date or 'Not provided'}
- Ship Date: {case.ship_date or 'Not provided'}
- BOL Status: {case.bol_status or 'Not provided'}
- BOL Damage Description: {case.bol_damage_desc or 'None'}
- Carrier: {case.carrier or 'Not provided'}
- Warehouse: {case.warehouse or 'Not provided'}

ITEM DETAILS:
- Category: {case.category or 'Not provided'}
- Subcategory: {case.subcategory or 'Not provided'}
- Item Name: {case.item_name or 'Not provided'}

DAMAGE DETAILS:
- Damage Types: {case.damage_types or 'Not specified'}
- Severity: {case.severity or 'Not specified'}
- Description: {case.damage_description}
- Location: {case.damage_location or 'Not specified'}
- Discovery Time: {case.discovery_time or 'Not specified'}
- Additional Context: {case.damage_context or 'None'}

PHOTOS: {len(evidence_items)} photo(s) attached.
""".strip()

        system_prompt = """You are a senior logistics damage investigator specializing in furniture damage claims. Determine whether damage is from manufacturing/quality defect, transit/handling, or inconclusive.

Be precise and evidence-based. Avoid generic statements. When photos are available, cite visible indicators such as:
- Carton crushing, corner compression, punctures
- Abrasion patterns, impact fractures
- Loose joints, misalignment, unfinished edges
- Detached straps, symmetry issues, anchoring failures

If evidence is weak or photos are missing/unclear, reduce confidence and list missing information.

Return ONLY valid JSON matching the required schema. No markdown formatting, no code blocks."""

        required_schema = """{
  "verdict": "manufacturing | transit | inconclusive",
  "confidence_score": 0-100,
  "scores": {
    "pattern_match": 0-25,
    "photo_quality": 0-25,
    "evidence_consistency": 0-25,
    "historical_correlation": 0-25
  },
  "photo_observations": ["observation 1", "observation 2"],
  "reasoning": "Detailed explanation referencing specific evidence",
  "missing_information": ["item 1"],
  "report_sections": {
    "primary_damage": "description",
    "damage_type": "type",
    "severity": "level",
    "confidence_level": "Low | Medium | High",
    "next_steps": ["step 1", "step 2"]
  }
}"""

        user_content = [
            {
                "type": "text",
                "text": f"{case_summary}\n\nAnalyze this case and return JSON matching this schema:\n{required_schema}",
            }
        ] + image_blocks

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_content},
            ],
            max_tokens=1500,
            temperature=0.2,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)

        # Validate and repair required keys
        result.setdefault("verdict", "inconclusive")
        result.setdefault("confidence_score", 0)
        result.setdefault("scores", {
            "pattern_match": 0, "photo_quality": 0,
            "evidence_consistency": 0, "historical_correlation": 0,
        })
        result["scores"].setdefault("pattern_match", 0)
        result["scores"].setdefault("photo_quality", 0)
        result["scores"].setdefault("evidence_consistency", 0)
        result["scores"].setdefault("historical_correlation", 0)
        result.setdefault("photo_observations", [])
        result.setdefault("reasoning", "No reasoning provided.")
        result.setdefault("missing_information", [])
        result.setdefault("report_sections", {
            "primary_damage": "Unknown",
            "damage_type": "Unknown",
            "severity": case.severity or "Not specified",
            "confidence_level": "Low",
            "next_steps": [],
        })

        # Clamp scores
        result["confidence_score"] = max(0, min(100, int(result["confidence_score"])))
        for k in result["scores"]:
            result["scores"][k] = max(0, min(25, int(result["scores"][k])))

        # Validate verdict value
        if result["verdict"] not in ("manufacturing", "transit", "inconclusive"):
            result["verdict"] = "inconclusive"

        logger.info(f"OpenAI analysis complete: verdict={result['verdict']} confidence={result['confidence_score']}")
        return result

    except Exception as e:
        logger.error(f"OpenAI analysis failed: {e}")
        fallback["reasoning"] = f"AI analysis unavailable: {str(e)}"
        return fallback


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "FFA v2 API - MVP",
        "status": "running",
        "version": "2.0.0-MVP",
        "endpoints": {
            "health":     "/health",
            "submit":     "/api/submit",
            "upload":     "/api/upload",
            "list_cases": "/api/cases",
            "get_case":   "/api/cases/{case_id}",
            "analyze":    "/api/analyze/{case_id}",
        },
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# ── POST /api/submit ──────────────────────────

@app.post("/api/submit", response_model=CaseResponse, status_code=201)
async def submit_case(submission: CaseSubmission, db: Session = Depends(get_db)):
    """
    Create a new damage case.
    Required: deliveryDate, notificationDate, bolStatus, damageDesc (min 30 chars).
    """
    # Extra explicit validation (belt-and-suspenders on top of Pydantic)
    missing = []
    if not submission.deliveryDate:
        missing.append("deliveryDate")
    if not submission.notificationDate:
        missing.append("notificationDate")
    if not submission.bolStatus:
        missing.append("bolStatus")
    if missing:
        raise HTTPException(
            status_code=400,
            detail={"error": f"Missing required fields: {', '.join(missing)}"},
        )

    try:
        case_id = str(uuid.uuid4())

        case = Case(
            id=case_id,
            ship_date=submission.shipDate,
            delivery_date=submission.deliveryDate,
            notification_date=submission.notificationDate,
            bol_status=submission.bolStatus,
            bol_damage_desc=submission.bolDamageDesc,
            carrier=submission.carrier,
            warehouse=submission.warehouse,
            category=submission.category,
            subcategory=submission.subcategory,
            item_name=submission.itemName,
            damage_types=",".join(submission.damageTypes) if submission.damageTypes else None,
            severity=submission.severity,
            damage_description=submission.damageDesc,
            damage_location=submission.damageLocation,
            discovery_time=submission.discoveryTime,
            damage_context=submission.damageContext,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(case)
        db.commit()
        db.refresh(case)

        for idx, photo_url in enumerate(submission.photos or []):
            evidence = EvidenceItem(
                case_id=case_id,
                filename=photo_url.split("/")[-1] if photo_url else f"photo_{idx}",
                file_path=photo_url,
                upload_order=idx,
                uploaded_at=datetime.utcnow(),
            )
            db.add(evidence)

        db.commit()

        return CaseResponse(
            case_id=case_id,
            status="pending",
            message="Case submitted successfully. Call /api/analyze/{case_id} to run analysis.",
            created_at=case.created_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/upload ──────────────────────────

@app.post("/api/upload")
async def upload_photo(file: UploadFile = File(...)):
    """Upload a damage photo. Returns absolute URL."""
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    relative_url = f"/uploads/{filename}"
    absolute_url = _build_absolute_url(relative_url)

    return {
        "success":  True,
        "filename": filename,
        "url":      relative_url,
        "absolute_url": absolute_url,
        "message":  "Photo uploaded successfully",
    }


# ── GET /api/cases ────────────────────────────

@app.get("/api/cases", response_model=CaseListResponse)
async def list_cases(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    total = db.query(func.count(Case.id)).scalar() or 0
    cases = (
        db.query(Case)
        .order_by(Case.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    case_ids = [c.id for c in cases]
    verdict_map = {
        v.case_id: v
        for v in db.query(Verdict).filter(Verdict.case_id.in_(case_ids)).all()
    }

    items = []
    for c in cases:
        v = verdict_map.get(c.id)
        items.append(CaseListItem(
            id=c.id,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
            status=c.status,
            carrier=c.carrier,
            warehouse=c.warehouse,
            category=c.category,
            subcategory=c.subcategory,
            item_name=c.item_name,
            severity=c.severity,
            verdict=v.verdict if v else None,
            confidence_score=v.confidence_score if v else None,
            verdict_created_at=v.created_at.isoformat() if v and v.created_at else None,
        ))

    return CaseListResponse(total=total, items=items)


# ── GET /api/cases/{case_id} ──────────────────

@app.get("/api/cases/{case_id}")
async def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_items = (
        db.query(EvidenceItem)
        .filter(EvidenceItem.case_id == case_id)
        .order_by(EvidenceItem.upload_order)
        .all()
    )
    verdict = db.query(Verdict).filter(Verdict.case_id == case_id).first()

    return {
        "case": {
            "id": case.id,
            "shipDate":          case.ship_date,
            "deliveryDate":      case.delivery_date,
            "notificationDate":  case.notification_date,
            "bolStatus":         case.bol_status,
            "bolDamageDesc":     case.bol_damage_desc,
            "carrier":           case.carrier,
            "warehouse":         case.warehouse,
            "category":          case.category,
            "subcategory":       case.subcategory,
            "itemName":          case.item_name,
            "damageTypes":       case.damage_types.split(",") if case.damage_types else [],
            "severity":          case.severity,
            "damageDescription": case.damage_description,
            "damageLocation":    case.damage_location,
            "discoveryTime":     case.discovery_time,
            "damageContext":     case.damage_context,
            "status":            case.status,
            "created_at":        case.created_at.isoformat(),
            "updated_at":        case.updated_at.isoformat(),
        },
        "evidence": [
            {
                "filename":     item.filename,
                "url":          item.file_path,
                "absolute_url": _build_absolute_url(item.file_path),
                "angle":        item.angle,
                "upload_order": item.upload_order,
            }
            for item in evidence_items
        ],
        "verdict": {
            "verdict":          verdict.verdict,
            "confidence_score": verdict.confidence_score,
            "reasoning":        verdict.reasoning,
            "report_sections":  json.loads(verdict.report_sections) if verdict.report_sections else {},
            "created_at":       verdict.created_at.isoformat(),
        } if verdict else None,
    }


# ── GET /api/cases/{case_id}/status ──────────

@app.get("/api/cases/{case_id}/status")
async def get_case_status(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    progress_map = {"pending": 10, "processing": 50, "complete": 100}
    return {
        "case_id":    case_id,
        "status":     case.status,
        "progress":   progress_map.get(case.status, 0),
        "updated_at": case.updated_at.isoformat(),
    }


# ── POST /api/analyze/{case_id} ───────────────

@app.post("/api/analyze/{case_id}")
async def analyze_case_endpoint(case_id: str, db: Session = Depends(get_db)):
    """Run OpenAI vision analysis on a submitted case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.status = "processing"
    case.updated_at = datetime.utcnow()
    db.commit()

    evidence_items = (
        db.query(EvidenceItem)
        .filter(EvidenceItem.case_id == case_id)
        .order_by(EvidenceItem.upload_order)
        .all()
    )

    try:
        result = run_openai_analysis(case, evidence_items)
    except Exception as e:
        logger.error(f"Analysis error for {case_id}: {e}")
        result = {
            "verdict": "inconclusive",
            "confidence_score": 0,
            "scores": {"pattern_match": 0, "photo_quality": 0,
                       "evidence_consistency": 0, "historical_correlation": 0},
            "photo_observations": [],
            "reasoning": f"Analysis failed: {str(e)}",
            "missing_information": [],
            "report_sections": {
                "primary_damage": "Unknown", "damage_type": "Unknown",
                "severity": case.severity or "Not specified",
                "confidence_level": "Low", "next_steps": [],
            },
        }

    # Upsert verdict
    verdict = db.query(Verdict).filter(Verdict.case_id == case_id).first()
    if not verdict:
        verdict = Verdict(case_id=case_id, created_at=datetime.utcnow())
        db.add(verdict)

    verdict.verdict                    = result["verdict"]
    verdict.confidence_score           = result["confidence_score"]
    verdict.reasoning                  = result["reasoning"]
    verdict.pattern_match_score        = result["scores"]["pattern_match"]
    verdict.photo_quality_score        = result["scores"]["photo_quality"]
    verdict.evidence_consistency_score = result["scores"]["evidence_consistency"]
    verdict.historical_correlation_score = result["scores"]["historical_correlation"]
    verdict.report_sections            = json.dumps(result.get("report_sections", {}))

    case.status     = "complete"
    case.updated_at = datetime.utcnow()
    db.commit()

    return {
        "case_id":        case_id,
        "status":         "complete",
        "verdict":        verdict.verdict,
        "confidence_score": verdict.confidence_score,
        "reasoning":      verdict.reasoning,
        "photo_observations": result.get("photo_observations", []),
        "missing_information": result.get("missing_information", []),
        "report_sections": result.get("report_sections", {}),
        "message":        "Analysis complete",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)