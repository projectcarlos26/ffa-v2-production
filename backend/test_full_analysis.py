import requests
import json

# Base URL
BASE_URL = "http://localhost:8000"

# Upload photos
print("=== Uploading photos ===")
photo_urls = []
angles = ["overall", "close_up", "label", "packaging"]

for angle in angles:
    with open(f"/tmp/test_photos/{angle}.jpg", "rb") as f:
        files = {"file": (f"{angle}.jpg", f, "image/jpeg")}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
        result = response.json()
        if "url" in result:
            photo_urls.append(result["url"])
            print(f"Uploaded {angle}: {result['url']}")
        else:
            print(f"Error uploading {angle}: {result}")

print(f"\nAll photos uploaded: {len(photo_urls)} photos")

# Submit case with transit damage
print("\n=== Submitting case (transit damage) ===")
case_data = {
    "category": "case_goods",
    "subcategory": "table",
    "material": "oak",
    "claim_reference": "CLAIM-TEST-003",
    "damage_description": "The oak dining table has a broken leg on the front right side. The leg has snapped approximately 6 inches from the bottom during shipping transit. There are visible wood fibers at the break point and impact marks on the packaging suggesting this occurred during delivery.",
    "photos": photo_urls
}

response = requests.post(f"{BASE_URL}/api/submit", json=case_data)
result = response.json()
case_id = result["case_id"]
print(f"Case submitted: {case_id}")
print(f"Status: {result['status']}")

# Trigger analysis
print("\n=== Triggering analysis ===")
response = requests.post(f"{BASE_URL}/api/analyze/{case_id}")
result = response.json()
print(f"Analysis status: {result['status']}")
print(f"Verdict: {result['verdict']}")
print(f"Confidence: {result['confidence_score']}%")

# Get full case with verdict
print("\n=== Full case details ===")
response = requests.get(f"{BASE_URL}/api/cases/{case_id}")
data = response.json()

print(f"Status: {data['case']['status']}")
print(f"Photo count: {len(data['evidence'])}")

if data['verdict']:
    print("\n=== VERDICT ===")
    print(f"Verdict: {data['verdict']['verdict'].upper()}")
    print(f"Confidence: {data['verdict']['confidence_score']}%")
    print(f"\nReasoning:\n{data['verdict']['reasoning']}")
    
    print("\n=== SCORE BREAKDOWN ===")
    scores = data['verdict']['report_sections']['5_confidence_assessment']
    for key, value in scores.items():
        if key != 'title':
            print(f"  {key}: {value}")
    
    print("\n=== REPORT SECTIONS ===")
    for section_key, section_data in data['verdict']['report_sections'].items():
        print(f"\n{section_data.get('title', section_key)}:")
        if isinstance(section_data, dict):
            for key, value in section_data.items():
                if key != 'title':
                    print(f"  {key}: {value}")