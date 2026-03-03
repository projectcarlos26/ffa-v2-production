# FFA v2 - Full Stack Production Deployment

Complete Furniture Forensic Analyst v2 application with photo upload capability.

---

## 🎯 Overview

This is a full-stack application consisting of:
- **Backend:** FastAPI with Python (Deploy to Render)
- **Frontend:** React with Vite (Deploy to Vercel)
- **Database:** SQLite
- **Features:** Photo upload, AI damage attribution, BOL analysis, damage tags, severity scoring

---

## 📁 Project Structure

```
ffa-mvp/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── database.py          # Database models
│   ├── analysis.py          # AI analysis engine
│   ├── Dockerfile           # Backend container
│   ├── requirements.txt     # Python dependencies
│   └── uploads/             # Photo storage
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React app
│   │   ├── App.css          # Main styles
│   │   └── components/      # React components
│   │       ├── CaseDetails.jsx
│   │       ├── ItemDetails.jsx
│   │       ├── DamageDescription.jsx
│   │       ├── Review.jsx
│   │       ├── Analyzing.jsx
│   │       └── Report.jsx
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite configuration
├── STEP_BY_STEP_DEPLOYMENT.md  # Deployment guide
└── README.md                # This file
```

---

## ✨ Features

### Backend (FastAPI)
- ✅ Photo upload endpoint (JPEG, PNG, WebP, max 10MB)
- ✅ Case submission with all new form fields
- ✅ AI analysis with 4-factor scoring
- ✅ BOL status influence on analysis
- ✅ Damage type and severity scoring
- ✅ Data completeness calculation
- ✅ SQLite database for storage

### Frontend (React)
- ✅ 6-step wizard flow
- ✅ Photo upload with preview
- ✅ Damage type tags (multi-select)
- ✅ Severity slider (Minor to Severe)
- ✅ Guided description prompts
- ✅ Conditional follow-up fields
- ✅ Data completeness score in review
- ✅ Soft required indicators with tooltips
- ✅ Responsive design

---

## 🚀 Quick Deployment

### 1. Push to GitHub

```bash
# Initialize git (if not already done)
cd ffa-mvp
git init
git add .
git commit -m "Initial commit - FFA v2 production"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/ffa-v2-production.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 2. Deploy Backend to Render

1. Go to https://dashboard.render.com/
2. Click "+ New" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - Name: `ffa-v2-backend`
   - Root Directory: `backend`
   - Runtime: Docker
   - Dockerfile Path: `./Dockerfile`
5. Click "Create Web Service"
6. Copy backend URL (e.g., `https://ffa-v2-backend.onrender.com`)

### 3. Deploy Frontend to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import GitHub repository
4. Configure:
   - Framework: Vite
   - Root Directory: `frontend`
   - Environment Variable:
     - Name: `VITE_API_BASE_URL`
     - Value: `YOUR_RENDER_BACKEND_URL`
5. Click "Deploy"
6. Wait for deployment (~1-2 minutes)

---

## 🧪 Testing

### Test Backend Health
```bash
curl https://YOUR-BACKEND-URL.onrender.com/
```

Expected response:
```json
{
  "message": "FFA v2 API - MVP",
  "status": "running",
  "version": "2.0.0-MVP"
}
```

### Test Frontend
1. Open your Vercel frontend URL
2. Complete the 6-step submission flow
3. Upload photos
4. View analysis report

---

## 📊 API Endpoints

### Health Check
- `GET /` - API status

### Case Management
- `POST /api/submit` - Submit new case
- `GET /api/cases/{case_id}` - Get case details
- `GET /api/cases/{case_id}/status` - Get analysis status
- `POST /api/analyze/{case_id}` - Trigger analysis

### File Upload
- `POST /api/upload` - Upload photo

---

## 🔧 Environment Variables

### Frontend (Vercel)
- `VITE_API_BASE_URL` - Backend API URL (required)

### Backend (Render) - Optional
- `CORS_ORIGINS` - Allowed origins (default: `*`)

---

## 📝 Form Structure

### Step 1: Case Details
- Ship Date (optional)
- Delivery Date (highly recommended)
- Notification Date (optional)
- BOL Status (highly recommended)
- BOL Damage Description (conditional)
- Carrier (optional)
- Warehouse (optional)

### Step 2: Item Details
- Category (optional)
- Subcategory (optional)
- Item Name (optional)

### Step 3: Damage Description
- Photos (optional, up to 20)
- Damage Types (multi-select tags)
- Severity (slider)
- Damage Description (required, min 30 chars)
- Damage Location (optional)
- Discovery Time (optional)
- Additional Context (optional)

### Step 4: Review
- Data completeness score
- Review all entered data
- Submit for analysis

### Step 5: Analyzing
- Animation during analysis

### Step 6: Report
- Verdict and confidence score
- Score breakdown
- Reasoning
- Recommended next steps

---

## 🎨 UI Components

- **Tags:** Multi-select damage type indicators
- **Severity Slider:** 4-point scale (Minor to Severe)
- **Tooltips:** Contextual help for important fields
- **Conditional Fields:** Dynamic fields based on user input
- **Completeness Score:** Visual data quality indicator
- **Photo Upload:** Drag-and-drop or click to upload
- **Photo Preview:** Remove photos before submission

---

## 🐛 Troubleshooting

### CORS Errors
- Add `CORS_ORIGINS=*` to backend environment variables
- Redeploy backend

### Photo Upload Fails
- Check file size (< 10MB)
- Check file type (JPEG, PNG, WebP)
- Check Render logs for errors

### Frontend Cannot Connect
- Verify `VITE_API_BASE_URL` is correct
- No trailing slash
- Redeploy frontend

---

## 💰 Cost

- **Render Free Tier:** 750 hours/month, 512MB RAM
- **Vercel Free Tier:** Unlimited projects, 100GB bandwidth
- **Total:** $0/month for MVP

---

## 📈 Scaling

For production use:
1. Upgrade Render to paid tier ($7/month)
2. Use PostgreSQL instead of SQLite
3. Use cloud storage for photos (AWS S3, Google Cloud)
4. Add monitoring and logging
5. Set up custom domains

---

## 📞 Support

- **Render:** https://render.com/docs
- **Vercel:** https://vercel.com/docs
- **GitHub Issues:** For code-related problems

---

## 🎉 Congratulations!

Your FFA v2 application is ready to deploy with:
- ✅ Full photo upload capability
- ✅ All new form features
- ✅ AI damage attribution
- ✅ Production-ready architecture

Follow the deployment guide to go live!