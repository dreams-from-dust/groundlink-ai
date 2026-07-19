# Changelog

All notable changes to GroundLink AI are documented here.

Format follows Keep a Changelog. Versions follow Semantic Versioning.

---

## [1.0.0] - 2025-07-19

Initial public release.

### Added

**Core RAG Engine**
- Sentence-aware text chunker with configurable chunk size (default 800 chars) and overlap (default 150 chars)
- OpenRouter embedding pipeline using `openai/text-embedding-3-small` (1536 dimensions)
- Cosine similarity vector search with keyword fallback for zero-match queries
- Top-5 chunk retrieval with minimum score threshold of 0.25
- Per-user vector store with Firestore persistence and in-memory cache layer

**LLM Integration**
- Primary model: `google/gemini-2.5-flash`
- Automatic fallback chain to `openai/gpt-4o-mini` then `meta-llama/llama-3-8b-instruct:free`
- 402 credit error detection with automatic max_tokens reduction and retry
- Configurable temperature per query

**File Ingestion**
- Plain text and Markdown: direct UTF-8 decode
- PDF, DOCX, PPTX: OpenRouter multimodal text extraction
- Images (PNG, JPG, WEBP, GIF): OpenRouter vision description
- Video (MP4, WebM, MOV, AVI, MKV): OpenRouter transcription and frame description
- Built-in sample corpus with 7 AI/ML reference documents

**Citation System**
- Inline citations [1] [2] rendered as clickable cyan badges
- Multi-citation expansion: [1, 2] automatically split into [1] [2]
- Click any citation to open the exact source passage in the Grounding sidebar
- Source document title and similarity score displayed per citation

**Authentication**
- Firebase Auth with email/password and Google OAuth
- Branded email verification via ActionCodeSettings pointing back to the app
- Branded password reset emails
- Per-user data isolation in Firestore

**Security**
- Firebase JWT verification on every API route
- Sliding window rate limiting: 30/min query, 10/min upload, 5/min sample load
- CORS allowlist driven by APP_URL environment variable
- Security headers: CSP, HSTS, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- API key server-side only, never exposed to browser bundle

**UI**
- React 19 SPA with Vite and TypeScript
- Tailwind CSS v4 with full dark and light theme
- Animated sidebar with recent chat history
- Right sidebar with Grounding tab (source passage inspector) and Settings tab
- Voice input via Web Speech API
- Image attachment support per message
- File attachment support per message
- Chat export as plain text or markdown
- Custom system instruction input in settings

**Deployment**
- Vercel serverless function wrapping the Express app (`api/index.ts`)
- Vite builds the SPA to `dist/` as static output
- `vercel.json` routes all `/api/*` to the function and serves static files for everything else
- Local dev with `concurrently` running API (port 3000) and Vite (port 5173) in parallel
- `/api` proxy in Vite config for seamless local development

---

## Upcoming

- Firestore vector persistence for cold-start recovery without client re-upload
- PDF page-level citation highlighting
- Document collection sharing between users
- Custom embedding model selection
- Export conversation with citations as PDF
