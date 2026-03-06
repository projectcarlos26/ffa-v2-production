"""
Furniture Forensic Analyst v2 - Backend API
Full implementation: CORS, DB migration, validation, OpenAI vision,
carrier claim probability, packaging failure detection, claim report endpoint,
enhanced filtering/sorting on GET /api/cases.
"""

import json
import logging
import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import (
    Base, Case, EvidenceItem, SessionLocal, Verdict,
    engine, ensure_schema, get_db,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Furniture Forensic Analyst v2",
    description="AI-powered damage attribution for furniture",
    version="2.1.0",
)

# ─────────────────────────────────────────────────────────────────────────────
# STARTUP: schema migration
# ─────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    ensure_schema()
    logger.info("Schema ensured on startup.")

# ─────────────────────────────────────────────────────────────────────────────
# CORS — must allow Vercel frontend
# ─────────────────────────────────────────────────────────────────────────────

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

# ─────────────────────────────────────────────────────────────────────────────
# FILE UPLOADS
# ─────────────────────────────────────────────────────────────────────────────

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://ffa-v2-backend2.onrender.com")

# ─────────────────────────────────────────────────────────────────────────────
# CATEGORIES
# ─────────────────────────────────────────────────────────────────────────────

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

# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────────────────────────────────────

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
    id:          str
    created_at:  str
    updated_at:  str
    status:      str
    carrier:     Optional[str] = None
    warehouse:   Optional[str] = None
    category:    Optional[str] = None
    subcategory: Optional[str] = None
    item_name:   Optional[str] = None
    severity:    Optional[str] = None
    bol_status:  Optional[str] = None
    delivery_date: Optional[str] = None
    notification_date: Optional[str] = None
    damage_types: Optional[str] = None
    verdict:     Optional[str] = None
    confidence_score:   Optional[int] = None
    verdict_created_at: Optional[str] = None


class CaseListResponse(BaseModel):
    total: int
    page:  int
    page_size: int
    items: List[CaseListItem]


# ─────────────────────────────────────────────────────────────────────────────
# OPENAI ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────

def _build_absolute_url(path: str) -> str:
    """Convert /uploads/x.png → https://ffa-v2-backend2.onrender.com/uploads/x.png"""
    if path.startswith("http"):
        return path
    return f"{BACKEND_BASE_URL.rstrip('/')}/{path.lstrip('/')}"


def _image_to_base64_block(file_path: str) -> Optional[dict]:
    """
    Read an image from local disk and return an OpenAI base64 image content block.
    file_path may be a relative path like /uploads/x.jpg or an absolute path.
    Returns None if the file cannot be read.
    """
    import base64
    import mimetypes

    # Resolve to absolute path on disk
    if file_path.startswith("/uploads/"):
        filename = file_path[len("/uploads/"):]
        abs_path = os.path.join(UPLOAD_DIR, filename)
    elif file_path.startswith("http"):
        # Extract filename from URL
        filename = file_path.split("/")[-1].split("?")[0]
        abs_path = os.path.join(UPLOAD_DIR, filename)
    else:
        abs_path = file_path if os.path.isabs(file_path) else os.path.join(UPLOAD_DIR, os.path.basename(file_path))

    if not os.path.exists(abs_path):
        logger.warning(f"Image file not found on disk: {abs_path}")
        return None

    try:
        mime_type, _ = mimetypes.guess_type(abs_path)
        if not mime_type or not mime_type.startswith("image/"):
            mime_type = "image/jpeg"

        with open(abs_path, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode("utf-8")

        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{data}",
                "detail": "high",
            },
        }
    except Exception as e:
        logger.warning(f"Could not read image {abs_path}: {e}")
        return None


def _make_fallback(severity: Optional[str], reason: str, next_steps: list = None) -> dict:
    return {
        "verdict": "inconclusive",
        "confidence_score": 0,
        "scores": {
            "pattern_match": 0,
            "photo_quality": 0,
            "evidence_consistency": 0,
            "historical_correlation": 0,
        },
        "photo_observations": [],
        "reasoning": reason,
        "missing_information": [],
        "carrier_claim_probability": {
            "score": 0,
            "rating": "Low",
            "factors": [],
            "recommendation": "Manual review required",
        },
        "packaging_assessment": {
            "failure_detected": False,
            "indicators": [],
            "packaging_adequacy": "Unknown",
            "notes": "Analysis unavailable",
        },
        "report_sections": {
            "primary_damage": "Unknown",
            "damage_type": "Unknown",
            "severity": severity or "Not specified",
            "confidence_level": "Low",
            "completeness": 0,
            "next_steps": next_steps or ["Manual review required"],
        },
    }


