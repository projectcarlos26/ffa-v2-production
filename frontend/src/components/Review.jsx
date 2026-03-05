import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://ffa-v2-backend2.onrender.com';

const CATEGORY_LABELS = {
  dining:  'Dining Room + Kitchen',
  living:  'Living Room',
  bedroom: 'Bedroom',
  office:  'Home Office',
  accent:  'Accent Furniture',
  outdoor: 'Outdoor',
};

const BOL_LABELS = {
  signed_clean:   'Signed Clean',
  not_signed:     'Not Signed',
  damage_notated: 'Damage Notated',
  no_bol:         'No BOL Available',
};

const DISCOVERY_LABELS = {
  upon_delivery: 'Upon delivery',
  unpacking:     'During unpacking',
  within_24h:    'Within 24 hours',
  days_later:    'Days later',
  unknown:       'Unknown',
};

function Review({ formData, updateFormData, nextStep, prevStep }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    const date = new Date(dateStr);
    return isNaN(date) ? dateStr : date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  // ── Completeness score ──────────────────────
  const calculateCompleteness = () => {
    let score = 0;
    const fields = [];

    const add = (name, filled, type, pts) => {
      if (filled) score += pts;
      fields.push({ name, filled, type });
    };

    add('Damage Description',  (formData.damageDesc?.length || 0) >= 30, 'critical',     30);
    add('BOL Status',          !!formData.bolStatus,                      'recommended',  20);
    add('Delivery Date',       !!formData.deliveryDate,                   'recommended',  15);
    add('Notification Date',   !!formData.notificationDate,               'recommended',  10);
    add('Damage Types',        (formData.damageTypes?.length || 0) > 0,   'recommended',  10);
    add('Discovery Time',      !!formData.discoveryTime,                  'recommended',   5);
    add('Ship Date',           !!formData.shipDate,                       'optional',      5);
    add('Carrier',             !!formData.carrier,                        'optional',      5);
    add('Warehouse',           !!formData.warehouse,                      'optional',      5);
    add('Category',            !!formData.category,                       'optional',      2);
    add('Damage Location',     !!formData.damageLocation,                 'optional',      2);
    add('Additional Context',  !!formData.damageContext,                  'optional',      1);

    return { score: Math.min(score, 100), fields };
  };

  const { score, fields } = calculateCompleteness();

  // ── Submit ──────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError('');

    // Client-side guard for required fields
    const missing = [];
    if (!formData.deliveryDate)     missing.push('Delivery Date');
    if (!formData.notificationDate) missing.push('Notification Date');
    if (!formData.bolStatus)        missing.push('BOL Status');
    if (missing.length) {
      setSubmitError(`Please go back and fill in required fields: ${missing.join(', ')}`);
      return;
    }

    setSubmitting(true);

    const submissionData = {
      shipDate:         formData.shipDate         || null,
      deliveryDate:     formData.deliveryDate,
      notificationDate: formData.notificationDate,
      bolStatus:        formData.bolStatus,
      bolDamageDesc:    formData.bolDamageDesc     || null,
      carrier:          formData.carrier           || null,
      warehouse:        formData.warehouse         || null,
      category:         formData.category          || null,
      subcategory:      formData.subcategory       || null,
      itemName:         formData.itemName          || null,
      damageTypes:      formData.damageTypes       || [],
      severity:         formData.severity          || null,
      damageDesc:       formData.damageDesc,
      damageLocation:   formData.damageLocation    || null,
      discoveryTime:    formData.discoveryTime     || null,
      damageContext:    formData.damageContext      || null,
      photos:           formData.photos            || [],
    };

    try {
      const response = await fetch(`${API_BASE}/api/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.detail?.error || errData?.detail || `Server error ${response.status}`;
        throw new Error(msg);
      }

      const data = await response.json();
      updateFormData({ caseId: data.case_id });
      nextStep();
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError(error.message || 'Failed to submit case. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="step-content">
      <h2>Review &amp; Submit</h2>
      <p>Review your submission before analyzing</p>

      {/* Error banner */}
      {submitError && (
        <div style={{
          background: '#fff0f0', border: '1px solid #f5c6cb',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: '#721c24', fontSize: '0.9rem',
        }}>
          ⚠️ {submitError}
        </div>
      )}

      {/* Completeness Score */}
      <div className="completeness-section">
        <div className="completeness-header">
          <div>
            <strong>Data Completeness</strong>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
              Better data = More accurate analysis
            </div>
          </div>
          <div className="completeness-score">{score}%</div>
        </div>
        <div className="completeness-bar">
          <div className="completeness-fill" style={{ width: `${score}%` }} />
        </div>
        <div className="completeness-items">
          {fields.map((field, i) => (
            <div key={i} className={`completeness-item ${field.type} ${field.filled ? 'filled' : ''}`}>
              <div className={`completeness-icon ${field.filled ? 'filled' : 'missing'}`}>
                {field.filled ? '✓' : '○'}
              </div>
              <span>{field.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Case Details */}
      <div className="section">
        <h3>📋 Case Details</h3>
        <div className="section-row"><span>Ship Date:</span><span>{formatDate(formData.shipDate)}</span></div>
        <div className="section-row">
          <span>Delivery Date: <span style={{ color: '#e53e3e' }}>*</span></span>
          <span style={{ color: formData.deliveryDate ? 'inherit' : '#e53e3e' }}>
            {formatDate(formData.deliveryDate) || '⚠️ Required'}
          </span>
        </div>
        <div className="section-row">
          <span>Notification Date: <span style={{ color: '#e53e3e' }}>*</span></span>
          <span style={{ color: formData.notificationDate ? 'inherit' : '#e53e3e' }}>
            {formatDate(formData.notificationDate) || '⚠️ Required'}
          </span>
        </div>
        <div className="section-row">
          <span>BOL Status: <span style={{ color: '#e53e3e' }}>*</span></span>
          <span style={{ color: formData.bolStatus ? 'inherit' : '#e53e3e' }}>
            {BOL_LABELS[formData.bolStatus] || '⚠️ Required'}
          </span>
        </div>
        {formData.bolDamageDesc && (
          <div className="section-row"><span>BOL Damage:</span><span>{formData.bolDamageDesc}</span></div>
        )}
        <div className="section-row"><span>Carrier:</span><span>{formData.carrier || 'Not specified'}</span></div>
        <div className="section-row"><span>Warehouse:</span><span>{formData.warehouse || 'Not specified'}</span></div>
      </div>

      {/* Item Details */}
      <div className="section">
        <h3>🪑 Item Details</h3>
        <div className="section-row"><span>Category:</span><span>{CATEGORY_LABELS[formData.category] || 'Not specified'}</span></div>
        <div className="section-row"><span>Subcategory:</span><span>{formData.subcategory || 'Not specified'}</span></div>
        <div className="section-row"><span>Item Name:</span><span>{formData.itemName || 'Not specified'}</span></div>
      </div>

      {/* Damage Information */}
      <div className="section">
        <h3>📝 Damage Information</h3>
        <div className="section-row">
          <span>Damage Types:</span>
          <span>{formData.damageTypes?.length > 0 ? formData.damageTypes.join(', ') : 'Not specified'}</span>
        </div>
        <div className="section-row"><span>Severity:</span><span>{formData.severity || 'Not specified'}</span></div>
        <div className="section-row">
          <span>Discovered:</span>
          <span>{DISCOVERY_LABELS[formData.discoveryTime] || formData.discoveryTime || 'Not specified'}</span>
        </div>
        <div className="section-row" style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, color: '#666' }}>Description:</span>
          <p style={{ marginTop: 5, lineHeight: 1.6, color: '#333' }}>{formData.damageDesc}</p>
          {formData.damageLocation && (
            <p style={{ marginTop: 10, lineHeight: 1.6, color: '#333' }}>
              <strong>Location:</strong> {formData.damageLocation}
            </p>
          )}
          {formData.damageContext && (
            <p style={{ marginTop: 10, lineHeight: 1.6, color: '#333' }}>
              <strong>Context:</strong> {formData.damageContext}
            </p>
          )}
        </div>
      </div>

      {/* Photos */}
      {formData.photos?.length > 0 && (
        <div className="section">
          <h3>📸 Photos ({formData.photos.length})</h3>
          <div className="photo-preview">
            {formData.photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img
                  src={photo.startsWith('http') ? photo : `${API_BASE}${photo}`}
                  alt={`Photo ${index + 1}`}
                />
              </div>
            ))}
          </div>
          <div className="note" style={{ marginTop: 8 }}>
            ⚠️ <strong>Note:</strong> Photos uploaded - analysis will include photo quality scoring.
          </div>
        </div>
      )}

      {!formData.photos?.length && (
        <div className="note">
          ⚠️ <strong>Note:</strong> No photos uploaded. AI confidence will be limited without visual evidence.
        </div>
      )}

      <div className="footer">
        <button className="btn btn-secondary" onClick={prevStep} disabled={submitting}>
          ← Previous
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit for Analysis →'}
        </button>
      </div>
    </div>
  );
}

export default Review;