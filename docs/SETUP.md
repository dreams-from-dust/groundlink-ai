# Setup Guide

Complete instructions for running GroundLink AI locally and deploying to Vercel.

---

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- A Firebase project (free Spark plan works)
- An OpenRouter account and API key

---

## 1. Firebase Setup

### Create the project

1. Go to firebase.google.com and create a new project
2. Disable Google Analytics (not needed)

### Enable Authentication

1. Firebase Console > Authentication > Get started
2. Enable **Email/Password** provider
3. Enable **Google** provider
4. Under Settings > Authorized Domains, add `localhost`

### Create Firestore Database

1. Firebase Console > Firestore Database > Create database
2. Choose a region close to your users
3. Start in **production mode**
4. Note the database ID (shown in the URL, or set to `(default)`)

### Get your web app config

1. Firebase Console > Project Settings > Your Apps > Add app > Web
2. Register the app with any nickname
3. Copy the config object values (apiKey, authDomain, projectId, etc.)

### Get your service account key (for production Vercel deploy)

1. Firebase Console > Project Settings > Service Accounts
2. Click **Generate new private key**
3. Save the downloaded JSON file securely (never commit it)

---

## 2. OpenRouter Setup

1. Go to openrouter.ai and create an account
2. Navigate to Keys > Create Key
3. Copy the key (starts with `sk-or-v1-`)
4. Add credits to your account (a few dollars is enough to start)

The app uses these models via OpenRouter:

- `openai/text-embedding-3-small` for embeddings
- `google/gemini-2.5-flash` as primary LLM
- `openai/gpt-4o-mini` as first fallback
- `meta-llama/llama-3-8b-instruct:free` as free fallback

---

## 3. Local Development

### Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/groundlink-ai.git
cd groundlink-ai
npm install
```

### Create your environment file

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
APP_URL=http://localhost:5173

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_FIRESTORE_DATABASE_ID=your-database-id

VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:abc123
VITE_FIREBASE_FIRESTORE_DATABASE_ID=your-database-id
```

### Run

```bash
npm run dev
```

This starts two processes concurrently:

- API server on `http://localhost:3000`
- Vite dev server on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

### Local note on Firestore persistence

Without `FIREBASE_SERVICE_ACCOUNT_JSON` set, the server runs in in-memory mode. Documents you upload persist only for the current server session. This is normal for local development. Set the service account key to enable full Firestore persistence locally.

---

## 4. Deploy to Vercel

### Push to GitHub first

```bash
git init
git add .
git commit -m "feat: initial GroundLink AI release"
git remote add origin https://github.com/YOUR_USERNAME/groundlink-ai.git
git branch -M main
git push -u origin main
```

### Import to Vercel

1. Go to vercel.com > New Project
2. Import your GitHub repository
3. Vercel detects `vercel.json` automatically
4. Do not change any build settings

### Set environment variables

In Vercel > Project > Settings > Environment Variables, add all of the following:

| Variable | Value |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter key |
| `APP_URL` | `https://your-app.vercel.app` |
| `NODE_ENV` | `production` |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `FIREBASE_FIRESTORE_DATABASE_ID` | Your Firestore database ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full contents of the service account JSON file |
| `VITE_FIREBASE_API_KEY` | From Firebase web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | From Firebase web app config |
| `VITE_FIREBASE_PROJECT_ID` | From Firebase web app config |
| `VITE_FIREBASE_STORAGE_BUCKET` | From Firebase web app config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase web app config |
| `VITE_FIREBASE_APP_ID` | From Firebase web app config |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Your Firestore database ID |

For `FIREBASE_SERVICE_ACCOUNT_JSON`, open the downloaded service account JSON file, select all contents, and paste it as a single value into Vercel. Vercel handles multiline JSON values correctly.

### Deploy

Click Deploy. After the first deploy completes:

1. Copy your Vercel URL (e.g. `groundlink-ai.vercel.app`)
2. Go to Firebase Console > Authentication > Settings > Authorized Domains
3. Add your Vercel URL

### Redeploy after adding env vars

If you added environment variables after the initial deploy, trigger a redeploy:

Vercel > Deployments > three dots on latest deploy > Redeploy

---

## 5. Firebase Email Branding

By default, Firebase sends verification and password reset emails with your project ID as the sender name. To change this to GroundLink AI:

1. Firebase Console > Authentication > Email Templates
2. Click each template (Email Verification, Password Reset, Email Change)
3. Set Sender name to `GroundLink AI`
4. Optionally set a custom Reply-to email address
5. Save each template

---

## 6. Firestore Security Rules

Deploy the included `firestore.rules` file to your Firebase project:

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules
```

The rules enforce that each user can only read and write their own data under `/users/{uid}/`.
