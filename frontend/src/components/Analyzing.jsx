import { useEffect } from 'react';

function Analyzing({ formData, updateFormData, nextStep }) {
  useEffect(() => {
    const runAnalysis = async () => {
      try {
        // Trigger analysis
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/analyze/${formData.caseId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const analysisData = await response.json();

        // Build the full analysisResult object from the analyze response
        // This includes scores, carrier_claim_probability, packaging_assessment, etc.
        const analysisResult = {
          verdict:          analysisData.verdict,
          confidence_score: analysisData.confidence_score,
          reasoning:        analysisData.reasoning,

          // Flat score fields for Report.jsx compatibility
          pattern_match_score:          analysisData.scores?.pattern_match          ?? 0,
          photo_quality_score:          analysisData.scores?.photo_quality          ?? 0,
          evidence_consistency_score:   analysisData.scores?.evidence_consistency   ?? 0,
          historical_correlation_score: analysisData.scores?.historical_correlation ?? 0,

          // New fields
          photo_observations:       analysisData.photo_observations       ?? [],
          missing_information:      analysisData.missing_information      ?? [],
          carrier_claim_probability: analysisData.carrier_claim_probability ?? {},
          packaging_assessment:     analysisData.packaging_assessment     ?? {},

          // Report sections (completeness, next_steps, primary_damage, etc.)
          report_sections: analysisData.report_sections ?? {},
        };

        updateFormData({ analysisResult });
        nextStep();
      } catch (error) {
        console.error('Analysis error:', error);
        // Still proceed but with minimal result so Report.jsx can show error state
        updateFormData({
          analysisResult: {
            verdict: 'inconclusive',
            confidence_score: 0,
            reasoning: 'Analysis could not be completed. Please try again.',
            pattern_match_score: 0,
            photo_quality_score: 0,
            evidence_consistency_score: 0,
            historical_correlation_score: 0,
            photo_observations: [],
            missing_information: [],
            carrier_claim_probability: {},
            packaging_assessment: {},
            report_sections: {},
          }
        });
        nextStep();
      }
    };

    // Start analysis after a brief delay
    const timer = setTimeout(runAnalysis, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="step-content analyzing">
      <div className="spinner"></div>
      <h2>Analyzing Your Case...</h2>
      <p>Our AI is analyzing using the 4-factor confidence algorithm</p>

      <div style={{ marginTop: 30, textAlign: 'left', maxWidth: 400, margin: '30px auto 0' }}>
        <div style={{ color: '#667eea', fontWeight: 600, marginBottom: 10 }}>
          Analysis Steps:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#28a745' }}>✓</span>
            <span>Evaluating damage patterns</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#28a745' }}>✓</span>
            <span>Checking BOL status influence</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#28a745' }}>✓</span>
            <span>Analyzing evidence consistency</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#667eea' }}>○</span>
            <span>Generating final verdict...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analyzing;