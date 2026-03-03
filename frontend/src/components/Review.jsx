function Review({ formData, updateFormData, nextStep, prevStep }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const CATEGORY_LABELS = {
    dining: 'Dining Room + Kitchen',
    living: 'Living Room',
    bedroom: 'Bedroom',
    office: 'Home Office',
    accent: 'Accent Furniture',
    outdoor: 'Outdoor'
  };

  const BOL_LABELS = {
    'signed_clean': 'Signed Clean',
    'not_signed': 'Not Signed',
    'damage_notated': 'Damage Notated',
    'no_bol': 'No BOL Available'
  };

  const DISCOVERY_LABELS = {
    'upon_delivery': 'Upon delivery',
    'unpacking': 'During unpacking',
    'within_24h': 'Within 24 hours',
    'days_later': 'Days later',
    'unknown': 'Unknown'
  };

  // Calculate completeness score
  const calculateCompleteness = () => {
    let score = 0;
    const fields = [];

    // Critical field
    if (formData.damageDesc?.length >= 30) {
      score += 30;
      fields.push({ name: 'Damage Description', filled: true, type: 'critical' });
    } else {
      fields.push({ name: 'Damage Description', filled: false, type: 'critical' });
    }

    // Recommended fields
    if (formData.bolStatus) {
      score += 20;
      fields.push({ name: 'BOL Status', filled: true, type: 'recommended' });
    } else {
      fields.push({ name: 'BOL Status', filled: false, type: 'recommended' });
    }

    if (formData.deliveryDate) {
      score += 15;
      fields.push({ name: 'Delivery Date', filled: true, type: 'recommended' });
    } else {
      fields.push({ name: 'Delivery Date', filled: false, type: 'recommended' });
    }

    if (formData.damageTypes?.length > 0) {
      score += 10;
      fields.push({ name: 'Damage Types', filled: true, type: 'recommended' });
    } else {
      fields.push({ name: 'Damage Types', filled: false, type: 'recommended' });
    }

    if (formData.discoveryTime) {
      score += 5;
      fields.push({ name: 'Discovery Time', filled: true, type: 'recommended' });
    } else {
      fields.push({ name: 'Discovery Time', filled: false, type: 'recommended' });
    }

    // Optional fields
    if (formData.shipDate) {
      score += 5;
      fields.push({ name: 'Ship Date', filled: true, type: 'optional' });
    } else {
      fields.push({ name: 'Ship Date', filled: false, type: 'optional' });
    }

    if (formData.carrier) {
      score += 5;
      fields.push({ name: 'Carrier', filled: true, type: 'optional' });
    } else {
      fields.push({ name: 'Carrier', filled: false, type: 'optional' });
    }

    if (formData.warehouse) {
      score += 5;
      fields.push({ name: 'Warehouse', filled: true, type: 'optional' });
    } else {
      fields.push({ name: 'Warehouse', filled: false, type: 'optional' });
    }

    if (formData.category) {
      score += 2;
      fields.push({ name: 'Category', filled: true, type: 'optional' });
    } else {
      fields.push({ name: 'Category', filled: false, type: 'optional' });
    }

    if (formData.damageLocation) {
      score += 2;
      fields.push({ name: 'Damage Location', filled: true, type: 'optional' });
    } else {
      fields.push({ name: 'Damage Location', filled: false, type: 'optional' });
    }

    if (formData.damageContext) {
      score += 1;
      fields.push({ name: 'Additional Context', filled: true, type: 'optional' });
    } else {
      fields.push({ name: 'Additional Context', filled: false, type: 'optional' });
    }

    return { score, fields };
  };

  const { score, fields } = calculateCompleteness();

  const handleSubmit = async () => {
    // Prepare submission data
    const submissionData = {
      shipDate: formData.shipDate,
      deliveryDate: formData.deliveryDate,
      notificationDate: formData.notificationDate,
      bolStatus: formData.bolStatus,
      bolDamageDesc: formData.bolDamageDesc,
      carrier: formData.carrier,
      warehouse: formData.warehouse,
      category: formData.category,
      subcategory: formData.subcategory,
      itemName: formData.itemName,
      damageTypes: formData.damageTypes,
      severity: formData.severity,
      damageDesc: formData.damageDesc,
      damageLocation: formData.damageLocation,
      discoveryTime: formData.discoveryTime,
      damageContext: formData.damageContext,
      photos: formData.photos
    };

    // Submit case
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        throw new Error('Failed to submit case');
      }

      const data = await response.json();
      updateFormData({ caseId: data.case_id });
      nextStep();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit case. Please try again.');
    }
  };

  return (
    <div className="step-content">
      <h2>Review & Submit</h2>
      <p>Review your submission before analyzing</p>

      {/* Data Completeness Score */}
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
          <div className="completeness-fill" style={{ width: `${score}%` }}></div>
        </div>
        <div className="completeness-items">
          {fields.map((field, index) => (
            <div
              key={index}
              className={`completeness-item ${field.type} ${field.filled ? 'filled' : ''}`}
            >
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
        <div className="section-row">
          <span>Ship Date:</span>
          <span>{formatDate(formData.shipDate)}</span>
        </div>
        <div className="section-row">
          <span>Delivery Date:</span>
          <span>{formatDate(formData.deliveryDate)}</span>
        </div>
        <div className="section-row">
          <span>Notification Date:</span>
          <span>{formatDate(formData.notificationDate)}</span>
        </div>
        <div className="section-row">
          <span>BOL Status:</span>
          <span>{BOL_LABELS[formData.bolStatus] || 'Not specified'}</span>
        </div>
        {formData.bolDamageDesc && (
          <div className="section-row">
            <span>BOL Damage:</span>
            <span>{formData.bolDamageDesc}</span>
          </div>
        )}
        <div className="section-row">
          <span>Carrier:</span>
          <span>{formData.carrier || 'Not specified'}</span>
        </div>
        <div className="section-row">
          <span>Warehouse:</span>
          <span>{formData.warehouse || 'Not specified'}</span>
        </div>
      </div>

      {/* Item Details */}
      <div className="section">
        <h3>🪑 Item Details</h3>
        <div className="section-row">
          <span>Category:</span>
          <span>{CATEGORY_LABELS[formData.category] || 'Not specified'}</span>
        </div>
        <div className="section-row">
          <span>Subcategory:</span>
          <span>{formData.subcategory || 'Not specified'}</span>
        </div>
        <div className="section-row">
          <span>Item Name:</span>
          <span>{formData.itemName || 'Not specified'}</span>
        </div>
      </div>

      {/* Damage Information */}
      <div className="section">
        <h3>📝 Damage Information</h3>
        <div className="section-row">
          <span>Damage Types:</span>
          <span>
            {formData.damageTypes?.length > 0
              ? formData.damageTypes.join(', ')
              : 'Not specified'}
          </span>
        </div>
        <div className="section-row">
          <span>Severity:</span>
          <span>{formData.severity || 'Not specified'}</span>
        </div>
        <div className="section-row">
          <span>Discovered:</span>
          <span>{DISCOVERY_LABELS[formData.discoveryTime] || 'Not specified'}</span>
        </div>
        <div className="section-row" style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, color: '#666' }}>Description:</span>
          <p style={{ marginTop: 5, lineHeight: 1.6, color: '#333' }}>
            {formData.damageDesc}
          </p>
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
                <img src={`${import.meta.env.VITE_API_BASE_URL}${photo}`} alt={`Photo ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="note">
        <strong>⚠️ Note:</strong> {formData.photos?.length > 0 
          ? 'Photos uploaded - analysis will include photo quality scoring.'
          : 'No photos uploaded. Confidence will be limited to 40%.'}
      </div>

      <div className="footer">
        <button className="btn btn-secondary" onClick={prevStep}>
          ← Previous
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          Submit for Analysis →
        </button>
      </div>
    </div>
  );
}

export default Review;