def run_openai_analysis(case: Case, evidence_items: list) -> dict:
    """
    Call OpenAI vision API with all case data and photos encoded as base64.
    Images are read from local disk — no public URL downloads required.
    Falls back to inconclusive on any error without crashing.
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    model   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        logger.warning("OPENAI_API_KEY not set — returning inconclusive fallback.")
        return _make_fallback(
            case.severity,
            "AI analysis unavailable: API key not configured on the server.",
            ["Contact system administrator to configure the OpenAI API key"],
        )

    # ── Load images from disk as base64 ──────────────────────────────────────
    image_blocks = []
    skipped = 0
    for item in evidence_items:
        block = _image_to_base64_block(item.file_path)
        if block:
            image_blocks.append(block)
        else:
            skipped += 1
            logger.warning(f"Skipped image (not readable): {item.file_path}")

    loaded_count = len(image_blocks)
    logger.info(f"Images loaded for analysis: {loaded_count} loaded, {skipped} skipped")

    # ── Compute data completeness score ──────────────────────────────────────
    completeness_fields = {
        "delivery_date": case.delivery_date,
        "notification_date": case.notification_date,
        "bol_status": case.bol_status,
        "carrier": case.carrier,
        "warehouse": case.warehouse,
        "category": case.category,
        "subcategory": case.subcategory,
        "item_name": case.item_name,
        "damage_types": case.damage_types,
        "severity": case.severity,
        "damage_description": case.damage_description,
        "damage_location": case.damage_location,
        "discovery_time": case.discovery_time,
        "photos": "yes" if loaded_count > 0 else None,
    }
    filled = sum(1 for v in completeness_fields.values() if v and str(v).strip())
    completeness_pct = round((filled / len(completeness_fields)) * 100)

    # ── Build case summary text ───────────────────────────────────────────────
    case_summary = f"""CASE DETAILS:
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

PHOTOS: {loaded_count} photo(s) attached ({skipped} could not be loaded).
DATA COMPLETENESS: {completeness_pct}% ({filled}/{len(completeness_fields)} fields provided)."""

    system_prompt = """You are a senior logistics damage investigator and freight claims specialist with 20+ years of experience in furniture damage attribution. Your role is to:
1. Determine whether damage is from manufacturing/quality defect, transit/handling, or inconclusive
2. Assess the probability of a successful carrier claim
3. Detect packaging failures that may affect claim outcomes
4. Provide actionable, evidence-based recommendations

When analyzing photos, cite specific visible indicators such as:
- Carton crushing, corner compression, punctures, moisture staining
- Abrasion patterns, impact fractures, stress marks
- Loose joints, misalignment, unfinished edges, assembly defects
- Detached straps, symmetry issues, anchoring failures
- Packaging material condition (foam, cardboard, wrap)

