import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './SubmissionWizard.css';

const API_BASE = 'http://localhost:8000'; // For testing locally

// Constants
const CATEGORIES = [
  {
    id: 'case_goods',
    name: 'Case Goods',
    description: 'Tables, dressers, cabinets, desks',
    icon: '🪑'
  },
  {
    id: 'upholstery',
    name: 'Upholstery',
    description: 'Sofas, chairs, sectionals, ottomans',
    icon: '🛋️'
  },
  {
    id: 'bed_frames',
    name: 'Bed Frames',
    description: 'Platform beds, metal frames, bunk beds',
    icon: '🛏️'
  }
];

const SUBCATEGORIES = {
  case_goods: ['table', 'dresser', 'cabinet', 'desk', 'bookcase', 'shelf', 'other'],
  upholstery: ['sofa', 'chair', 'sectional', 'ottoman', 'loveseat', 'headboard', 'other'],
  bed_frames: ['platform', 'metal', 'wood', 'bunk', 'adjustable', 'other']
};

const MATERIALS = ['oak', 'pine', 'mahogany', 'walnut', 'cherry', 'maple', 'metal', 'upholstered', 'other'];

// Step components
function Step1_CategorySelection({ selectedCategory, onSelect }) {
  return (
    <div className="step-content">
      <h2>Select Furniture Category</h2>
      <p className="step-description">Choose the category that best describes your furniture</p>
      
      <div className="category-cards">
        {CATEGORIES.map(cat => (
          <div
            key={cat.id}
            className={`category-card ${selectedCategory === cat.id ? 'selected' : ''}`}
            onClick={() => onSelect(cat.id)}
          >
            <div className="category-icon">{cat.icon}</div>
            <h3>{cat.name}</h3>
            <p>{cat.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step2_Details({ formData, onChange }) {
  return (
    <div className="step-content">
      <h2>Item Details</h2>
      <p className="step-description">Provide more information about your furniture</p>
      
      <div className="form-group">
        <label>Subcategory *</label>
        <select
          value={formData.subcategory}
          onChange={(e) => onChange({ subcategory: e.target.value })}
          required
        >
          <option value="">Select subcategory</option>
          {SUBCATEGORIES[formData.category]?.map(sub => (
            <option key={sub} value={sub}>{sub.charAt(0).toUpperCase() + sub.slice(1)}</option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label>Material</label>
        <select
          value={formData.material}
          onChange={(e) => onChange({ material: e.target.value })}
        >
          <option value="">Select material</option>
          {MATERIALS.map(mat => (
            <option key={mat} value={mat}>{mat.charAt(0).toUpperCase() + mat.slice(1)}</option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label>Claim Reference (Optional)</label>
        <input
          type="text"
          value={formData.claim_reference}
          onChange={(e) => onChange({ claim_reference: e.target.value })}
          placeholder="e.g., CLAIM-2024-001"
        />
      </div>
    </div>
  );
}

function Step3_PhotoUpload({ photos, onPhotosChange }) {
  const [uploading, setUploading] = useState(false);
  
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (photos.length + files.length > 20) {
      alert('Maximum 20 photos allowed');
      return;
    }
    
    setUploading(true);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post(`${API_BASE}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        return {
          url: response.data.url,
          filename: response.data.filename,
          file: file
        };
      });
      
      const uploadedPhotos = await Promise.all(uploadPromises);
      onPhotosChange([...photos, ...uploadedPhotos]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photos. Please try again.');
    }
    
    setUploading(false);
  };
  
  const handleRemovePhoto = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };
  
  return (
    <div className="step-content">
      <h2>Upload Damage Photos</h2>
      <p className="step-description">
        Upload clear photos of the damage from multiple angles (max 20 photos)
      </p>
      
      <div className="upload-guide">
        <h3>Photo Tips:</h3>
        <ul>
          <li>Overall shot of the damaged area</li>
          <li>Close-up of the damage</li>
          <li>Label/identification tags</li>
          <li>Packaging if damaged during shipping</li>
        </ul>
      </div>
      
      <div className="upload-area">
        <input
          type="file"
          id="photo-upload"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
        />
        <label htmlFor="photo-upload" className="upload-button">
          {uploading ? 'Uploading...' : 'Select Photos'}
        </label>
      </div>
      
      {photos.length > 0 && (
        <div className="photos-grid">
          {photos.map((photo, index) => (
            <div key={index} className="photo-item">
              <img
                src={`${API_BASE}${photo.url}`}
                alt={`Photo ${index + 1}`}
                className="photo-preview"
              />
              <button
                className="remove-photo"
                onClick={() => handleRemovePhoto(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <p className="photo-count">
        {photos.length} / 20 photos uploaded
      </p>
    </div>
  );
}

function Step4_Description({ description, onChange }) {
  const charCount = description.length;
  const isValid = charCount >= 50;
  
  return (
    <div className="step-content">
      <h2>Describe the Damage</h2>
      <p className="step-description">
        Provide a detailed description of the damage (minimum 50 characters)
      </p>
      
      <div className="form-group">
        <textarea
          value={description}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe the damage in detail. Include when it was noticed, what happened, and any relevant context..."
          rows={8}
          maxLength={2000}
        />
        <div className={`char-count ${isValid ? 'valid' : 'invalid'}`}>
          {charCount} / 50 minimum characters
        </div>
      </div>
      
      {!isValid && (
        <p className="validation-error">
          Please provide at least 50 characters for reliable analysis
        </p>
      )}
      
      <div className="description-tips">
        <h3>Tips for a good description:</h3>
        <ul>
          <li>Describe the damage location and severity</li>
          <li>Mention when the damage was first noticed</li>
          <li>Include any relevant events (shipping, assembly, etc.)</li>
          <li>Be as specific as possible about the damage type</li>
        </ul>
      </div>
    </div>
  );
}

function Step5_Review({ formData, photos }) {
  return (
    <div className="step-content">
      <h2>Review & Submit</h2>
      <p className="step-description">
        Review your submission before submitting for analysis
      </p>
      
      <div className="review-section">
        <h3>Category: {CATEGORIES.find(c => c.id === formData.category)?.name}</h3>
        <p>Subcategory: {formData.subcategory || 'Not specified'}</p>
        <p>Material: {formData.material || 'Not specified'}</p>
        <p>Claim Reference: {formData.claim_reference || 'None'}</p>
      </div>
      
      <div className="review-section">
        <h3>Photos: {photos.length} uploaded</h3>
        {photos.length === 0 && (
          <p className="warning">No photos uploaded - confidence will be limited to 40%</p>
        )}
      </div>
      
      <div className="review-section">
        <h3>Damage Description:</h3>
        <p className="description-preview">{formData.damage_description}</p>
      </div>
      
      <div className="submit-notice">
        <p>⚠️ Once submitted, your case will be analyzed by our AI system.</p>
      </div>
    </div>
  );
}

function Step6_Analyzing() {
  return (
    <div className="step-content analyzing">
      <div className="loading-spinner"></div>
      <h2>Analyzing Your Case...</h2>
      <p className="step-description">
        Our AI is analyzing your case using the 4-factor confidence scoring algorithm
      </p>
      <div className="analysis-steps">
        <div className="analysis-step active">Pattern Matching</div>
        <div className="analysis-step">Photo Quality Assessment</div>
        <div className="analysis-step">Evidence Consistency Check</div>
        <div className="analysis-step">Historical Correlation</div>
        <div className="analysis-step">Generating Report</div>
      </div>
    </div>
  );
}

// Main Wizard Component
function SubmissionWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [caseId, setCaseId] = useState(null);
  
  const [formData, setFormData] = useState({
    category: '',
    subcategory: '',
    material: '',
    claim_reference: '',
    damage_description: ''
  });
  
  const [photos, setPhotos] = useState([]);
  
  const steps = [
    { id: 1, title: 'Category' },
    { id: 2, title: 'Details' },
    { id: 3, title: 'Photos' },
    { id: 4, title: 'Description' },
    { id: 5, title: 'Review' },
    { id: 6, title: 'Analysis' }
  ];
  
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.category !== '';
      case 2:
        return formData.subcategory !== '';
      case 3:
        return true; // Photos are optional
      case 4:
        return formData.damage_description.length >= 50;
      case 5:
        return true;
      default:
        return false;
    }
  };
  
  const handleNext = async () => {
    if (!canProceed()) return;
    
    if (currentStep === 5) {
      await handleSubmit();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleSubmit = async () => {
    setSubmitting(true);
    setCurrentStep(6);
    
    try {
      // Submit case
      const submitData = {
        ...formData,
        photos: photos.map(p => p.url)
      };
      
      const submitResponse = await axios.post(`${API_BASE}/api/submit`, submitData);
      const submittedCaseId = submitResponse.data.case_id;
      setCaseId(submittedCaseId);
      
      // Trigger analysis
      await axios.post(`${API_BASE}/api/analyze/${submittedCaseId}`);
      
      // Navigate to report
      setTimeout(() => {
        navigate(`/report/${submittedCaseId}`);
      }, 3000);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit case. Please try again.');
      setCurrentStep(5);
      setSubmitting(false);
    }
  };
  
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1_CategorySelection selectedCategory={formData.category} onSelect={(cat) => setFormData({ ...formData, category: cat })} />;
      case 2:
        return <Step2_Details formData={formData} onChange={(updates) => setFormData({ ...formData, ...updates })} />;
      case 3:
        return <Step3_PhotoUpload photos={photos} onPhotosChange={setPhotos} />;
      case 4:
        return <Step4_Description description={formData.damage_description} onChange={(desc) => setFormData({ ...formData, damage_description: desc })} />;
      case 5:
        return <Step5_Review formData={formData} photos={photos} />;
      case 6:
        return <Step6_Analyzing />;
      default:
        return null;
    }
  };
  
  return (
    <div className="submission-wizard">
      <div className="wizard-container">
        <header className="wizard-header">
          <h1>Submit New Case</h1>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(currentStep / 6) * 100}%` }}></div>
          </div>
          <div className="step-indicators">
            {steps.map(step => (
              <div
                key={step.id}
                className={`step-indicator ${currentStep >= step.id ? 'completed' : ''} ${currentStep === step.id ? 'active' : ''}`}
              >
                {step.id}
              </div>
            ))}
          </div>
          <div className="step-titles">
            {steps.map(step => (
              <span key={step.id} className="step-title">{step.title}</span>
            ))}
          </div>
        </header>
        
        <div className="wizard-content">
          {renderStep()}
        </div>
        
        {currentStep < 6 && (
          <div className="wizard-footer">
            <button
              className="btn btn-secondary"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              Previous
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!canProceed() || submitting}
            >
              {currentStep === 5 ? 'Submit for Analysis' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubmissionWizard;