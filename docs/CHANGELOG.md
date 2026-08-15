# Changelog

## [2.0.0] - 2025-07-21

### Changed
- Switched LLM from OpenRouter to Groq API (llama-3.3-70b) — free, fast, reliable
- Gemini 2.0 Flash used as fallback and for multimodal extraction
- Embeddings via Gemini Embedding API (gemini-embedding-2-preview)
- Vercel deployment architecture (api/index.ts serverless handler)
- Firebase config moved to VITE_ environment variables

### Added
- Local PDF extraction with pdf-parse (no AI cost for PDFs)
- Groq as primary LLM with automatic Gemini fallback
- Personalized greeting (Good morning/afternoon/evening)
- Both sidebars closed by default on login
- Fresh new chat opened on every login
- Image-only chat bar attachment
- File type restrictions: sidebar for docs/video, chat bar for images
- Smart file size limits: 15MB docs, 25MB video, 10MB images
- System self-knowledge: GroundLink knows what it is and how to use it

## [1.0.0] - 2025-07-19

Initial release with OpenRouter.
