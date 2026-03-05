"""
Furniture Forensic Analyst v2 - Backend API
FastAPI Application - Updated for new form structure
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import uuid
import os
import shutil
import json

class CaseListItem(BaseModel):
    id: str
    created_at: str
    updated_at: str
    status: str

    # Optional details for quick browsing
    carrier: Optional[str] = None
    warehouse: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    item_name: Optional[str] = None
    severity: Optional[str] = None

    # Verdict summary if analyzed
    verdict: Optional[str] = None
    confidence_score: Optional[int] = None
    verdict_created_at: Optional[str] = None

class CaseListResponse(BaseModel):
    total: int
    items: List[CaseListItem]

# Import database and analysis
from database import get_db, Case, EvidenceItem, Verdict, SessionLocal, Base, engine

from analysis import analyze_case
from sqlalchemy.orm import Session

# Initialize FastAPI app
app = FastAPI(
    title="Furniture Forensic Analyst v2",
    description="AI-powered damage attribution for furniture",
    version="2.0.0-MVP",
)

from pathlib import Path

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    # The most reliable way to reset the schema:
    # Use SQLAlchemy to drop all tables via the active connection engine.
    # This ignores file paths and targets the database directly.
    Base.metadata.drop_all(bind=engine)
    
    # Recreate tables with the new columns (ship_date, delivery_date, etc.)
    Base.metadata.create_all(bind=engine)
    
    print("Database schema successfully reset and recreated.")


origins = [
    "https://ffa-v2-production.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)



# File upload configuration
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Updated categories
CATEGORIES = ["dining", "living", "bedroom", "office", "accent", "outdoor"]

# Updated subcategories per category
SUBCATEGORIES = {
    "dining": ["Dining Chairs", "Dining Tables", "Bar/Counter Stools", "Dining Sets", "Buffet Tables/Sideboards", "Side/End Tables", "Coffee Tables", "Other"],
    "living": ["Sectionals", "Side/End Tables", "Accent Chairs", "Sofas", "Ottomans", "TV Stands/Media Consoles", "Coffee Tables", "Other"],
    "bedroom": ["Nightstands", "Beds", "Dressers/Chests", "Headboards", "Mirrors/Wall Art", "Other"],
    "office": ["Bookcases/Shelving", "Desks", "TV Stands/Media Consoles", "Office Chairs", "Side/End Tables", "Other"],
    "accent": ["Floor Decor", "Console Tables", "Rugs", "Benches", "Pet Furniture", "Pillows", "Other"],
    "outdoor": ["Outdoor Seating", "Outdoor Tables", "Outdoor Dining", "Accessories", "Other"]
}

# Data Models - Updated for new form structure
class CaseSubmission(BaseModel):
    # Step 1: Case Details
    shipDate: Optional[str] = Field(None, description="Ship date")
    deliveryDate: Optional[str] = Field(None, description="Delivery date")
    notificationDate: Optional[str] = Field(None, description="Notification date")
    bolStatus: Optional[str] = Field(None, description="BOL status")
    bolDamageDesc: Optional[str] = Field(None, description="BOL damage description if notated")
    carrier: Optional[str] = Field(None, description="Carrier name")
    warehouse: Optional[str] = Field(None, description="Warehouse name")
    
    # Step 2: Item Details
    category: Optional[str] = Field(None, description="Furniture category")
    subcategory: Optional[str] = Field(None, description="Specific furniture type")
    itemName: Optional[str] = Field(None, description="Item name")
    
    # Step 3: Damage Info
    damageTypes: List[str] = Field(default_factory=list, description="Selected damage types")
    severity: Optional[str] = Field(None, description="Damage severity")
    damageDesc: str = Field(..., min_length=30, description="Damage description (min 30 chars)")
    damageLocation: Optional[str] = Field(None, description="Damage location")
    discoveryTime: Optional[str] = Field(None, description="When damage was discovered")
    damageContext: Optional[str] = Field(None, description="Additional context")
    
    # Photos
    photos: List[str] = Field(default_factory=list, description="List of uploaded photo URLs")
    
    @field_validator('bolStatus')
    @classmethod
    def validate_bol_status(cls, v):
        valid_statuses = ["signed_clean", "not_signed", "damage_notated", "no_bol"]
        if v and v not in valid_statuses:
            raise ValueError(f"Invalid BOL status. Must be one of: {', '.join(valid_statuses)}")
        return v

class CaseResponse(BaseModel):
    case_id: str
    status: str
    message: str
    created_at: str

class AnalysisReport(BaseModel):
    case_id: str
    verdict: str  # "manufacturing", "transit", "inconclusive"
    confidence_score: int  # 0-100
    reasoning: str
    report_sections: dict
    created_at: str

# Health check endpoint
@app.get("/")
async def root():
    return {
        "message": "FFA v2 API - MVP",
        "status": "running",
        "version": "2.0.0-MVP",
        "endpoints": {
            "health": "/health",
            "submit": "/api/submit",
            "upload": "/api/upload",
            "get_case": "/api/cases/{case_id}",
            "get_status": "/api/cases/{case_id}/status",
            "analyze": "/api/analyze/{case_id}"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Case submission endpoint - Updated
@app.post("/api/submit", response_model=CaseResponse)
async def submit_case(submission: CaseSubmission, db: Session = Depends(get_db)):
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

        # Save evidence rows (photo URLs)
        for idx, photo_url in enumerate(submission.photos or []):
            evidence = EvidenceItem(
                case_id=case_id,
                filename=(photo_url.split("/")[-1] if photo_url else f"photo_{idx}"),
                file_path=photo_url,
                upload_order=idx,
                uploaded_at=datetime.utcnow(),
            )
            db.add(evidence)

        db.commit()

        return CaseResponse(
            case_id=case_id,
            status="pending",
            message="Case submitted successfully. Analysis will begin shortly.",
            created_at=case.created_at.isoformat(),
        )

    except Exception as e:
        # This will show the real reason in the response instead of a blank 500
        print("SUBMIT ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))
    
    # Create case record with all new fields
    case = Case(
        id=case_id,
        # Case details
        ship_date=submission.shipDate,
        delivery_date=submission.deliveryDate,
        notification_date=submission.notificationDate,
        bol_status=submission.bolStatus,
        bol_damage_desc=submission.bolDamageDesc,
        carrier=submission.carrier,
        warehouse=submission.warehouse,
        # Item details
        category=submission.category,
        subcategory=submission.subcategory,
        item_name=submission.itemName,
        # Damage info
        damage_types=",".join(submission.damageTypes) if submission.damageTypes else None,
        severity=submission.severity,
        damage_description=submission.damageDesc,
        damage_location=submission.damageLocation,
        discovery_time=submission.discoveryTime,
        damage_context=submission.damageContext,
        # Status
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(case)
    db.commit()
    db.refresh(case)

from sqlalchemy import func

@app.get("/api/cases")
async def list_cases(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    total = db.query(func.count(Case.id)).scalar() or 0

    cases = (
        db.query(Case)
        .order_by(Case.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []

    for c in cases:
        verdict = db.query(Verdict).filter(Verdict.case_id == c.id).first()

        results.append({
            "id": c.id,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "status": c.status,
            "carrier": c.carrier,
            "warehouse": c.warehouse,
            "category": c.category,
            "subcategory": c.subcategory,
            "item_name": c.item_name,
            "severity": c.severity,
            "verdict": verdict.verdict if verdict else None,
            "confidence_score": verdict.confidence_score if verdict else None
        })

    return {
        "total": total,
        "items": results
    }
    
    # Create evidence items for each photo
    for idx, photo_url in enumerate(submission.photos):
        evidence = EvidenceItem(
            case_id=case_id,
            filename=photo_url.split("/")[-1],
            file_path=photo_url,
            upload_order=idx,
            uploaded_at=datetime.utcnow()
        )
        db.add(evidence)
    
    db.commit()
    
    return CaseResponse(
        case_id=case_id,
        status="pending",
        message="Case submitted successfully. Analysis will begin shortly.",
        created_at=case.created_at.isoformat()
    )

# Photo upload endpoint
@app.post("/api/upload")
async def upload_photo(file: UploadFile = File(...)):
    """
    Upload a damage photo
    
    Validates file type, saves to disk, and returns URL
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Validate file size (10MB max)
    content = await file.read()
    file_size = len(content)
    
    if file_size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10MB."
        )
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {
        "success": True,
        "filename": filename,
        "url": f"/uploads/{filename}",
        "message": "Photo uploaded successfully"
    }

