# Architecture

GroundLink AI is a full stack RAG application. The frontend is a React SPA served as static output by Vercel. The backend is a single Express.js server compiled into a Vercel serverless function. All vector search and LLM calls happen server side.

---

## System Overview

```
Browser (React SPA)
       |
       | Firebase Auth JWT (every request)
       v
Vercel Serverless Function (api/index.ts)
       |
       |-- OpenRouter API (embeddings + LLM)
       |-- Firestore (chunk + document persistence)
       |-- In-memory cache (per warm instance)
```

---

## RAG Pipeline

### Ingestion

```
File Upload (base64)
       |
       v
Text Extraction
  Plain text / Markdown    direct decode
  PDF / DOCX / PPTX        OpenRouter multimodal LLM extracts text
  Images (PNG/JPG/WEBP)    OpenRouter vision describes content
  Video (MP4)              OpenRouter transcribes audio + describes frames
       |
       v
Sentence-aware Chunker
  Chunk size    800 characters
  Overlap       150 characters
  Splits on     sentence endings (.!?) and paragraph breaks
       |
       v
Batch Embedding (50 chunks per request)
  Model         openai/text-embedding-3-small via OpenRouter
  Dimensions    1536
       |
       v
Storage
  In-memory     userChunksCache (Map, per process)
  Firestore     /users/{uid}/chunks/{chunkId}
```

### Retrieval and Generation

```
User Query
       |
       v
Query Embedding (same model, 1536-dim)
       |
       v
Cosine Similarity vs all user chunks
  Formula       dot(a,b) / (|a| * |b|)
  Threshold     score >= 0.25
  Top K         5 chunks returned
       |
       v  (fallback if no vector matches)
Keyword Search
  Tokenize query, count term matches per chunk, score by density
       |
       v
Context Assembly
  Retrieved chunks numbered [1] through [5]
  Injected into LLM system prompt as grounded context blocks
       |
       v
LLM Generation with Fallback Chain
  1. google/gemini-2.5-flash
  2. openai/gpt-4o-mini
  3. meta-llama/llama-3-8b-instruct:free
       |
       v
Response with inline citations [1] [2] [3]
  Client renders each as a clickable badge
  Click opens source passage in the Grounding sidebar
```

---

## File Structure

```
groundlink-ai/
  api/
    index.ts              Single Express app exported as Vercel handler
  src/
    App.tsx               Full React SPA (4000+ lines)
    firebase.ts           Firebase client SDK init from env vars
    main.tsx              React entry point
    index.css             Global styles and Tailwind directives
    assets/images/        Logo SVG, PNG, JPG, icon SVG
  public/
    terms.html            Terms of service page
    privacy.html          Privacy policy page
  docs/                   This documentation folder
  index.html              Vite HTML entry point
  vite.config.ts          Vite config with /api proxy for local dev
  vercel.json             Routes /api/* to serverless, /* to static dist
  dev-server.ts           Local dev wrapper, starts Express on port 3000
  package.json
  tsconfig.json
  firestore.rules         Firestore security rules
  .env.example            Environment variable template
```

---

## Authentication Flow

1. User signs in via Firebase Auth (email/password or Google OAuth)
2. Firebase returns a signed JWT (ID token)
3. React client sends the token as `Authorization: Bearer <token>` on every API request
4. Server calls `getAuth().verifyIdToken(token)` to validate and extract `uid`
5. All Firestore reads and writes are scoped to that `uid`

In local development without `FIREBASE_SERVICE_ACCOUNT_JSON`, the server decodes the JWT payload without cryptographic verification and trusts the `uid` claim directly. This is safe for local dev only.

---

## Rate Limiting

All write endpoints use a sliding window in-memory rate limiter keyed by IP address.

| Endpoint | Limit |
|---|---|
| /api/query | 30 requests per minute |
| /api/documents/upload | 10 requests per minute |
| /api/documents/load-sample | 5 requests per minute |

---

## Security Headers

Every response includes:

- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy` restricting script, style, image, and connect sources

API responses additionally include `Cache-Control: no-store` to prevent caching of authenticated data.
