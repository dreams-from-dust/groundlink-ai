# GroundLink AI

> A full-stack Retrieval-Augmented Generation (RAG) platform. Upload any document, ask questions, and get answers grounded strictly in your files — with clickable inline citations tracing every response back to its exact source.

---

## What It Does

Most AI chat tools hallucinate or lose context with large documents. GroundLink solves this by:

1. Parsing your uploaded files into overlapping text chunks server-side
2. Converting every chunk into a 1536-dimensional vector embedding
3. When you ask a question, finding the most semantically similar chunks via cosine similarity
4. Passing only those matched chunks as grounded context to the LLM
5. Returning an answer that cites exactly which source passages it used — click any `[1]` citation to see the original text

Zero hallucination. Every claim is traceable.

---

## Features

- **Multi-format ingestion** — PDF, DOCX, PPTX, TXT, MD, images (PNG/JPG/WEBP), video (MP4)
- **Semantic vector search** — 1536-dim embeddings via `text-embedding-3-small`, cosine similarity with keyword fallback
- **Grounded LLM answers** — inline citations `[1]`, `[2]` with source preview sidebar
- **Multi-model fallback** — Gemini 2.5 Flash → GPT-4o-mini → Llama 3 (automatic on failure)
- **Firebase Auth** — email/password + Google Sign-In, per-user Firestore vector isolation
- **Voice input** — Web Speech API for hands-free querying
- **Custom system prompts** — configure tone, language, or AI persona
- **Dark / Light theme** — full theme switcher with persistent preference
- **Sample corpus** — built-in AI/ML knowledge base to demo without uploads

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4 |
| Animation | motion/react (AnimatePresence, spring transitions) |
| Backend | Express.js (TypeScript) → Vercel Serverless Function |
| Auth | Firebase Authentication (email + Google OAuth) |
| Database | Firestore (per-user document + chunk storage) |
| LLM / Embeddings | OpenRouter API (Gemini 2.5 Flash, GPT-4o-mini, Llama 3) |
| Vector Search | In-memory cosine similarity (1536-dim, per-user cache) |
| Deployment | Vercel (SPA static + serverless API) |

---

## How RAG Works Here

```
Upload File
    │
    ▼
Text Extraction (OpenRouter multimodal for PDF/DOCX/images/video)
    │
    ▼
Chunking (800 chars, 150 char overlap, sentence-aware)
    │
    ▼
Embedding (text-embedding-3-small → 1536-dim vectors)
    │
    ▼
Firestore Storage (per-user collection: /users/{uid}/chunks)
    │
User asks a question
    │
    ▼
Query Embedding → Cosine Similarity vs all user chunks
    │
    ▼
Top-5 matches (score ≥ 0.25) → Keyword fallback if needed
    │
    ▼
LLM call with grounded context → Response with [1][2] citations
```

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/groundlink-ai.git
cd groundlink-ai

# 2. Install
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local and add your OPENROUTER_API_KEY

# 4. Run
npm run dev
# → http://localhost:5173/
```

---

## Security

- API key is server-side only — never exposed to the browser
- Every API route requires Firebase JWT verification
- Firestore rules enforce per-user data isolation (`isOwner` pattern)
- Sliding-window rate limiting on all write endpoints
- Custom security headers (CSP, HSTS, X-Content-Type-Options)
- CORS allowlist driven by `APP_URL` env var

---

## License

MIT
