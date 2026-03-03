import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ReportDisplay.css';

const API_BASE = 'http://localhost:8000'; // For testing locally

function ReportDisplay() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchCaseData();
  }, [caseId]);
  
  const fetchCaseData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/cases/${caseId}`);
      setCaseData(response.data);
      
      // If case is still processing, poll for updates
      if (response.data.case.status === 'processing') {
        setTimeout(fetchCaseData, 2000);
      }
    } catch (err) {
      setError('Failed to load case data');
      console.error('Error fetching case:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const getVerdictColor = (verdict) => {
    switch (verdict) {
      case 'manufacturing':
        return 'manufacturing';
      case 'transit':
        return 'transit';
      default:
        return 'inconclusive';
    }
  };
  
  const getConfidenceColor = (score) => {
    if (score >= 70) return 'high';
    if (score >= 55) return 'medium';
    return 'low';
  };
  
  if (loading) {
    return (
      <div className="report-display loading">
        <div className="loading-spinner"></div>
        <h2>Loading Case Report...</h2>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="report-display error">
        <h2>Error</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Return Home
        </button>
      </div>
    );
  }
  
  if (!caseData || !caseData.verdict) {
    return (
      <div className="report-display processing">
        <div className="loading-spinner"></div>
        <h2>Analysis in Progress...</h2>
        <p>Please wait while we analyze your case</p>
      </div>
    );
  }
  
  const { case: caseInfo, verdict, evidence } = caseData;
  const report = verdict.report_sections;
  
  return (
    <div className="report-display">
      <div className="report-container">
        <header className="report-header">
          <h1>Forensic Analysis Report</h1>
          <p className="case-id">Case ID: {caseId}</p>
        </header>
        
        {/* Verdict Banner */}
        <div className={`verdict-banner ${getVerdictColor(verdict.verdict)}`}>
          <h2>Verdict: {verdict.verdict.toUpperCase()}</h2>
          <div className="confidence-score">
            <div className="score-circle">
              <span className="score">{verdict.confidence_score}%</span>
              <span className="label">Confidence</span>
            </div>
          </div>
          <p className={`confidence-level ${getConfidenceColor(verdict.confidence_score)}`}>
            {verdict.confidence_score >= 70 ? 'High Confidence' : 
             verdict.confidence_score >= 55 ? 'Medium Confidence' : 'Low Confidence'}
          </p>
        </div>
        
        {/* Reasoning */}
        <div className="report-section">
          <h3>Analysis Reasoning</h3>
          <p className="reasoning-text">{verdict.reasoning}</p>
        </div>
        
        {/* Score Breakdown */}
        <div className="report-section">
          <h3>Confidence Score Breakdown</h3>
          <div className="score-grid">
            <div className="score-item">
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${verdict.pattern_match_score}%` }}></div>
              </div>
              <span className="score-label">Pattern Match</span>
              <span className="score-value">{verdict.pattern_match_score}/25</span>
            </div>
            <div className="score-item">
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${verdict.photo_quality_score}%` }}></div>
              </div>
              <span className="score-label">Photo Quality</span>
              <span className="score-value">{verdict.photo_quality_score}/25</span>
            </div>
            <div className="score-item">
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${verdict.evidence_consistency_score}%` }}></div>
              </div>
              <span className="score-label">Evidence Consistency</span>
              <span className="score-value">{verdict.evidence_consistency_score}/25</span>
            </div>
            <div className="score-item">
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${verdict.historical_correlation_score}%` }}></div>
              </div>
              <span className="score-label">Historical Correlation</span>
              <span className="score-value">{verdict.historical_correlation_score}/25</span>
            </div>
          </div>
        </div>
        
        {/* Report Sections */}
        <div className="report-sections">
          {Object.entries(report).map(([key, section]) => (
            <div key={key} className="report-section">
              <h3>{section.title}</h3>
              <div className="section-content">
                {Object.entries(section).map(([itemKey, value]) => {
                  if (itemKey === 'title') return null;
                  if (Array.isArray(value)) {
                    return (
                      <ul key={itemKey}>
                        {value.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <div key={itemKey} className="section-item">
                      <span className="item-key">{itemKey}:</span>
                      <span className="item-value">{String(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Evidence Photos */}
        {evidence.length > 0 && (
          <div className="report-section">
            <h3>Evidence Photos ({evidence.length})</h3>
            <div className="photos-grid">
              {evidence.map((photo, index) => (
                <div key={index} className="photo-item">
                  <img
                    src={`${API_BASE}${photo.url}`}
                    alt={`Evidence ${index + 1}`}
                    className="evidence-photo"
                  />
                  {photo.angle && (
                    <span className="photo-angle">{photo.angle}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="report-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/submit')}>
            Submit New Case
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Download Report (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportDisplay;