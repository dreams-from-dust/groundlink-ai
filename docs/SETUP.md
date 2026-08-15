# Setup Guide

Complete instructions for running GroundLink AI locally and deploying to Vercel.

---

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- A Google account (for Gemini API and Firebase)
- A Groq account (free at console.groq.com)

---

## 1. Get Your Free API Keys

### Gemini API (required — embeddings and multimodal extraction)

1. Go to aistudio.google.com/apikey
2. Click Create API Key
3. Select your existing Google project (gen-lang-client-0019255293)
4. Copy the key — it starts with AIzaSy
5. Free tier: 1500 requests per day, 15 per minute

### Groq API (required — primary LLM)

1. Go to console.groq.com
2. Sign up with Google or email (free, no credit card)
3. Go to API Keys in the left sidebar
4. Click Create API Key, give it a name
5. Copy the key — it starts with gsk_
6. Free tier: 14,400 requests per day on llama-3.3-70b

### Firebase (already configured for this project)

The Firebase project (gen-lang-client-0019255293) is already set up. You do not need to create a new one. If you fork this project for your own use, create a new Firebase project and replace all VITE_FIREBASE_ values.

---

## 2. Local Development

### Clone and install

```bash
git clone https://github.com/dreams-from-dust/groundlink-ai.git
cd groundlink-ai
npm install
```

### Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your keys:

```env
GEMINI_API_KEY=AIzaSy-your-gemini-key-here
GROQ_API_KEY=gsk_your-groq-key-here
APP_URL=http://localhost:5173
NODE_ENV=development
```

The VITE_FIREBASE_ values are already pre-filled for the existing project.

### Run

```bash
npm run dev
```

This starts two processes in parallel:
- API server on http://localhost:3000
- Vite dev server on http://localhost:5173

Open http://localhost:5173 in your browser.

---

## 3. Deploy to Vercel

### Push to GitHub

```bash
git add .
git commit -m "feat: GroundLink AI initial release"
git remote add origin https://github.com/YOUR_USERNAME/groundlink-ai.git
git branch -M main
git push -u origin main
```

### Import to Vercel

1. Go to vercel.com and click New Project
2. Import your GitHub repository
3. Vercel detects vercel.json automatically
4. Do not change any build settings

### Add environment variables

In Vercel dashboard, go to your project, then Settings, then Environment Variables. Add all of the following:

| Variable | Value |
|---|---|
| GEMINI_API_KEY | Your Gemini key from aistudio.google.com/apikey |
| GROQ_API_KEY | Your Groq key from console.groq.com |
| APP_URL | https://your-app.vercel.app |
| NODE_ENV | production |
| FIREBASE_PROJECT_ID | gen-lang-client-0019255293 |
| FIREBASE_FIRESTORE_DATABASE_ID | ai-studio-ragexplorer-c25d6bd6-b09f-4e1a-b772-6f1d3a3aca3c |
| FIREBASE_SERVICE_ACCOUNT_JSON | Full JSON contents of Firebase service account key |
| VITE_FIREBASE_API_KEY | AIzaSyC5Fk7DpeaFE-eG9v-uIY8Q51mjNWnw-pk |
| VITE_FIREBASE_AUTH_DOMAIN | gen-lang-client-0019255293.firebaseapp.com |
| VITE_FIREBASE_PROJECT_ID | gen-lang-client-0019255293 |
| VITE_FIREBASE_STORAGE_BUCKET | gen-lang-client-0019255293.firebasestorage.app |
| VITE_FIREBASE_MESSAGING_SENDER_ID | 28710994938 |
| VITE_FIREBASE_APP_ID | 1:28710994938:web:e9570cf2cf1ade2e68da43 |
| VITE_FIREBASE_FIRESTORE_DATABASE_ID | ai-studio-ragexplorer-c25d6bd6-b09f-4e1a-b772-6f1d3a3aca3c |

### Get the Firebase Service Account JSON

1. Firebase Console, your project, gear icon, Project Settings
2. Service Accounts tab
3. Click Generate new private key
4. Download the JSON file
5. Open it, copy the entire contents, paste as the value of FIREBASE_SERVICE_ACCOUNT_JSON

### After deploying

1. Copy your Vercel URL (e.g. groundlink-ai.vercel.app)
2. Firebase Console, Authentication, Settings, Authorized Domains
3. Add your Vercel URL

---

## 4. Firebase Email Branding

By default Firebase sends emails from your project ID. To show GroundLink AI:

1. Firebase Console, Authentication, Email Templates
2. Edit each template (Verification, Password Reset)
3. Set Sender name to GroundLink AI
4. Save each template

---

## 5. Firestore Security Rules

Deploy the included firestore.rules:

```bash
npm install -g firebase-tools
firebase login
firebase use gen-lang-client-0019255293
firebase deploy --only firestore:rules
```
