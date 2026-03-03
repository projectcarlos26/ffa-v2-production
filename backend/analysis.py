"""
Furniture Forensic Analyst v2 - AI Analysis Engine
Updated with BOL influence, damage types, severity, and completeness scoring
"""

import json
import re
from typing import List, Optional

# Keyword definitions
MANUFACTURING_KEYWORDS = [
    'bubbling', 'delamination', 'veneer', 'peeling', 'mismatch', 'finish', 
    'defect', 'assembly', 'joinery', 'seam', 'stitch', 'thread', 
    'misaligned', 'dye', 'foam', 'misdrilled', 'weld', 'manufacturing', 
    'factory', 'quality control', 'qc', 'loose', 'uneven', 'warped'
]

TRANSIT_KEYWORDS = [
    'broken', 'cracked', 'snapped', 'shattered', 'crushed', 'puncture', 
    'tear', 'forklift', 'dropped', 'shipping', 'delivery', 'transit', 
    'impact', 'dent', 'bent', 'box', 'package', 'carrier', 'driver', 
    'truck', 'unload', 'moving', 'transport'
]

def analyze_case(
    category: Optional[str] = None,
    description: str = "",
    damage_types: List[str] = None,
    severity: Optional[str] = None,
    damage_location: Optional[str] = None,
    discovery_time: Optional[str] = None,
    damage_context: Optional[str] = None,
    bol_status: Optional[str] = None,
    carrier: Optional[str] = None,
    photo_count: int = 0,
    photo_angles: List[str] = None
) -> dict:
    """
    Analyze a furniture damage case using the 4-factor confidence scoring algorithm.
    
    Returns:
        dict: Analysis results including verdict, confidence score, reasoning, and report sections
    """
    
    # Initialize scores
    pattern_match_score = 0
    photo_quality_score = 0
    evidence_consistency_score = 0
    historical_correlation_score = 0
    
    # Combine all description fields
    full_description = description.lower()
    if damage_location:
        full_description += " " + damage_location.lower()
    if damage_context:
        full_description += " " + damage_context.lower()
    
    # ============================================
    # FACTOR 1: Pattern Match (0-25 points)
    # ============================================
    manufacturing_score = 0
    transit_score = 0
    
    # Keyword analysis
    for keyword in MANUFACTURING_KEYWORDS:
        if keyword in full_description:
            manufacturing_score += 3
    
    for keyword in TRANSIT_KEYWORDS:
        if keyword in full_description:
            transit_score += 3
    
    # BOL Status influence (NEW)
    if bol_status == "signed_clean":
        manufacturing_score += 8  # Strong indicator for manufacturing
    elif bol_status == "damage_notated":
        transit_score += 10  # Strong indicator for transit
    elif bol_status == "not_signed":
        transit_score += 3  # Slight indicator for transit
    
    # Damage types influence (NEW)
    if damage_types:
        if "assembly" in damage_types:
            manufacturing_score += 5
        if "broken" in damage_types:
            transit_score += 4
        if "scratched" in damage_types:
            transit_score += 2
        if "missing" in damage_types:
            transit_score += 3
    
    # Cap scores at 25
    manufacturing_score = min(manufacturing_score, 25)
    transit_score = min(transit_score, 25)
    
    # Determine dominant pattern
    if manufacturing_score > transit_score:
        dominant_pattern = "manufacturing"
        pattern_match_score = manufacturing_score
    elif transit_score > manufacturing_score:
        dominant_pattern = "transit"
        pattern_match_score = transit_score
    else:
        dominant_pattern = "inconclusive"
        pattern_match_score = max(manufacturing_score, transit_score)
    
    # ============================================
    # FACTOR 2: Photo Quality (0-25 points)
    # ============================================
    if photo_count == 0:
        photo_quality_score = 0
    elif photo_count == 1:
        photo_quality_score = 8
    elif photo_count == 2:
        photo_quality_score = 14
    elif photo_count == 3:
        photo_quality_score = 18
    elif photo_count == 4:
        photo_quality_score = 22
    else:
        photo_quality_score = 25
    
    # Bonus for photo angles
    if photo_angles:
        if "front" in photo_angles:
            photo_quality_score += 2
        if "side" in photo_angles:
            photo_quality_score += 2
        if "top" in photo_angles or "bottom" in photo_angles:
            photo_quality_score += 1
    
    photo_quality_score = min(photo_quality_score, 25)
    
    # ============================================
    # FACTOR 3: Evidence Consistency (0-25 points)
    # ============================================
    desc_length = len(description)
    
    # Base score from description length
    if desc_length >= 200:
        evidence_consistency_score = 25
    elif desc_length >= 150:
        evidence_consistency_score = 22
    elif desc_length >= 100:
        evidence_consistency_score = 18
    elif desc_length >= 50:
        evidence_consistency_score = 15
    else:
        evidence_consistency_score = 10
    
    # Bonus for additional fields (NEW)
    if damage_location:
        evidence_consistency_score += 3
    if discovery_time:
        evidence_consistency_score += 2
    if damage_context:
        evidence_consistency_score += 2
    if damage_types and len(damage_types) > 0:
        evidence_consistency_score += 2
    
    evidence_consistency_score = min(evidence_consistency_score, 25)
    
    # ============================================
    # FACTOR 4: Historical Correlation (0-25 points)
    # ============================================
    # Calculate data completeness
    completeness_points = 0
    max_points = 100
    
    # Critical
    if desc_length >= 30:
        completeness_points += 30
    
    # Recommended
    if bol_status:
        completeness_points += 20
    if damage_types and len(damage_types) > 0:
        completeness_points += 10
    if discovery_time:
        completeness_points += 5
    
    # Optional
    if carrier:
        completeness_points += 5
    if category:
        completeness_points += 5
    if damage_location:
        completeness_points += 5
    if damage_context:
        completeness_points += 5
    
    completeness_percentage = min(completeness_points, 100)
    
    # Historical correlation based on completeness
    if completeness_percentage >= 70:
        historical_correlation_score = 25
    elif completeness_percentage >= 50:
        historical_correlation_score = 20
    elif completeness_percentage >= 30:
        historical_correlation_score = 15
    else:
        historical_correlation_score = 10
    
    # ============================================
    # TOTAL SCORE CALCULATION
    # ============================================
    total_score = (
        pattern_match_score +
        photo_quality_score +
        evidence_consistency_score +
        historical_correlation_score
    )
    
    # Cap at 40 for text-only submissions
    if photo_count == 0:
        total_score = min(total_score, 40)
    
    # ============================================
    # VERDICT DETERMINATION
    # ============================================
    if total_score >= 25 and dominant_pattern != "inconclusive":
        verdict = dominant_pattern
    elif total_score >= 20:
        verdict = "inconclusive"
    else:
        verdict = "inconclusive"
    
    # ============================================
    # GENERATE REASONING
    # ============================================
    reasoning = generate_reasoning(
        dominant_pattern=dominant_pattern,
        pattern_match_score=pattern_match_score,
        photo_quality_score=photo_quality_score,
        evidence_consistency_score=evidence_consistency_score,
        historical_correlation_score=historical_correlation_score,
        total_score=total_score,
        bol_status=bol_status,
        damage_types=damage_types,
        severity=severity,
        desc_length=desc_length,
        completeness_percentage=completeness_percentage,
        photo_count=photo_count
    )
    
    # ============================================
    # GENERATE REPORT SECTIONS
    # ============================================
    report_sections = generate_report_sections(
        verdict=verdict,
        total_score=total_score,
        pattern_match_score=pattern_match_score,
        photo_quality_score=photo_quality_score,
        evidence_consistency_score=evidence_consistency_score,
        historical_correlation_score=historical_correlation_score,
        dominant_pattern=dominant_pattern,
        damage_types=damage_types,
        severity=severity,
        bol_status=bol_status,
        completeness_percentage=completeness_percentage
    )
    
    return {
        "verdict": verdict,
        "confidence_score": total_score,
        "reasoning": reasoning,
        "scores": {
            "pattern_match": pattern_match_score,
            "photo_quality": photo_quality_score,
            "evidence_consistency": evidence_consistency_score,
            "historical_correlation": historical_correlation_score
        },
        "report_sections": report_sections
    }


