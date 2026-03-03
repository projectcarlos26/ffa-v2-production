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
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const result = await response.json();

        // Get full case data with verdict
        const caseResponse = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/cases/${formData.caseId}`
        );

        if (!caseResponse.ok) {
          throw new Error('Failed to get case data');
        }

        const caseData = await caseResponse.json();

        updateFormData({ analysisResult: caseData.verdict });
        nextStep();
      } catch (error) {
        console.error('Analysis error:', error);
        // Still proceed but with error
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