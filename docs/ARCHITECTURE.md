# Architecture

GroundLink AI is a full-stack RAG application. The frontend is a React SPA served as static output by Vercel. The backend is a single Express.js server compiled into a Vercel serverless function. All vector search, LLM calls, and file parsing happen server-side.

---

## System Overview

```
Browser (React 19 SPA)
       |
       | Firebase Auth JWT on every request
       v
Vercel Serverless Function (api/index.ts)
       |
       |-- Groq API           (openai/gpt-oss-120b, chat generation)
       |-- Jina AI          (jina-embeddings-v3, vector embeddings)
       |-- Firestore          (chunk and chat persistence)
       |-- pdf-parse          (local PDF text extraction, no API cost)
       |-- mammoth            (local DOCX/DOC text extraction, no API cost)
       |-- JSZip              (local PPTX text extraction, no API cost)
       |-- xlsx (SheetJS)     (local XLSX/CSV text extraction, no API cost)
```

---

## RAG Pipeline

### Ingestion

```
File Upload (base64)
       |
       v
Text Extraction (all local, zero external API calls)
  Plain text / Markdown    direct UTF-8 decode
  PDF                      pdf-parse
  DOCX / DOC               mammoth / word-extractor
  PPTX                     JSZip raw slide XML parsing
  XLSX / XLS / CSV         xlsx (SheetJS)
       |
       v
Sentence-aware Chunker
  Chunk size    800 characters
  Overlap       150 characters
  Splits on     sentence endings and paragraph breaks
       |
       v
Batch Embedding
  Model         Jina AI (jina-embeddings-v3, input_type: document)
  Batch size    50 chunks per request
       |
       v
Storage
  In-memory     userChunksCache (Map, per warm server instance)
  Firestore     /users/{uid}/chunks/{chunkId}
```

### Retrieval and Generation

```
User query
       |
       v
Query Embedding (Jina AI, input_type: query)
       |
       v
Cosine Similarity vs all user chunks
  Threshold     score >= 0.25
  Top K         5 chunks
       |
       v  (keyword fallback if no vector matches)
Term frequency scoring across all chunks
       |
       v
Context Assembly
  Chunks numbered [1] through [5]
  Injected into system prompt as grounded context
       |
       v
LLM Generation
  Primary       Groq (openai/gpt-oss-120b) - fast, free tier
  Fallback      Local heuristic generator (no API key required)
       |
       v
Response with inline citations [1] [2]
  Click any badge to open source passage in Grounding sidebar
```

---

## File Structure

```
groundlink-ai/
  api/
    index.ts              Vercel serverless function - all Express routes
  src/
    App.tsx               Full React SPA (auth, chat, sidebars, citations)
    firebase.ts           Firebase client SDK init from VITE_ env vars
    main.tsx              React entry point
    index.css             Global styles and Tailwind directives
    assets/images/        Logo SVG, PNG, JPG, icon SVG
  public/
    terms.html
    privacy.html
  docs/                   This documentation folder
  index.html              Vite HTML entry point
  vite.config.ts          Vite config with /api proxy for local dev
  vercel.json             Routes /api/* to serverless, /* to static dist
  dev-server.ts           Local dev wrapper - starts Express on port 3000
  package.json
  tsconfig.json
  firestore.rules
  .env.example
```

---

## Authentication Flow

1. User signs in via Firebase Auth (email/password or Google OAuth)
2. Firebase returns a signed JWT ID token
3. React client sends token as Authorization: Bearer on every API request
4. Server calls Firebase Admin verifyIdToken to validate and extract uid
5. All Firestore reads and writes are scoped to that uid

In local development without FIREBASE_SERVICE_ACCOUNT_JSON, the server decodes the JWT payload without cryptographic verification. Safe for local dev only.

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
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy restricting script, style, image, and connect sources
- Cache-Control: no-store on all /api/ responses