# Case retrieval endpoint - Updated
@app.get("/api/cases/{case_id}")
async def get_case(case_id: str, db: Session = Depends(get_db)):
    """
    Retrieve case details and report
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get evidence items
    evidence_items = db.query(EvidenceItem).filter(
        EvidenceItem.case_id == case_id
    ).order_by(EvidenceItem.upload_order).all()
    
    # Get verdict (if available)
    verdict = db.query(Verdict).filter(Verdict.case_id == case_id).first()
    
    return {
        "case": {
            "id": case.id,
            # Case details
            "shipDate": case.ship_date,
            "deliveryDate": case.delivery_date,
            "notificationDate": case.notification_date,
            "bolStatus": case.bol_status,
            "bolDamageDesc": case.bol_damage_desc,
            "carrier": case.carrier,
            "warehouse": case.warehouse,
            # Item details
            "category": case.category,
            "subcategory": case.subcategory,
            "itemName": case.item_name,
            # Damage info
            "damageTypes": case.damage_types.split(",") if case.damage_types else [],
            "severity": case.severity,
            "damageDescription": case.damage_description,
            "damageLocation": case.damage_location,
            "discoveryTime": case.discovery_time,
            "damageContext": case.damage_context,
            # Status
            "status": case.status,
            "created_at": case.created_at.isoformat(),
            "updated_at": case.updated_at.isoformat()
        },
        "evidence": [
            {
                "filename": item.filename,
                "url": item.file_path,
                "angle": item.angle,
                "upload_order": item.upload_order
            }
            for item in evidence_items
        ],
        "verdict": {
            "verdict": verdict.verdict,
            "confidence_score": verdict.confidence_score,
            "reasoning": verdict.reasoning,
            "report_sections": json.loads(verdict.report_sections) if verdict.report_sections else {},
            "created_at": verdict.created_at.isoformat()
        } if verdict else None
    }

# Status tracking endpoint
@app.get("/api/cases/{case_id}/status")
async def get_case_status(case_id: str, db: Session = Depends(get_db)):
    """
    Get case analysis status
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Calculate progress based on status
    progress_map = {
        "pending": 10,
        "processing": 50,
        "complete": 100
    }
    
    return {
        "case_id": case_id,
        "status": case.status,
        "progress": progress_map.get(case.status, 0),
        "updated_at": case.updated_at.isoformat()
    }

