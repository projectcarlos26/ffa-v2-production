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

  const verdict = result.verdict || 'inconclusive';
  const confidenceScore = result.confidence_score || 0;
  const reasoning = result.reasoning || '';
  const reportSections = result.report_sections || {};

  return (
    <div className="step-content report">
      {/* Verdict Banner */}
      <div className={`verdict-banner ${verdict}`}>
        <h2>{verdict.toUpperCase()}</h2>
        <div className="score-circle">
          <span className="score">{confidenceScore}%</span>
          <span className="label">Confidence</span>
        </div>
        <p>{getConfidenceLevel(confidenceScore)}</p>
      </div>

      {/* Confidence Score Breakdown */}
      <div className="section">
        <h3>📊 Confidence Score Breakdown</h3>
        
        <div className="score-item">
          <div className="score-label">
            <span>Pattern Match</span>
            <span>{result.pattern_match_score || 0}/25</span>
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{ width: `${((result.pattern_match_score || 0) / 25) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="score-item">
          <div className="score-label">
            <span>Photo Quality</span>
            <span>{result.photo_quality_score || 0}/25</span>
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{ width: `${((result.photo_quality_score || 0) / 25) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="score-item">
          <div className="score-label">
            <span>Evidence Consistency</span>
            <span>{result.evidence_consistency_score || 0}/25</span>
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{ width: `${((result.evidence_consistency_score || 0) / 25) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="score-item">
          <div className="score-label">
            <span>Historical Correlation</span>
            <span>{result.historical_correlation_score || 0}/25</span>
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{ width: `${((result.historical_correlation_score || 0) / 25) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Analysis Reasoning */}
      <div className="section">
        <h3>🔍 Analysis Reasoning</h3>
        <p style={{ lineHeight: 1.8 }}>{reasoning}</p>
      </div>

      {/* Recommended Next Steps */}
      <div className="section">
        <h3>✅ Recommended Next Steps</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          {(reportSections.next_steps || [
            'Review case documentation',
            'Gather additional evidence if needed',
            'Consider expert review'
          ]).map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ul>
      </div>

      {/* Case Summary */}
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
          <span>{reportSections.completeness || 'N/A'}%</span>
        </div>
        <div className="section-row">
          <span>Confidence Level:</span>
          <span>{reportSections.confidence_level || 'Low'}</span>
        </div>
      </div>

      {/* Photos in Report */}
      {formData.photos?.length > 0 && (
        <div className="section">
          <h3>📸 Submitted Photos ({formData.photos.length})</h3>
          <div className="photo-preview">
            {formData.photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img src={`${import.meta.env.VITE_API_BASE_URL}${photo}`} alt={`Photo ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Case ID */}
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