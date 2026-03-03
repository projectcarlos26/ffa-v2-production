import { useState } from 'react';

function CaseDetails({ formData, updateFormData, nextStep }) {
  const [showBOLField, setShowBOLField] = useState(formData.bolStatus === 'damage_notated');
  const [showBOLWarning, setShowBOLWarning] = useState(formData.bolStatus === 'no_bol');

  const handleBOLChange = (e) => {
    const value = e.target.value;
    updateFormData({ bolStatus: value });
    
    if (value === 'damage_notated') {
      setShowBOLField(true);
      setShowBOLWarning(false);
    } else if (value === 'no_bol') {
      setShowBOLField(false);
      setShowBOLWarning(true);
    } else {
      setShowBOLField(false);
      setShowBOLWarning(false);
    }
  };

  const handleNext = () => {
    updateFormData({
      shipDate: document.getElementById('shipDate').value,
      deliveryDate: document.getElementById('deliveryDate').value,
      notificationDate: document.getElementById('notificationDate').value,
      carrier: document.getElementById('carrier').value,
      warehouse: document.getElementById('warehouse').value,
      bolDamageDesc: document.getElementById('bolDamageDesc')?.value || ''
    });
    nextStep();
  };

  return (
    <div className="step-content">
      <h2>Case Details</h2>
      <p>Provide shipping and delivery information</p>

      <div className="form-row">
        <div className="form-group">
          <label>
            Ship Date
            <span className="optional">- Optional</span>
          </label>
          <input type="date" id="shipDate" defaultValue={formData.shipDate} />
        </div>

        <div className="form-group">
          <label>
            Delivery Date
            <span className="soft-required">(highly recommended)</span>
            <span className="tooltip-container">
              <span className="tooltip-icon">?</span>
              <span className="tooltip-text">
                Critical for establishing damage timeline. Helps determine if damage occurred during transit window.
              </span>
            </span>
          </label>
          <input type="date" id="deliveryDate" defaultValue={formData.deliveryDate} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>
            Notification Date
            <span className="optional">- Optional</span>
          </label>
          <input type="date" id="notificationDate" defaultValue={formData.notificationDate} />
        </div>

        <div className="form-group">
          <label>
            BOL Status
            <span className="soft-required">(highly recommended)</span>
            <span className="tooltip-container">
              <span className="tooltip-icon">?</span>
              <span className="tooltip-text">
                Extremely valuable for damage attribution. "Damage Notated" strongly suggests transit damage. "Signed Clean" supports manufacturing defect.
              </span>
            </span>
          </label>
          <select id="bolStatus" value={formData.bolStatus} onChange={handleBOLChange}>
            <option value="">Select...</option>
            <option value="signed_clean">Signed Clean</option>
            <option value="not_signed">Not Signed</option>
            <option value="damage_notated">Damage Notated</option>
            <option value="no_bol">No BOL Available</option>
          </select>
        </div>
      </div>

      {/* Conditional BOL Damage Field */}
      {showBOLField && (
        <div className="conditional-field">
          <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
            What damage was noted on the BOL?
            <span className="optional">- Optional</span>
          </label>
          <textarea
            id="bolDamageDesc"
            placeholder="Describe the damage that was documented..."
            defaultValue={formData.bolDamageDesc}
            style={{ minHeight: '60px', width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </div>
      )}

      {/* BOL Warning */}
      {showBOLWarning && (
        <div className="conditional-field warning">
          <strong>⚠️ Note:</strong> Without BOL documentation, transit damage analysis will be limited. Consider requesting delivery confirmation or photos.
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>
            Carrier
            <span className="optional">- Optional</span>
          </label>
          <input type="text" id="carrier" placeholder="e.g., FedEx, UPS, XYZ Freight" defaultValue={formData.carrier} />
        </div>

        <div className="form-group">
          <label>
            Warehouse
            <span className="optional">- Optional</span>
          </label>
          <input type="text" id="warehouse" placeholder="e.g., Dallas DC, Northeast Hub" defaultValue={formData.warehouse} />
        </div>
      </div>

      <div className="footer">
        <div></div>
        <button className="btn btn-primary" onClick={handleNext}>
          Next →
        </button>
      </div>
    </div>
  );
}

export default CaseDetails;