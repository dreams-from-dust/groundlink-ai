# API Reference

All endpoints are served from `/api/*` and require a valid Firebase Auth ID token passed as a Bearer token in the Authorization header.

```
Authorization: Bearer <firebase-id-token>
```

Base URL in local development: `http://localhost:3000`
Base URL in production: `https://your-app.vercel.app`

---

## Authentication

Every request must include the Firebase ID token obtained from the client SDK after sign-in.

```typescript
const token = await auth.currentUser.getIdToken();

fetch('/api/stats', {
  headers: { Authorization: `Bearer ${token}` }
});
```

Requests without a valid token return:

```json
{ "error": "Unauthorized: Missing bearer token" }
```

Invalid tokens return:

```json
{ "error": "Unauthorized: Invalid token", "code": "auth/invalid-token" }
```

---

## GET /api/stats

Returns the current user's document and chunk counts.

**Response**

```json
{
  "totalChunks": 142,
  "totalDocs": 7,
  "documents": [
    { "title": "Machine Learning Fundamentals", "chunkCount": 23 },
    { "title": "RAG Architecture Guide", "chunkCount": 18 }
  ],
  "hasApiKey": true
}
```

---

## POST /api/clear

Deletes all chunks and document metadata for the current user.

**Request body**

None required.

**Response**

```json
{ "success": true, "message": "Database vector store cleared." }
```

---

## POST /api/documents/delete

Deletes a single document and all its associated chunks.

**Request body**

```json
{ "docTitle": "Machine Learning Fundamentals" }
```

**Response**

```json
{ "success": true, "message": "Document \"Machine Learning Fundamentals\" deleted." }
```

**Errors**

```json
{ "error": "Missing docTitle parameter" }
```

---

## POST /api/documents/load-sample

Loads the built-in sample corpus (7 AI/ML documents). Clears existing data first.

Rate limited to 5 requests per minute per IP.

**Request body**

```json
{
  "chunkSize": 800,
  "chunkOverlap": 150
}
```

Both fields are optional and default to the values shown.

**Response**

```json
{
  "success": true,
  "count": 142,
  "chunks": [ ... ],
  "docMetas": [
    { "id": "doc-machine-learning-...", "name": "Machine Learning Fundamentals", "chunkCount": 23, "size": 3200 }
  ]
}
```

---

## POST /api/documents/upload

Uploads one or more files, extracts text, chunks, embeds, and stores them.

Rate limited to 10 requests per minute per IP.

**Request body**

```json
{
  "files": [
    {
      "title": "my-document.pdf",
      "base64": "data:application/pdf;base64,JVBERi0x..."
    },
    {
      "title": "notes.txt",
      "text": "Plain text content can be passed directly without base64"
    }
  ],
  "chunkSize": 800,
  "chunkOverlap": 150,
  "append": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `files` | array | Yes | Array of file objects |
| `files[].title` | string | Yes | File name including extension |
| `files[].base64` | string | No | Base64-encoded file content |
| `files[].text` | string | No | Plain text content (alternative to base64) |
| `chunkSize` | number | No | Target chunk size in characters. Default 800 |
| `chunkOverlap` | number | No | Overlap between chunks in characters. Default 150 |
| `append` | boolean | No | If false, clears existing data before upload. Default true |

**Supported file extensions**

| Extension | Processing method |
|---|---|
| `.txt`, `.md` | Direct UTF-8 decode from base64 |
| `.pdf` | OpenRouter multimodal text extraction |
| `.docx`, `.doc` | OpenRouter multimodal text extraction |
| `.pptx`, `.ppt` | OpenRouter multimodal text extraction |
| `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` | OpenRouter vision description |
| `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv` | OpenRouter transcription and frame description |

**Response**

```json
{
  "success": true,
  "count": 38,
  "chunks": [ ... ],
  "docMetas": [
    { "id": "doc-my-document-...", "name": "my-document.pdf", "chunkCount": 38, "size": 24500 }
  ]
}
```

**Errors**

```json
{ "error": "Missing uploaded files array." }
{ "error": "File \"large-file.pdf\" is empty or corrupted." }
{ "error": "Could not parse \"file.docx\". Try a smaller file or paste text as .txt." }
```

---

## POST /api/query

Runs a RAG query against the user's document store and returns a grounded answer.

Rate limited to 30 requests per minute per IP.

**Request body**

```json
{
  "query": "What are the main types of machine learning?",
  "temperature": 0.3,
  "history": [
    { "role": "user", "text": "Tell me about AI" },
    { "role": "assistant", "text": "AI stands for..." }
  ],
  "image": null,
  "customSystemInstruction": "Answer in a formal academic tone.",
  "chatAttachedFiles": [],
  "userChunks": []
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | The user's question |
| `temperature` | number | No | LLM temperature 0 to 1. Default 0.3 |
| `history` | array | No | Last N conversation turns for context. Default empty |
| `image` | string | No | Base64-encoded image to include in the query |
| `customSystemInstruction` | string | No | Additional system prompt instructions |
| `chatAttachedFiles` | array | No | Files attached to this specific message |
| `userChunks` | array | No | Client-side chunks to use instead of fetching from Firestore |

**Response**

```json
{
  "answer": "Machine learning has four main types: Supervised Learning [1], Unsupervised Learning [1], Reinforcement Learning [2], and Semi-supervised Learning [3].",
  "retrieved": [
    {
      "id": "chunk-doc-0-1720000000000",
      "docTitle": "Machine Learning Fundamentals",
      "text": "Types of Machine Learning: 1. Supervised Learning...",
      "embedding": [],
      "score": 0.87
    }
  ],
  "promptUsed": "Retrieved Context from user's global files:\n[1] Source: Machine Learning...",
  "modelUsed": "google/gemini-2.5-flash"
}
```

The `retrieved` array contains the top matched chunks. The `score` field is the cosine similarity value (0 to 1, higher is more similar). Citation numbers in `answer` correspond to indices in the `retrieved` array (1-based).