BOL Status interpretation:
- damage_notated: Strong support for transit claim
- signed_clean: Weakens transit claim, may indicate concealed damage
- not_signed: Neutral, investigate further
- no_bol: Significantly weakens carrier claim

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
  "photo_observations": [
    "Photo 1: [specific observation about visible damage indicators]",
    "Photo 2: [specific observation]"
  ],
  "reasoning": "Detailed explanation referencing specific evidence from images and case data. Minimum 2-3 sentences.",
  "missing_information": ["item 1", "item 2"],
  "carrier_claim_probability": {
    "score": 0-100,
    "rating": "Low | Medium | High | Very High",
    "factors": [
      "Positive factor 1",
      "Negative factor 1"
    ],
    "recommendation": "Specific action recommendation for filing or not filing carrier claim"
  },
  "packaging_assessment": {
    "failure_detected": true | false,
    "indicators": ["indicator 1", "indicator 2"],
    "packaging_adequacy": "Adequate | Inadequate | Unknown",
    "notes": "Assessment of packaging condition and its role in damage"
  },
  "report_sections": {
    "primary_damage": "description of main damage",
    "damage_type": "type of damage",
    "severity": "level",
    "confidence_level": "Low | Medium | High",
    "completeness": 0-100,
    "next_steps": ["step 1", "step 2", "step 3"]
  }
}"""

    user_content = [
        {
            "type": "text",
            "text": f"{case_summary}\n\nAnalyze this case and return JSON matching this schema:\n{required_schema}",
        }
    ] + image_blocks

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_content},
            ],
            max_tokens=2000,
            temperature=0.2,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)

        # ── Validate and repair required keys ────────────────────────────────
        result.setdefault("verdict", "inconclusive")
        result.setdefault("confidence_score", 0)
        result.setdefault("scores", {})
        result["scores"].setdefault("pattern_match", 0)
        result["scores"].setdefault("photo_quality", 0)
        result["scores"].setdefault("evidence_consistency", 0)
        result["scores"].setdefault("historical_correlation", 0)
        result.setdefault("photo_observations", [])
        result.setdefault("reasoning", "No reasoning provided.")
        result.setdefault("missing_information", [])

        # Carrier claim probability
        result.setdefault("carrier_claim_probability", {})
        result["carrier_claim_probability"].setdefault("score", 0)
        result["carrier_claim_probability"].setdefault("rating", "Low")
        result["carrier_claim_probability"].setdefault("factors", [])
        result["carrier_claim_probability"].setdefault("recommendation", "Review case details")

        # Packaging assessment
        result.setdefault("packaging_assessment", {})
        result["packaging_assessment"].setdefault("failure_detected", False)
        result["packaging_assessment"].setdefault("indicators", [])
        result["packaging_assessment"].setdefault("packaging_adequacy", "Unknown")
        result["packaging_assessment"].setdefault("notes", "No packaging assessment available")

        result.setdefault("report_sections", {})
        result["report_sections"].setdefault("primary_damage", "Unknown")
        result["report_sections"].setdefault("damage_type", "Unknown")
        result["report_sections"].setdefault("severity", case.severity or "Not specified")
        result["report_sections"].setdefault("confidence_level", "Low")
        result["report_sections"].setdefault("completeness", completeness_pct)
        result["report_sections"].setdefault("next_steps", [])

        # Clamp numeric scores
        result["confidence_score"] = max(0, min(100, int(result["confidence_score"])))
        for k in result["scores"]:
            result["scores"][k] = max(0, min(25, int(result["scores"][k])))
        result["carrier_claim_probability"]["score"] = max(
            0, min(100, int(result["carrier_claim_probability"]["score"]))
        )
        result["report_sections"]["completeness"] = max(
            0, min(100, int(result["report_sections"].get("completeness", completeness_pct)))
        )

        # Validate verdict
        if result["verdict"] not in ("manufacturing", "transit", "inconclusive"):
            result["verdict"] = "inconclusive"

        logger.info(f"OpenAI analysis complete: verdict={result['verdict']} confidence={result['confidence_score']}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"OpenAI returned invalid JSON: {e} | raw: {raw[:200]}")
        return _make_fallback(case.severity, "AI returned malformed response. Manual review recommended.")

    except Exception as e:
        err_str = str(e)
        logger.error(f"OpenAI analysis failed: {err_str}")

        if "invalid_image_url" in err_str or "Timeout" in err_str or "downloading" in err_str.lower():
            reason = "Image retrieval failed during analysis. The uploaded images could not be processed. Please re-upload photos and try again."
        elif "api_key" in err_str.lower() or "authentication" in err_str.lower() or "401" in err_str:
            reason = "AI analysis failed: API authentication error. Please verify the API key configuration."
        elif "rate_limit" in err_str.lower() or "429" in err_str:
            reason = "AI analysis failed: Rate limit reached. Please wait a moment and try again."
        elif "context_length" in err_str.lower() or "too many" in err_str.lower():
            reason = "AI analysis failed: Too many images submitted. Please reduce the number of photos and try again."
        else:
            reason = f"AI analysis encountered an error: {err_str[:200]}"

        return _make_fallback(case.severity, reason, ["Re-upload photos and retry analysis", "Or proceed with manual review"])


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "FFA v2 API",
        "status": "running",
        "version": "2.1.0",
        "endpoints": {
            "health":       "/health",
            "submit":       "/api/submit",
            "upload":       "/api/upload",
            "list_cases":   "/api/cases",
            "get_case":     "/api/cases/{case_id}",
            "claim_report": "/api/cases/{case_id}/claim-report",
            "analyze":      "/api/analyze/{case_id}",
        },
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# ── POST /api/submit ──────────────────────────────────────────────────────────

@app.post("/api/submit", response_model=CaseResponse, status_code=201)
async def submit_case(submission: CaseSubmission, db: Session = Depends(get_db)):
    """
    Create a new damage case.
    Required: deliveryDate, notificationDate, bolStatus, damageDesc (min 30 chars).
    """
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


# ── POST /api/upload ──────────────────────────────────────────────────────────

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


# ── GET /api/cases ────────────────────────────────────────────────────────────

@app.get("/api/cases", response_model=CaseListResponse)
async def list_cases(
    # Pagination
    page:      int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    # Filters
    status:    Optional[str] = Query(None, description="Filter by status: pending|processing|complete"),
    verdict:   Optional[str] = Query(None, description="Filter by verdict: manufacturing|transit|inconclusive"),
    carrier:   Optional[str] = Query(None, description="Filter by carrier (partial match)"),
    warehouse: Optional[str] = Query(None, description="Filter by warehouse (partial match)"),
    category:  Optional[str] = Query(None, description="Filter by category"),
    subcategory: Optional[str] = Query(None, description="Filter by subcategory"),
    severity:  Optional[str] = Query(None, description="Filter by severity"),
    bol_status: Optional[str] = Query(None, description="Filter by BOL status"),
    item_name: Optional[str] = Query(None, description="Filter by item name (partial match)"),
    date_from: Optional[str] = Query(None, description="Filter cases created on or after (YYYY-MM-DD)"),
    date_to:   Optional[str] = Query(None, description="Filter cases created on or before (YYYY-MM-DD)"),
    min_confidence: Optional[int] = Query(None, ge=0, le=100, description="Minimum confidence score"),
    max_confidence: Optional[int] = Query(None, ge=0, le=100, description="Maximum confidence score"),
    search:    Optional[str] = Query(None, description="Search across item name, carrier, warehouse"),
    # Sorting
    sort_by:   str = Query("created_at", description="Sort field: created_at|severity|confidence_score|verdict|carrier|category"),
    sort_dir:  str = Query("desc", description="Sort direction: asc|desc"),
    db: Session = Depends(get_db),
):
    """
    List cases with comprehensive filtering, sorting, and pagination.
    """
    query = db.query(Case)

    # ── Apply filters ─────────────────────────────────────────────────────────
    if status:
        query = query.filter(Case.status == status)
    if category:
        query = query.filter(Case.category == category)
    if subcategory:
        query = query.filter(Case.subcategory == subcategory)
    if severity:
        query = query.filter(Case.severity == severity)
    if bol_status:
        query = query.filter(Case.bol_status == bol_status)
    if carrier:
        query = query.filter(Case.carrier.ilike(f"%{carrier}%"))
    if warehouse:
        query = query.filter(Case.warehouse.ilike(f"%{warehouse}%"))
    if item_name:
        query = query.filter(Case.item_name.ilike(f"%{item_name}%"))
    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(Case.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d")
            # Include the full day
            from datetime import timedelta
            dt_to = dt_to + timedelta(days=1)
            query = query.filter(Case.created_at < dt_to)
        except ValueError:
            pass
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Case.item_name.ilike(search_term),
                Case.carrier.ilike(search_term),
                Case.warehouse.ilike(search_term),
            )
        )

    # Get total before joining verdicts for verdict filters
    # For verdict/confidence filters, we need to join
    needs_verdict_join = verdict is not None or min_confidence is not None or max_confidence is not None or sort_by in ("confidence_score", "verdict")

    if needs_verdict_join:
        query = query.outerjoin(Verdict, Case.id == Verdict.case_id)
        if verdict:
            query = query.filter(Verdict.verdict == verdict)
        if min_confidence is not None:
            query = query.filter(Verdict.confidence_score >= min_confidence)
        if max_confidence is not None:
            query = query.filter(Verdict.confidence_score <= max_confidence)

    total = query.count()

    # ── Apply sorting ─────────────────────────────────────────────────────────
    sort_map = {
        "created_at":      Case.created_at,
        "updated_at":      Case.updated_at,
        "severity":        Case.severity,
        "carrier":         Case.carrier,
        "category":        Case.category,
        "status":          Case.status,
    }

    if sort_by == "confidence_score" and needs_verdict_join:
        sort_col = Verdict.confidence_score
    elif sort_by == "verdict" and needs_verdict_join:
        sort_col = Verdict.verdict
    else:
        sort_col = sort_map.get(sort_by, Case.created_at)

    if sort_dir.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # ── Pagination ────────────────────────────────────────────────────────────
    offset = (page - 1) * page_size
    cases = query.offset(offset).limit(page_size).all()

    # ── Fetch verdicts for these cases ────────────────────────────────────────
    case_ids = [c.id for c in cases]
    if not needs_verdict_join:
        verdict_map = {
            v.case_id: v
            for v in db.query(Verdict).filter(Verdict.case_id.in_(case_ids)).all()
        }
    else:
        # Already joined, but we need the verdict objects separately for the response
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
            bol_status=c.bol_status,
            delivery_date=c.delivery_date,
            notification_date=c.notification_date,
            damage_types=c.damage_types,
            verdict=v.verdict if v else None,
            confidence_score=v.confidence_score if v else None,
            verdict_created_at=v.created_at.isoformat() if v and v.created_at else None,
        ))

    return CaseListResponse(total=total, page=page, page_size=page_size, items=items)


# ── GET /api/cases/{case_id} ──────────────────────────────────────────────────

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

    verdict_data = None
    if verdict:
        report_sections = json.loads(verdict.report_sections) if verdict.report_sections else {}
        verdict_data = {
            "verdict":          verdict.verdict,
            "confidence_score": verdict.confidence_score,
            "reasoning":        verdict.reasoning,
            "pattern_match_score":          verdict.pattern_match_score,
            "photo_quality_score":          verdict.photo_quality_score,
            "evidence_consistency_score":   verdict.evidence_consistency_score,
            "historical_correlation_score": verdict.historical_correlation_score,
            "report_sections":  report_sections,
            "created_at":       verdict.created_at.isoformat(),
        }

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
        "verdict": verdict_data,
    }


# ── GET /api/cases/{case_id}/status ──────────────────────────────────────────

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


# ── GET /api/cases/{case_id}/claim-report ────────────────────────────────────

@app.get("/api/cases/{case_id}/claim-report")
async def get_claim_report(case_id: str, db: Session = Depends(get_db)):
    """
    Generate a structured claim report for a completed case.
    Returns all data needed to file a carrier claim or document a manufacturing defect.
    """
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

    report_sections = {}
    if verdict and verdict.report_sections:
        try:
            report_sections = json.loads(verdict.report_sections)
        except Exception:
            report_sections = {}

    # Build photo proof block
    photo_proof = []
    for item in evidence_items:
        photo_proof.append({
            "filename":     item.filename,
            "url":          item.file_path,
            "absolute_url": _build_absolute_url(item.file_path),
            "upload_order": item.upload_order,
        })

    # Determine claim eligibility
    claim_eligible = False
    claim_type = None
    if verdict:
        if verdict.verdict == "transit":
            claim_eligible = True
            claim_type = "Carrier Freight Claim"
        elif verdict.verdict == "manufacturing":
            claim_eligible = True
            claim_type = "Manufacturer Warranty / Vendor Claim"

    # Build the full report
    report = {
        "report_id":    f"RPT-{case_id[:8].upper()}",
        "case_id":      case_id,
        "generated_at": datetime.utcnow().isoformat(),
        "case_summary": {
            "item_name":          case.item_name or "Not specified",
            "category":           case.category or "Not specified",
            "subcategory":        case.subcategory or "Not specified",
            "carrier":            case.carrier or "Not specified",
            "warehouse":          case.warehouse or "Not specified",
            "delivery_date":      case.delivery_date or "Not specified",
            "notification_date":  case.notification_date or "Not specified",
            "ship_date":          case.ship_date or "Not specified",
            "bol_status":         case.bol_status or "Not specified",
            "bol_damage_desc":    case.bol_damage_desc or "None",
            "damage_types":       case.damage_types.split(",") if case.damage_types else [],
            "severity":           case.severity or "Not specified",
            "damage_description": case.damage_description,
            "damage_location":    case.damage_location or "Not specified",
            "discovery_time":     case.discovery_time or "Not specified",
            "damage_context":     case.damage_context or "None",
        },
        "analysis_result": {
            "verdict":          verdict.verdict if verdict else "pending",
            "confidence_score": verdict.confidence_score if verdict else 0,
            "confidence_level": report_sections.get("confidence_level", "Low"),
            "reasoning":        verdict.reasoning if verdict else "Analysis not yet completed",
            "scores": {
                "pattern_match":          verdict.pattern_match_score if verdict else 0,
                "photo_quality":          verdict.photo_quality_score if verdict else 0,
                "evidence_consistency":   verdict.evidence_consistency_score if verdict else 0,
                "historical_correlation": verdict.historical_correlation_score if verdict else 0,
            },
            "primary_damage":   report_sections.get("primary_damage", "Unknown"),
            "damage_type":      report_sections.get("damage_type", "Unknown"),
            "completeness":     report_sections.get("completeness", 0),
            "carrier_claim_probability": report_sections.get("carrier_claim_probability", {}),
            "packaging_assessment":      report_sections.get("packaging_assessment", {}),
            "photo_observations":        report_sections.get("photo_observations", []),
            "missing_information":       report_sections.get("missing_information", []),
            "next_steps":                report_sections.get("next_steps", []),
        },
        "claim_eligibility": {
            "eligible":   claim_eligible,
            "claim_type": claim_type,
            "status":     case.status,
        },
        "photo_proof": photo_proof,
        "photo_count": len(photo_proof),
    }

    return report


# ── POST /api/analyze/{case_id} ───────────────────────────────────────────────

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
        result = _make_fallback(case.severity, f"Analysis failed: {str(e)}")

    # Upsert verdict
    verdict = db.query(Verdict).filter(Verdict.case_id == case_id).first()
    if not verdict:
        verdict = Verdict(case_id=case_id, created_at=datetime.utcnow())
        db.add(verdict)

    verdict.verdict                      = result["verdict"]
    verdict.confidence_score             = result["confidence_score"]
    verdict.reasoning                    = result["reasoning"]
    verdict.pattern_match_score          = result["scores"]["pattern_match"]
    verdict.photo_quality_score          = result["scores"]["photo_quality"]
    verdict.evidence_consistency_score   = result["scores"]["evidence_consistency"]
    verdict.historical_correlation_score = result["scores"]["historical_correlation"]

    # Store full report_sections including carrier_claim_probability, packaging_assessment, etc.
    full_report_sections = result.get("report_sections", {})
    full_report_sections["carrier_claim_probability"] = result.get("carrier_claim_probability", {})
    full_report_sections["packaging_assessment"]      = result.get("packaging_assessment", {})
    full_report_sections["photo_observations"]        = result.get("photo_observations", [])
    full_report_sections["missing_information"]       = result.get("missing_information", [])

    verdict.report_sections = json.dumps(full_report_sections)

    case.status     = "complete"
    case.updated_at = datetime.utcnow()
    db.commit()

    return {
        "case_id":          case_id,
        "status":           "complete",
        "verdict":          verdict.verdict,
        "confidence_score": verdict.confidence_score,
        "reasoning":        verdict.reasoning,
        "scores": {
            "pattern_match":          verdict.pattern_match_score,
            "photo_quality":          verdict.photo_quality_score,
            "evidence_consistency":   verdict.evidence_consistency_score,
            "historical_correlation": verdict.historical_correlation_score,
        },
        "photo_observations":        result.get("photo_observations", []),
        "missing_information":        result.get("missing_information", []),
        "carrier_claim_probability":  result.get("carrier_claim_probability", {}),
        "packaging_assessment":       result.get("packaging_assessment", {}),
        "report_sections":            result.get("report_sections", {}),
        "message":                    "Analysis complete",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)