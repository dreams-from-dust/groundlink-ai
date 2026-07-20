# GroundLink AI

> A full-stack Retrieval-Augmented Generation (RAG) platform. Upload any document, ask questions, and get answers grounded strictly in your files with clickable inline citations tracing every response back to its exact source.

**Live Demo:** [groundlink-ai.vercel.app](https://groundlink-ai.vercel.app)

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

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type-safe development |
| Vite | Build tool and dev server |
| Tailwind CSS v4 | Styling |
| motion/react | Animations and transitions |
| react-markdown + remark-gfm | Markdown rendering with GFM support |
| lucide-react | Icon library |
| Web Speech API | Voice input |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js (TypeScript) | HTTP server and API routing |
| Vercel Serverless Function | Production deployment target |
| tsx | TypeScript execution locally without compile step |
| dotenv | Environment variable loading |

### AI and LLM
| Technology | Purpose |
|---|---|
| OpenRouter API | Unified LLM and embedding gateway |
| Gemini 2.5 Flash | Primary language model |
| GPT-4o-mini | First fallback model |
| Llama 3 8B Instruct | Free tier fallback model |
| text-embedding-3-small | Vector embeddings (1536 dimensions) |
| @google/genai | Google AI SDK |

### RAG Pipeline
| Component | Detail |
|---|---|
| Text chunker | Sentence-aware, 800 char chunks, 150 char overlap |
| Batch embedding | 50 chunks per API request |
| Vector search | Cosine similarity, custom implementation |
| Retrieval | Top-5 chunks, minimum score threshold 0.25 |
| Keyword fallback | Term frequency scoring when vector scores are low |
| File extraction | PDF, DOCX, PPTX via OpenRouter multimodal; images via vision; video via transcription |

### Auth and Database
| Technology | Purpose |
|---|---|
| Firebase Authentication | Email/password and Google OAuth sign-in |
| Firebase Admin SDK | Server-side JWT token verification |
| Firestore | Per-user document, chunk, and chat persistence |
| Collections | `/users/{uid}/chunks`, `/users/{uid}/chats`, `/users/{uid}/documents` |

### Security
| Layer | Implementation |
|---|---|
| Auth middleware | Firebase JWT verification on every API route |
| Rate limiting | Custom sliding-window, in-memory, keyed by IP |
| CORS | Allowlist driven by APP_URL environment variable |
| Security headers | CSP, HSTS, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy |
| API key isolation | Server-side only, never exposed to browser bundle |
| Data isolation | Firestore rules enforce per-user access |

### DevOps and Tooling
| Technology | Purpose |
|---|---|
| Vercel | Hosting (SPA static output + serverless API) |
| GitHub | Version control and auto-deploy trigger |
| concurrently | Runs API server and Vite in parallel locally |
| esbuild | Bundling |
| sharp | Image processing |

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
Top-5 matches (score >= 0.25) → Keyword fallback if needed
    │
    ▼
LLM call with grounded context → Response with [1][2] citations
```

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/dreams-from-dust/groundlink-ai.git
cd groundlink-ai

# 2. Install
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local and add your keys

# 4. Run
npm run dev
# → http://localhost:5173/
```

---

## Security

- API key is server-side only, never exposed to the browser
- Every API route requires Firebase JWT verification
- Firestore rules enforce per-user data isolation
- Sliding-window rate limiting on all write endpoints
- Custom security headers (CSP, HSTS, X-Content-Type-Options)
- CORS allowlist driven by APP_URL env var

---

## License

MIT