import { useState, useEffect } from 'react';

const SUBCATEGORIES = {
  dining: ['Dining Chairs', 'Dining Tables', 'Bar/Counter Stools', 'Dining Sets', 'Buffet Tables/Sideboards', 'Side/End Tables', 'Coffee Tables', 'Other'],
  living: ['Sectionals', 'Side/End Tables', 'Accent Chairs', 'Sofas', 'Ottomans', 'TV Stands/Media Consoles', 'Coffee Tables', 'Other'],
  bedroom: ['Nightstands', 'Beds', 'Dressers/Chests', 'Headboards', 'Mirrors/Wall Art', 'Other'],
  office: ['Bookcases/Shelving', 'Desks', 'TV Stands/Media Consoles', 'Office Chairs', 'Side/End Tables', 'Other'],
  accent: ['Floor Decor', 'Console Tables', 'Rugs', 'Benches', 'Pet Furniture', 'Pillows', 'Other'],
  outdoor: ['Outdoor Seating', 'Outdoor Tables', 'Outdoor Dining', 'Accessories', 'Other']
};

const CATEGORY_LABELS = {
  dining: 'Dining Room + Kitchen',
  living: 'Living Room',
  bedroom: 'Bedroom',
  office: 'Home Office',
  accent: 'Accent Furniture',
  outdoor: 'Outdoor'
};

function ItemDetails({ formData, updateFormData, nextStep, prevStep }) {
  const [subcategories, setSubcategories] = useState([]);

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    updateFormData({ category, subcategory: '' });
    
    if (category && SUBCATEGORIES[category]) {
      setSubcategories(SUBCATEGORIES[category]);
    } else {
      setSubcategories([]);
    }
  };

  const handleNext = () => {
    updateFormData({
      subcategory: document.getElementById('subcategory').value,
      itemName: document.getElementById('itemName').value
    });
    nextStep();
  };

  return (
    <div className="step-content">
      <h2>Item Details</h2>
      <p>Provide information about the damaged item</p>

      <div className="form-group">
        <label>
          Category
          <span className="optional">- Optional</span>
        </label>
        <select id="category" value={formData.category} onChange={handleCategoryChange}>
          <option value="">Select...</option>
          <option value="dining">Dining Room + Kitchen</option>
          <option value="living">Living Room</option>
          <option value="bedroom">Bedroom</option>
          <option value="office">Home Office</option>
          <option value="accent">Accent Furniture</option>
          <option value="outdoor">Outdoor</option>
        </select>
      </div>

      <div className="form-group">
        <label>
          Subcategory
          <span className="optional">- Optional</span>
        </label>
        <select id="subcategory" value={formData.subcategory} disabled={!formData.category}>
          <option value="">Select a category first...</option>
          {subcategories.map(sub => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>
          Item Name
          <span className="optional">- Optional</span>
        </label>
        <input
          type="text"
          id="itemName"
          placeholder="e.g., Oak Dining Table, Sectional Sofa"
          defaultValue={formData.itemName}
        />
      </div>

      <div className="footer">
        <button className="btn btn-secondary" onClick={prevStep}>
          ← Previous
        </button>
        <button className="btn btn-primary" onClick={handleNext}>
          Next →
        </button>
      </div>
    </div>
  );
}

export default ItemDetails;