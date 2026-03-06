import { useState } from 'react'
import './App.css'
import CaseDetails from './components/CaseDetails'
import ItemDetails from './components/ItemDetails'
import DamageDescription from './components/DamageDescription'
import Review from './components/Review'
import Analyzing from './components/Analyzing'
import Report from './components/Report'
import History from './components/History'

function App() {
  const [view, setView] = useState('wizard') // 'wizard' | 'history'
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
    setView('wizard')
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

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginTop: 16,
            marginBottom: 8,
          }}>
            <button
              onClick={() => setView('wizard')}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderRadius: 20,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: view === 'wizard' ? '#667eea' : 'rgba(255,255,255,0.2)',
                color: view === 'wizard' ? '#fff' : 'rgba(255,255,255,0.85)',
                transition: 'all 0.2s',
              }}
            >
              ➕ New Case
            </button>
            <button
              onClick={() => setView('history')}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderRadius: 20,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: view === 'history' ? '#667eea' : 'rgba(255,255,255,0.2)',
                color: view === 'history' ? '#fff' : 'rgba(255,255,255,0.85)',
                transition: 'all 0.2s',
              }}
            >
              📋 Case History
            </button>
          </div>

          {/* Progress bar — only show in wizard view, not on analyzing/report steps */}
          {view === 'wizard' && currentStep <= 4 && (
            <>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(currentStep / 4) * 100}%` }}
                ></div>
              </div>

              <div className="steps">
                {[1, 2, 3, 4].map(step => (
                  <div
                    key={step}
                    className={`step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="content">
          {view === 'history' ? (
            <div className="step-content" style={{ maxWidth: '100%' }}>
              <History />
            </div>
          ) : (
            renderStep()
          )}
        </div>
      </div>
    </div>
  )
}

export default App