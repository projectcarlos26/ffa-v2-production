from analysis import analyze_case

# Test Case 1: Transit damage (broken leg)
result1 = analyze_case(
    category='case_goods',
    description='The oak dining table has a broken leg on the front right side. The leg has snapped approximately 6 inches from the bottom. There are visible wood fibers at the break point suggesting this occurred during shipping.',
    photo_count=4,
    photo_angles=['overall', 'close_up', 'label', 'packaging']
)
print('=== Test Case 1: Transit Damage ===')
print(f'Verdict: {result1["verdict"]}')
print(f'Confidence: {result1["confidence_score"]}%')
print(f'Scores: {result1["scores"]}')
print()

# Test Case 2: Manufacturing damage (veneer bubbling)
result2 = analyze_case(
    category='case_goods',
    description='Oak dresser has visible bubbling on the veneer surface. The finish is peeling and there are delamination issues across multiple drawer fronts. This appears to be a manufacturing defect in the veneer application process.',
    photo_count=3,
    photo_angles=['overall', 'close_up', 'label']
)
print('=== Test Case 2: Manufacturing Damage ===')
print(f'Verdict: {result2["verdict"]}')
print(f'Confidence: {result2["confidence_score"]}%')
print(f'Scores: {result2["scores"]}')
print()

# Test Case 3: Text-only (no photos)
result3 = analyze_case(
    category='upholstery',
    description='The sofa has a seam failure on the left cushion. The stitching has come undone and there is a visible gap in the fabric.',
    photo_count=0,
    photo_angles=[]
)
print('=== Test Case 3: Text-Only Submission ===')
print(f'Verdict: {result3["verdict"]}')
print(f'Confidence: {result3["confidence_score"]}%')
print(f'Reasoning: {result3["reasoning"]}')