function Report({ formData, resetForm }) {
  const result = formData.analysisResult;

  if (!result) {
    return (
      <div className="step-content">
        <h2>Analysis Error</h2>
        <p>Unable to complete analysis. Please try again.</p>
        <div className="footer">
          <div></div>
          <button className="btn btn-primary" onClick={resetForm}>
            Start New Case
          </button>
        </div>
      </div>
    );
  }

  const getConfidenceLevel = (score) => {
    if (score >= 70) return 'High Confidence';
    if (score >= 50) return 'Medium Confidence';
    if (score >= 35) return 'Low-Medium Confidence';
    return 'Low Confidence';
  };

  const getClaimRatingColor = (rating) => {
    if (!rating) return '#999';
    const r = rating.toLowerCase();
    if (r === 'very high') return '#28a745';
    if (r === 'high')      return '#28a745';
    if (r === 'medium')    return '#ffc107';
    return '#dc3545';
  };

  const verdict          = result.verdict || 'inconclusive';
  const confidenceScore  = result.confidence_score || 0;
  const reasoning        = result.reasoning || '';
  const reportSections   = result.report_sections || {};

  // Score breakdown — read from flat fields set by Analyzing.jsx
  const patternMatch          = result.pattern_match_score          ?? 0;
  const photoQuality          = result.photo_quality_score          ?? 0;
  const evidenceConsistency   = result.evidence_consistency_score   ?? 0;
  const historicalCorrelation = result.historical_correlation_score ?? 0;

  // New fields
  const photoObservations      = result.photo_observations      || [];
  const missingInformation     = result.missing_information     || [];
  const carrierClaim           = result.carrier_claim_probability || {};
  const packagingAssessment    = result.packaging_assessment    || {};
  const completeness           = reportSections.completeness    ?? null;

  const apiBase = import.meta.env.VITE_API_BASE_URL || '';

  return (
    <div className="step-content report">

      {/* ── Verdict Banner ── */}
      <div className={`verdict-banner ${verdict}`}>
        <h2>{verdict.toUpperCase()}</h2>
        <div className="score-circle">
          <span className="score">{confidenceScore}%</span>
          <span className="label">Confidence</span>
        </div>
        <p>{getConfidenceLevel(confidenceScore)}</p>
      </div>

      {/* ── Confidence Score Breakdown ── */}
      <div className="section">
        <h3>📊 Confidence Score Breakdown</h3>

        {[
          { label: 'Pattern Match',          value: patternMatch },
          { label: 'Photo Quality',          value: photoQuality },
          { label: 'Evidence Consistency',   value: evidenceConsistency },
          { label: 'Historical Correlation', value: historicalCorrelation },
        ].map(({ label, value }) => (
          <div className="score-item" key={label}>
            <div className="score-label">
              <span>{label}</span>
              <span>{value}/25</span>
            </div>
            <div className="score-bar">
              <div
                className="score-fill"
                style={{ width: `${(value / 25) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Analysis Reasoning ── */}
      <div className="section">
        <h3>🔍 Analysis Reasoning</h3>
        <p style={{ lineHeight: 1.8 }}>{reasoning}</p>
      </div>

      {/* ── Photo Observations (Image Proof Block) ── */}
      {photoObservations.length > 0 && (
        <div className="section">
          <h3>📸 Photo Evidence Observations</h3>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            {photoObservations.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
          {/* Photo thumbnails */}
          {formData.photos?.length > 0 && (
            <div className="photo-preview" style={{ marginTop: 12 }}>
              {formData.photos.map((photo, index) => (
                <div key={index} className="photo-item">
                  <img
                    src={`${apiBase}${photo}`}
                    alt={`Evidence Photo ${index + 1}`}
                    style={{ maxWidth: '100%', borderRadius: 6 }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 4, textAlign: 'center' }}>
                    Photo {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Carrier Claim Probability ── */}
      {Object.keys(carrierClaim).length > 0 && (
        <div className="section">
          <h3>⚖️ Carrier Claim Probability</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: getClaimRatingColor(carrierClaim.rating),
            }}>
              {carrierClaim.score ?? 0}%
            </div>
            <div>
              <div style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 12,
                background: getClaimRatingColor(carrierClaim.rating),
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}>
                {carrierClaim.rating || 'Unknown'}
              </div>
            </div>
          </div>

          {carrierClaim.factors?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <strong>Key Factors:</strong>
              <ul style={{ paddingLeft: 20, lineHeight: 1.9, marginTop: 6 }}>
                {carrierClaim.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {carrierClaim.recommendation && (
            <div style={{
              background: '#f0f4ff',
              border: '1px solid #c7d2fe',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: '0.9rem',
              lineHeight: 1.6,
            }}>
              <strong>Recommendation:</strong> {carrierClaim.recommendation}
            </div>
          )}
        </div>
      )}

      {/* ── Packaging Assessment ── */}
      {Object.keys(packagingAssessment).length > 0 && (
        <div className="section">
          <h3>📦 Packaging Assessment</h3>
          <div className="section-row">
            <span>Failure Detected:</span>
            <span style={{
              fontWeight: 600,
              color: packagingAssessment.failure_detected ? '#dc3545' : '#28a745',
            }}>
              {packagingAssessment.failure_detected ? '⚠️ Yes' : '✓ No'}
            </span>
          </div>
          <div className="section-row">
            <span>Packaging Adequacy:</span>
            <span>{packagingAssessment.packaging_adequacy || 'Unknown'}</span>
          </div>
          {packagingAssessment.indicators?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Indicators:</strong>
              <ul style={{ paddingLeft: 20, lineHeight: 1.9, marginTop: 6 }}>
                {packagingAssessment.indicators.map((ind, i) => (
                  <li key={i}>{ind}</li>
                ))}
              </ul>
            </div>
          )}
          {packagingAssessment.notes && (
            <p style={{ marginTop: 8, color: '#555', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {packagingAssessment.notes}
            </p>
          )}
        </div>
      )}

      {/* ── Case Summary ── */}
      <div className="section">
        <h3>📄 Case Summary</h3>
        <div className="section-row">
          <span>Primary Damage:</span>
          <span>{reportSections.primary_damage || 'Not specified'}</span>
        </div>
        <div className="section-row">
          <span>Damage Type:</span>
          <span>{reportSections.damage_type || 'Not specified'}</span>
        </div>
        <div className="section-row">
          <span>Severity:</span>
          <span>{formData.severity || reportSections.severity || 'Not specified'}</span>
        </div>
        <div className="section-row">
          <span>Data Completeness:</span>
          <span style={{
            fontWeight: 600,
            color: completeness >= 80 ? '#28a745' : completeness >= 50 ? '#ffc107' : '#dc3545',
          }}>
            {completeness !== null ? `${completeness}%` : 'N/A'}
          </span>
        </div>
        <div className="section-row">
          <span>Confidence Level:</span>
          <span>{reportSections.confidence_level || 'Low'}</span>
        </div>
      </div>

      {/* ── Missing Information ── */}
      {missingInformation.length > 0 && (
        <div className="section">
          <h3>⚠️ Missing Information</h3>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            {missingInformation.map((item, i) => (
              <li key={i} style={{ color: '#856404' }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recommended Next Steps ── */}
      <div className="section">
        <h3>✅ Recommended Next Steps</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          {(reportSections.next_steps || [
            'Review case documentation',
            'Gather additional evidence if needed',
            'Consider expert review',
          ]).map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>
      </div>

      {/* ── Photos in Report (if no observations shown above) ── */}
      {photoObservations.length === 0 && formData.photos?.length > 0 && (
        <div className="section">
          <h3>📷 Submitted Photos ({formData.photos.length})</h3>
          <div className="photo-preview">
            {formData.photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img src={`${apiBase}${photo}`} alt={`Photo ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Case ID ── */}
      <div style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem', marginTop: 20 }}>
        Case ID: {formData.caseId}
      </div>

      <div className="footer">
        <div></div>
        <button className="btn btn-primary" onClick={resetForm}>
          Submit New Case
        </button>
      </div>
    </div>
  );
}

export default Report;