# Analysis endpoint - Updated
@app.post("/api/analyze/{case_id}")
async def analyze_case_endpoint(case_id: str, db: Session = Depends(get_db)):
    """
    Trigger AI analysis for a case
    
    Uses the updated 4-factor confidence scoring algorithm with BOL influence
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Update status to processing
    case.status = "processing"
    case.updated_at = datetime.utcnow()
    db.commit()
    
    # Get evidence items (photos)
    evidence_items = db.query(EvidenceItem).filter(
        EvidenceItem.case_id == case_id
    ).all()
    
    photo_count = len(evidence_items)
    photo_angles = [item.angle for item in evidence_items if item.angle]

from sqlalchemy import func
from sqlalchemy.orm import Session

@app.get("/api/cases", response_model=CaseListResponse)
async def list_cases(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    # total count
    total = db.query(func.count(Case.id)).scalar() or 0

    # pull cases newest first
    cases = (
        db.query(Case)
        .order_by(Case.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # grab verdicts for these cases in one query
    case_ids = [c.id for c in cases]
    verdicts = (
        db.query(Verdict)
        .filter(Verdict.case_id.in_(case_ids))
        .all()
    )
    verdict_map = {v.case_id: v for v in verdicts}

    items = []
    for c in cases:
        v = verdict_map.get(c.id)

        items.append(
            CaseListItem(
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
            )
        )

    return CaseListResponse(total=total, items=items)
    
    # Perform analysis with new parameters
    analysis_result = analyze_case(
        category=case.category,
        description=case.damage_description,
        damage_types=case.damage_types.split(",") if case.damage_types else [],
        severity=case.severity,
        damage_location=case.damage_location,
        discovery_time=case.discovery_time,
        damage_context=case.damage_context,
        bol_status=case.bol_status,
        carrier=case.carrier,
        photo_count=photo_count,
        photo_angles=photo_angles if photo_angles else []
    )
    
    # Create verdict record
    verdict = Verdict(
        case_id=case_id,
        verdict=analysis_result["verdict"],
        confidence_score=analysis_result["confidence_score"],
        reasoning=analysis_result["reasoning"],
        pattern_match_score=analysis_result["scores"]["pattern_match"],
        photo_quality_score=analysis_result["scores"]["photo_quality"],
        evidence_consistency_score=analysis_result["scores"]["evidence_consistency"],
        historical_correlation_score=analysis_result["scores"]["historical_correlation"],
        report_sections=json.dumps(analysis_result.get("report_sections", {})),
        created_at=datetime.utcnow()
    )
    
    db.add(verdict)
    
    # Update case status to complete
    case.status = "complete"
    case.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "case_id": case_id,
        "status": "complete",
        "verdict": analysis_result["verdict"],
        "confidence_score": analysis_result["confidence_score"],
        "message": "Analysis complete"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)