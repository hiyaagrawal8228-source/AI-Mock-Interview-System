# Setup Guide - AI Mock Interview System (Improved)

## Quick Start

### Prerequisites
- Python 3.9 or higher
- Node.js 16 or higher
- MongoDB (local or cloud)
- Groq API Key ([Get it here](https://console.groq.com))
- Clerk Account ([Sign up here](https://clerk.com))

---

## Backend Setup

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use any text editor
```

Required environment variables:
```env
GROQ_API_KEY=your_groq_api_key
MONGODB_URI=mongodb://localhost:27017/ai_interview
CLERK_SECRET_KEY=your_clerk_secret_key
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Step 5: Start MongoDB
```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas (cloud) - just update MONGODB_URI in .env
```

### Step 6: Run Backend Server
```bash
python app.py
```

Backend will start on `http://localhost:8000`

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## Frontend Setup

### Step 1: Navigate to Frontend Directory
```bash
cd frontend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required environment variables:
```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:8000
```

### Step 4: Run Frontend Development Server
```bash
npm run dev
```

Frontend will start on `http://localhost:5173`

---

## Verification

### Test Backend Health
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "2.0.0",
  "features": [
    "No question repetition",
    "Difficulty-based questions",
    "Proper duration logic",
    "Complete evaluation",
    "Production-grade scoring"
  ]
}
```

### Test API Documentation
Visit: `http://localhost:8000/docs`

You'll see interactive API documentation powered by FastAPI.

---

## Getting API Keys

### 1. Groq API Key
1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up/Login
3. Navigate to API Keys section
4. Create a new API key
5. Copy and paste into `.env` file

### 2. Clerk Keys
1. Go to [https://clerk.com](https://clerk.com)
2. Sign up for free account
3. Create a new application
4. Get your:
   - **Backend**: Secret Key (starts with `sk_`)
   - **Frontend**: Publishable Key (starts with `pk_`)
5. Paste into respective `.env` files

### 3. MongoDB
**Option A: Local MongoDB**
```bash
# Install MongoDB
# Windows: Download from mongodb.com
# Mac: brew install mongodb-community
# Linux: sudo apt-get install mongodb

# Start MongoDB
mongod

# Use in .env
MONGODB_URI=mongodb://localhost:27017/ai_interview
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create a cluster (free tier available)
4. Get connection string
5. Use in .env:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai_interview
```

---

## Testing the System

### 1. Create a User Account
1. Open `http://localhost:5173`
2. Sign up using Clerk authentication
3. Complete your profile (add skills, experience, etc.)

### 2. Upload Resume (Optional)
1. Go to Profile page
2. Upload your resume (PDF or DOCX)
3. System will automatically extract skills

### 3. Start Interview
1. Click "New Interview"
2. Select:
   - **Role**: e.g., "Software Engineer"
   - **Interview Type**: Technical / Behavioral / Coding / Full
   - **Duration**: 5, 10, 15, or 20 minutes
   - **Difficulty**: Easy / Medium / Hard (NEW!)
3. Click "Start Interview"

### 4. Answer Questions
1. System will ask questions one by one
2. Speak your answer or type it
3. System tracks confidence, focus, and progress
4. No questions will repeat!

### 5. View Feedback
1. After completing all questions
2. Click "View Feedback"
3. See comprehensive report with:
   - Confidence Score
   - Technical Score
   - Communication Score
   - Overall Score & Grade
   - Strengths & Weaknesses
   - Actionable Recommendations

---

## Common Issues & Solutions

### Issue: "Module not found" error
**Solution**: Make sure you're in the correct directory and virtual environment is activated
```bash
# Activate venv
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate  # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: MongoDB connection error
**Solution**: 
1. Check if MongoDB is running: `mongod`
2. Verify MONGODB_URI in .env
3. If using Atlas, check username/password

### Issue: Clerk authentication not working
**Solution**:
1. Verify API keys in .env files
2. Check ALLOWED_ORIGINS includes frontend URL
3. Clear browser cache and cookies

### Issue: CORS errors
**Solution**: Update backend .env:
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Issue: Questions repeating
**Solution**: This should NOT happen in v2.0. If it does:
1. Clear session: `DELETE http://localhost:8000/api/session/clear`
2. Start new interview
3. If problem persists, check backend logs

---

## Development Tips

### Backend Development
```bash
# Run with auto-reload
python app.py

# Check logs in terminal for debugging

# Test API endpoints
curl -X POST http://localhost:8000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"role": "Developer", "interview_type": "technical", "duration": 10, "difficulty": "easy"}'
```

### Frontend Development
```bash
# Run development server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Management
```bash
# Connect to MongoDB
mongosh

# Use database
use ai_interview

# View collections
show collections

# Query users
db.users.find()

# Query interviews
db.interviews.find()
```

---

## Production Deployment

### Backend (Example: Heroku)
```bash
# Install Heroku CLI
# Create Heroku app
heroku create ai-interview-backend

# Set environment variables
heroku config:set GROQ_API_KEY=your_key
heroku config:set MONGODB_URI=your_mongodb_uri
heroku config:set CLERK_SECRET_KEY=your_clerk_key

# Deploy
git push heroku main
```

### Frontend (Example: Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables for Production
Make sure to update:
- `ALLOWED_ORIGINS` to include production URLs
- `VITE_API_URL` to production backend URL
- Use production-grade MongoDB (MongoDB Atlas)

---

## Support

### Documentation
- README.md - Overview and features
- IMPROVEMENTS.md - Technical details of all fixes
- API_DOCUMENTATION.md - Complete API reference

### Need Help?
1. Check terminal logs for errors
2. Review documentation
3. Open an issue with:
   - Error message
   - Steps to reproduce
   - System info (OS, Python version, Node version)

---

## Next Steps

✅ System is now ready to use!

Try different interview scenarios:
- Easy technical interview (5 min)
- Medium behavioral interview (10 min)
- Hard technical interview (15 min)
- Full interview with all types (20 min)

Check that:
- Questions don't repeat ✓
- Difficulty matches your selection ✓
- Question count is appropriate for duration ✓
- Reports are generated correctly ✓
- Scores and grades are displayed ✓

---

**Version**: 2.0.0  
**Status**: Production Ready ✅  
**Last Updated**: March 2026
