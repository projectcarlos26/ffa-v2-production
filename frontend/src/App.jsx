import { useState } from 'react'
import './App.css'
import CaseDetails from './components/CaseDetails'
import ItemDetails from './components/ItemDetails'
import DamageDescription from './components/DamageDescription'
import Review from './components/Review'
import Analyzing from './components/Analyzing'
import Report from './components/Report'

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1: Case Details
    shipDate: '',
    deliveryDate: '',
    notificationDate: '',
    bolStatus: '',
    bolDamageDesc: '',
    carrier: '',
    warehouse: '',
    
    // Step 2: Item Details
    category: '',
    subcategory: '',
    itemName: '',
    
    // Step 3: Damage Info
    damageTypes: [],
    severity: 'Moderate',
    damageDesc: '',
    damageLocation: '',
    discoveryTime: '',
    damageContext: '',
    photos: [],
    
    // Analysis results
    caseId: '',
    analysisResult: null
  })

  const updateFormData = (data) => {
    setFormData(prev => ({ ...prev, ...data }))
  }

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 6))
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const resetForm = () => {
    setCurrentStep(1)
    setFormData({
      shipDate: '',
      deliveryDate: '',
      notificationDate: '',
      bolStatus: '',
      bolDamageDesc: '',
      carrier: '',
      warehouse: '',
      category: '',
      subcategory: '',
      itemName: '',
      damageTypes: [],
      severity: 'Moderate',
      damageDesc: '',
      damageLocation: '',
      discoveryTime: '',
      damageContext: '',
      photos: [],
      caseId: '',
      analysisResult: null
    })
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <CaseDetails
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
          />
        )
      case 2:
        return (
          <ItemDetails
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        )
      case 3:
        return (
          <DamageDescription
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        )
      case 4:
        return (
          <Review
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        )
      case 5:
        return (
          <Analyzing
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
          />
        )
      case 6:
        return (
          <Report
            formData={formData}
            resetForm={resetForm}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="app-container">
      <div className="container">
        <div className="header">
          <h1>🛋️ Furniture Forensic Analyst v2</h1>
          <p>AI-Powered Damage Attribution</p>
          
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(currentStep / 6) * 100}%` }}
            ></div>
          </div>
          
          <div className="steps">
            {[1, 2, 3, 4, 5, 6].map(step => (
              <div
                key={step}
                className={`step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
              >
                {step}
              </div>
            ))}
          </div>
        </div>
        
        <div className="content">
          {renderStep()}
        </div>
      </div>
    </div>
  )
}

export default App