def generate_reasoning(
    dominant_pattern: str,
    pattern_match_score: int,
    photo_quality_score: int,
    evidence_consistency_score: int,
    historical_correlation_score: int,
    total_score: int,
    bol_status: Optional[str],
    damage_types: Optional[List[str]],
    severity: Optional[str],
    desc_length: int,
    completeness_percentage: int,
    photo_count: int
) -> str:
    """Generate human-readable reasoning for the analysis."""
    
    reasoning_parts = []
    
    # Pattern analysis
    reasoning_parts.append(f"Pattern analysis indicates {dominant_pattern} issue (score: {pattern_match_score}/25).")
    
    # BOL influence
    bol_labels = {
        "signed_clean": "Signed Clean",
        "not_signed": "Not Signed",
        "damage_notated": "Damage Notated",
        "no_bol": "No BOL Available"
    }
    
    if bol_status:
        reasoning_parts.append(f"BOL Status: {bol_labels.get(bol_status, 'Not provided')}.")
        
        if bol_status == "signed_clean":
            reasoning_parts.append("Signed Clean BOL supports manufacturing attribution.")
        elif bol_status == "damage_notated":
            reasoning_parts.append("Damage noted on BOL supports transit attribution.")
        elif bol_status == "no_bol":
            reasoning_parts.append("No BOL available limits transit damage analysis.")
    
    # Damage types
    if damage_types and len(damage_types) > 0:
        reasoning_parts.append(f"Damage types identified: {', '.join(damage_types)}.")
    
    # Severity
    if severity:
        reasoning_parts.append(f"Damage severity: {severity}.")
    
    # Photo quality
    if photo_count > 0:
        reasoning_parts.append(f"Photo quality score: {photo_quality_score}/25 ({photo_count} photo(s) provided).")
    else:
        reasoning_parts.append("No photos provided. Photo quality score: 0.")
    
    # Evidence consistency
    reasoning_parts.append(f"Description length: {desc_length} characters.")
    reasoning_parts.append(f"Evidence consistency score: {evidence_consistency_score}/25.")
    
    # Completeness
    reasoning_parts.append(f"Data completeness: {completeness_percentage}%.")
    
    # Confidence cap
    if photo_count == 0:
        reasoning_parts.append("Text-only submission: confidence capped at 40%.")
    
    return " ".join(reasoning_parts)


