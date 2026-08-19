# Setup Guide

Complete instructions for running GroundLink AI locally and deploying to Vercel.

---

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- A Groq account (free at console.groq.com)
- A Jina AI account (free at jina.ai)
- A Firebase project

---

## 1. Get Your Free API Keys

### Groq API (required - chat generation)

1. Go to console.groq.com
2. Sign up with Google or email (free, no credit card)
3. Go to API Keys in the left sidebar
4. Click Create API Key, give it a name
5. Copy the key - it starts with gsk_
6. Free tier: generous daily request limits on openai/gpt-oss-120b

### Jina AI (required - document embeddings)

1. Go to jina.ai
2. Sign up (free, no credit card)
3. Open the API Keys section of the dashboard
4. Click Create Key
5. Copy the key - it starts with jina_
6. Free tier: 1 million tokens on signup, monthly allowance

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
GROQ_API_KEY=
JINA_API_KEY=
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

Note: the app works even without either key configured. Without GROQ_API_KEY it falls back to a local heuristic answer generator. Without JINA_API_KEY it falls back to a local heuristic embedding for document search. Both keys are recommended for full quality.

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
| GROQ_API_KEY | |
| JINA_API_KEY | |
| APP_URL | |
| NODE_ENV | production |
| FIREBASE_PROJECT_ID | |
| FIREBASE_FIRESTORE_DATABASE_ID | |
| FIREBASE_SERVICE_ACCOUNT_JSON | |
| VITE_FIREBASE_API_KEY | |
| VITE_FIREBASE_AUTH_DOMAIN | |
| VITE_FIREBASE_PROJECT_ID | |
| VITE_FIREBASE_STORAGE_BUCKET | |
| VITE_FIREBASE_MESSAGING_SENDER_ID | |
| VITE_FIREBASE_APP_ID | |
| VITE_FIREBASE_FIRESTORE_DATABASE_ID | |

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
