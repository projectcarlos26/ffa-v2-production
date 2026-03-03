import { useState } from 'react';

const DISCOVERY_LABELS = {
  upon_delivery: 'Upon delivery',
  unpacking: 'During unpacking',
  within_24h: 'Within 24 hours',
  days_later: 'Days later',
  unknown: 'Unknown'
};

const SEVERITY_LABELS = {
  1: 'Minor',
  2: 'Moderate',
  3: 'Major',
  4: 'Severe'
};

function DamageDescription({ formData, updateFormData, nextStep, prevStep }) {
  const [selectedDamageTypes, setSelectedDamageTypes] = useState(formData.damageTypes || []);
  const [severity, setSeverity] = useState('Moderate');
  const [descLength, setDescLength] = useState(formData.damageDesc?.length || 0);
  const [photos, setPhotos] = useState(formData.photos || []);
  const [uploading, setUploading] = useState(false);

  const toggleTag = (type) => {
    setSelectedDamageTypes(prev => {
      const newTypes = prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type];
      return newTypes;
    });
  };

  const updateSeverity = (value) => {
    setSeverity(SEVERITY_LABELS[value]);
    updateFormData({ severity: SEVERITY_LABELS[value] });
  };

  const updateDesc = (value) => {
    setDescLength(value.length);
    updateFormData({ damageDesc: value });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        return data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setPhotos(prev => [...prev, ...uploadedUrls]);
      updateFormData({ photos: [...photos, ...uploadedUrls] });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    updateFormData({ photos: newPhotos });
  };

  const handleNext = () => {
    updateFormData({
      damageTypes: selectedDamageTypes,
      severity,
      damageLocation: document.getElementById('damageLocation')?.value || '',
      discoveryTime: document.getElementById('discoveryTime')?.value || '',
      damageContext: document.getElementById('damageContext')?.value || ''
    });
    nextStep();
  };

  const canProceed = descLength >= 30;

  return (
    <div className="step-content">
      <h2>Describe the Damage</h2>
      <p>Provide detailed information about the damage</p>

      {/* Photo Upload */}
      <div className="form-group">
        <label>
          Photos
          <span className="optional">- Optional (up to 20 photos)</span>
        </label>
        <input
          type="file"
          id="photoUpload"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <label htmlFor="photoUpload" className="photo-upload-area">
          <div className="photo-upload-icon">📸</div>
          <div style={{ fontWeight: 600, marginBottom: 5 }}>
            {uploading ? 'Uploading...' : 'Click to upload photos'}
          </div>
          <div style={{ color: '#999', fontSize: '0.9rem' }}>
            JPEG, PNG, WebP (max 10MB each)
          </div>
        </label>

        {/* Photo Preview */}
        <div className="photo-preview">
          {photos.map((photo, index) => (
            <div key={index} className="photo-item">
              <img src={`${import.meta.env.VITE_API_BASE_URL}${photo}`} alt={`Damage photo ${index + 1}`} />
              <button className="photo-remove" onClick={() => removePhoto(index)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Damage Type Tags */}
      <div className="form-group">
        <label>
          Damage Type
          <span className="optional">- Select all that apply</span>
        </label>
        <div className="tags-container">
          {[
            { type: 'broken', label: 'Broken/Cracked' },
            { type: 'scratched', label: 'Scratched/Dented' },
            { type: 'torn', label: 'Torn/Stained' },
            { type: 'missing', label: 'Missing Parts' },
            { type: 'assembly', label: 'Assembly Issues' },
            { type: 'other', label: 'Other' }
          ].map(({ type, label }) => (
            <div
              key={type}
              className={`tag ${selectedDamageTypes.includes(type) ? 'selected' : ''}`}
              onClick={() => toggleTag(type)}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Severity Slider */}
      <div className="form-group severity-container">
        <label style={{ fontWeight: 600, color: '#333' }}>Damage Severity</label>
        <input
          type="range"
          min="1"
          max="4"
          value={Object.keys(SEVERITY_LABELS).find(key => SEVERITY_LABELS[key] === severity) || 2}
          className="severity-slider"
          onChange={(e) => updateSeverity(parseInt(e.target.value))}
        />
        <div className="severity-value">{severity}</div>
        <div className="severity-labels">
          <span>Minor</span>
          <span>Moderate</span>
          <span>Major</span>
          <span>Severe</span>
        </div>
      </div>

      {/* Guided Prompts */}
      <div className="form-group">
        <label style={{ fontWeight: 600, color: '#667eea' }}>
          What damage do you see?
          <span style={{ color: '#dc3545', marginLeft: 5 }}>*</span>
        </label>
        <textarea
          id="damageDesc"
          placeholder="e.g., The left leg of the table is cracked at the mid-joint..."
          value={formData.damageDesc}
          onChange={(e) => updateDesc(e.target.value)}
        />
        <div className={`char-count ${descLength >= 30 ? 'valid' : 'invalid'}`}>
          {descLength} / 30 minimum
        </div>
        <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 4 }}>
          Describe the physical damage in detail
        </div>
      </div>

      <div className="form-group">
        <label style={{ fontWeight: 600, color: '#333' }}>
          Where is the damage located?
          <span className="optional">- Optional</span>
        </label>
        <textarea
          id="damageLocation"
          placeholder="e.g., On the left front leg, near the bottom..."
          defaultValue={formData.damageLocation}
        />
        <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 4 }}>
          Specify the exact location on the item
        </div>
      </div>

      <div className="form-group">
        <label style={{ fontWeight: 600, color: '#333' }}>
          When was the damage discovered?
          <span className="optional">- Optional</span>
        </label>
        <select id="discoveryTime" defaultValue={formData.discoveryTime}>
          <option value="">Select...</option>
          <option value="upon_delivery">Upon delivery</option>
          <option value="unpacking">During unpacking</option>
          <option value="within_24h">Within 24 hours</option>
          <option value="days_later">Days later</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      <div className="form-group">
        <label style={{ fontWeight: 600, color: '#333' }}>
          Any other context?
          <span className="optional">- Optional</span>
        </label>
        <textarea
          id="damageContext"
          placeholder="e.g., The box appeared intact with no visible damage..."
          defaultValue={formData.damageContext}
          style={{ minHeight: 60 }}
        />
        <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 4 }}>
          Include shipping experience, assembly notes, or other relevant details
        </div>
      </div>

      <div className="note">
        <strong>💡 Example:</strong> "The left leg of the oak dining table is cracked at the mid-joint. The damage was discovered during unpacking 2 days after delivery. The box appeared intact with no visible damage."
      </div>

      <div className="footer">
        <button className="btn btn-secondary" onClick={prevStep}>
          ← Previous
        </button>
        <button className="btn btn-primary" onClick={handleNext} disabled={!canProceed}>
          Next →
        </button>
      </div>
    </div>
  );
}

export default DamageDescription;