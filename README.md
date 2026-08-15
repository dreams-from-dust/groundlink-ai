# GroundLink AI

A full-stack Retrieval-Augmented Generation (RAG) platform. Upload any document, ask questions, and get answers grounded strictly in your files with clickable inline citations tracing every response back to its exact source.

**Live Demo:** [groundlink-ai.vercel.app](https://groundlink-ai.vercel.app)

---

## What It Does

Most AI tools hallucinate or lose context with large documents. GroundLink solves this by:

1. Parsing uploaded files into overlapping text chunks server-side
2. Converting every chunk into a vector embedding via Gemini Embedding API
3. Finding the most semantically similar chunks via cosine similarity when you ask a question
4. Passing only matched chunks as grounded context to the LLM
5. Returning an answer with clickable inline citations linking to exact source passages

Zero hallucination. Every claim is traceable.

---

## Features

- Multi-format ingestion: PDF, DOCX, PPTX, TXT, MD, images, video
- Semantic vector search with cosine similarity and keyword fallback
- Grounded LLM answers with inline citations and source preview sidebar
- Groq LLM (llama-3.3-70b) as primary with Gemini as fallback
- Firebase Authentication with email/password and Google Sign-In
- Voice input via Web Speech API
- Custom system prompts
- Dark and light theme
- Built-in sample corpus of AI/ML documents

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool |
| Tailwind CSS v4 | Styling |
| motion/react | Animations |
| react-markdown | Markdown rendering |
| lucide-react | Icons |
| Web Speech API | Voice input |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js (TypeScript) | API server |
| Vercel Serverless | Production deployment |
| tsx | Local TypeScript execution |

### AI
| Technology | Purpose |
|---|---|
| Groq API (llama-3.3-70b) | Primary LLM, text generation |
| Google Gemini 2.0 Flash | Fallback LLM, multimodal extraction |
| Gemini Embedding API | Vector embeddings for RAG |
| pdf-parse | Local PDF text extraction |

### Auth and Database
| Technology | Purpose |
|---|---|
| Firebase Authentication | Email/password and Google OAuth |
| Firestore | Per-user chunk and chat storage |
| Firebase Admin SDK | Server-side JWT verification |

### DevOps
| Technology | Purpose |
|---|---|
| Vercel | Hosting (static SPA + serverless API) |
| GitHub | Version control and auto-deploy |
| concurrently | Local dev parallel processes |

---

## How RAG Works Here

```
Upload File
    |
    v
Text Extraction (pdf-parse for PDFs, Gemini multimodal for images/video)
    |
    v
Chunking (800 chars, 150 char overlap, sentence-aware)
    |
    v
Embedding (Gemini Embedding API)
    |
    v
Firestore Storage (/users/{uid}/chunks)
    |
User asks a question
    |
    v
Query Embedding -> Cosine Similarity vs all user chunks
    |
    v
Top-5 matches (score >= 0.25) -> Keyword fallback if needed
    |
    v
Groq LLM with grounded context -> Response with [1][2] citations
```

---

## Local Development

```bash
git clone https://github.com/dreams-from-dust/groundlink-ai.git
cd groundlink-ai
npm install
cp .env.example .env.local
# Fill in GEMINI_API_KEY and GROQ_API_KEY in .env.local
npm run dev
# UI: http://localhost:5173
```

---

## Getting Free API Keys

**Gemini API (required for embeddings):**
1. Go to aistudio.google.com/apikey
2. Click Create API Key
3. Select your Google project
4. Copy the key starting with AIzaSy

**Groq API (required for LLM):**
1. Go to console.groq.com
2. Create a free account
3. API Keys -> Create API Key
4. Copy the key starting with gsk_

Both are completely free with generous daily limits.

---

## Deploy to Vercel

```bash
git add .
git commit -m "feat: GroundLink AI"
git push origin main
```

Then in Vercel dashboard add these environment variables:

| Variable | Value |
|---|---|
| GEMINI_API_KEY | Your Gemini key |
| GROQ_API_KEY | Your Groq key |
| APP_URL | https://your-app.vercel.app |
| FIREBASE_PROJECT_ID | gen-lang-client-0019255293 |
| FIREBASE_FIRESTORE_DATABASE_ID | ai-studio-ragexplorer-... |
| FIREBASE_SERVICE_ACCOUNT_JSON | Full JSON from Firebase service account |
| VITE_FIREBASE_API_KEY | AIzaSyC5... |
| VITE_FIREBASE_AUTH_DOMAIN | gen-lang-client-....firebaseapp.com |
| VITE_FIREBASE_PROJECT_ID | gen-lang-client-0019255293 |
| VITE_FIREBASE_STORAGE_BUCKET | gen-lang-client-....firebasestorage.app |
| VITE_FIREBASE_MESSAGING_SENDER_ID | 28710994938 |
| VITE_FIREBASE_APP_ID | 1:28710994938:web:... |
| VITE_FIREBASE_FIRESTORE_DATABASE_ID | ai-studio-ragexplorer-... |
| NODE_ENV | production |

After deploy, add your Vercel URL to Firebase Console -> Authentication -> Authorized Domains.

---

## Security

- API keys are server-side only, never in browser bundle
- Every route requires Firebase JWT verification
- Firestore rules enforce per-user data isolation
- Rate limiting on all write endpoints
- CORS allowlist driven by APP_URL env var

---

## License

MIT