def generate_report_sections(
    verdict: str,
    total_score: int,
    pattern_match_score: int,
    photo_quality_score: int,
    evidence_consistency_score: int,
    historical_correlation_score: int,
    dominant_pattern: str,
    damage_types: Optional[List[str]],
    severity: Optional[str],
    bol_status: Optional[str],
    completeness_percentage: int
) -> dict:
    """Generate structured report sections."""
    
    # Recommended next steps based on verdict
    if verdict == "manufacturing":
        next_steps = [
            "Document findings in QC system",
            "Notify manufacturing team for root cause analysis",
            "Review similar cases for patterns",
            "Consider production line inspection"
        ]
    elif verdict == "transit":
        next_steps = [
            "Initiate carrier claim process",
            "Review delivery documentation",
            "Analyze packaging effectiveness",
            "Consider carrier performance review"
        ]
    else:
        next_steps = [
            "Request additional photos for clearer analysis",
            "Schedule expert review",
            "Gather more information about damage timeline",
            "Review packaging and handling procedures"
        ]
    
    # Primary damage type
    primary_damage = "Unknown"
    damage_type = "Unknown"
    
    if damage_types:
        if "broken" in damage_types:
            primary_damage = "Broken"
            damage_type = "Structural"
        elif "scratched" in damage_types:
            primary_damage = "Scratched"
            damage_type = "Cosmetic"
        elif "torn" in damage_types:
            primary_damage = "Torn"
            damage_type = "Material"
        elif "missing" in damage_types:
            primary_damage = "Missing Parts"
            damage_type = "Assembly"
        elif "assembly" in damage_types:
            primary_damage = "Assembly Issue"
            damage_type = "Construction"
    
    return {
        "next_steps": next_steps,
        "primary_damage": primary_damage,
        "damage_type": damage_type,
        "severity": severity or "Not specified",
        "completeness": completeness_percentage,
        "confidence_level": "High" if total_score >= 35 else "Medium" if total_score >= 25 else "Low"
    }


# Test function
if __name__ == "__main__":
    # Test with sample data
    result = analyze_case(
        category="dining",
        description="The left leg of the oak dining table is cracked at the mid-joint. The damage was discovered during unpacking 2 days after delivery. The box appeared intact with no visible damage.",
        damage_types=["broken"],
        severity="Major",
        damage_location="Left front leg, near the bottom",
        discovery_time="unpacking",
        damage_context="The box appeared intact with no visible damage.",
        bol_status="signed_clean",
        carrier="FedEx",
        photo_count=2
    )
    
    print("Verdict:", result["verdict"])
    print("Confidence:", result["confidence_score"])
    print("Reasoning:", result["reasoning"])
    print("Scores:", result["scores"])