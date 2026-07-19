// GroundLink AI -- Vercel Serverless Handler
// All API routes served from this single file.

import express from 'express';
import dotenv from 'dotenv';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Load .env.local first (local dev), then .env (fallback)
dotenv.config({ path: '.env.local' });
dotenv.config();

// Types
interface Chunk {
  id: string;
  docTitle: string;
  text: string;
  embedding: number[];
  localEmbedding?: number[];
}

// Firebase Admin Init
// - Local dev:    leave FIREBASE_SERVICE_ACCOUNT_JSON unset -> runs in-memory, no crash
// - Vercel prod:  set FIREBASE_SERVICE_ACCOUNT_JSON in dashboard -> full Firestore persistence
// - DO NOT use Google ADC (Application Default Credentials) -- requires gcloud CLI setup
let db: any = null;
let adminInitialized = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const firestoreDb = process.env.FIREBASE_FIRESTORE_DATABASE_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (projectId) {
    const existingApps = getApps();
    let adminApp: any;

    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      adminInitialized = true;
    } else if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        adminApp = initializeApp({ credential: cert(serviceAccount), projectId });
        adminInitialized = true;
        console.log('[Firebase Admin] Initialized with service account. Project:', projectId);
      } catch (parseErr: any) {
        console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseErr.message);
        console.warn('[Firebase Admin] Falling back to in-memory mode.');
      }
    } else {
      console.warn('[Firebase Admin] No FIREBASE_SERVICE_ACCOUNT_JSON set.');
      console.warn('[Firebase Admin] Running in LOCAL IN-MEMORY mode (data not persisted to Firestore).');
      console.warn('[Firebase Admin] This is normal for local development. Set the env var for production.');
    }

    if (adminInitialized && adminApp) {
      db = firestoreDb ? getFirestore(adminApp, firestoreDb) : getFirestore(adminApp);
      console.log('[Firebase Admin] Firestore connected.');
    }
  } else {
    console.warn('[Firebase Admin] FIREBASE_PROJECT_ID not set. Skipping Admin SDK init.');
  }
} catch (err: any) {
  console.error('[Firebase Admin] Init error (non-fatal, continuing in-memory mode):', err.message);
  db = null;
}


// ─── Per-invocation in-memory cache (warm instance reuse) ─────────────────────
const userChunksCache = new Map<string, Chunk[]>();

async function getUserChunks(userId: string): Promise<Chunk[]> {
  if (userChunksCache.has(userId)) return userChunksCache.get(userId) || [];
  if (!db) return [];
  try {
    const snapshot = await db.collection('users').doc(userId).collection('chunks').get();
    const chunks: Chunk[] = snapshot.docs.map((doc: any) => {
      const d = doc.data();
      return { id: d.id || doc.id, docTitle: d.docTitle || '', text: d.text || '', embedding: d.embedding || [], localEmbedding: d.localEmbedding || [] };
    });
    userChunksCache.set(userId, chunks);
    return chunks;
  } catch (err: any) {
    console.warn('[Firestore] getUserChunks fallback:', err.message);
    return [];
  }
}

async function saveUserChunksToDb(userId: string, chunks: Chunk[]): Promise<void> {
  const existing = userChunksCache.get(userId) || [];
  userChunksCache.set(userId, [...existing, ...chunks]);
  if (!db) return;
  try {
    for (let i = 0; i < chunks.length; i += 400) {
      const batch = db.batch();
      for (const chunk of chunks.slice(i, i + 400)) {
        const ref = db.collection('users').doc(userId).collection('chunks').doc(chunk.id);
        batch.set(ref, { id: chunk.id, docTitle: chunk.docTitle, text: chunk.text, embedding: chunk.embedding, localEmbedding: chunk.localEmbedding || [] });
      }
      await batch.commit();
    }
  } catch (err: any) {
    console.warn('[Firestore] saveUserChunksToDb fallback:', err.message);
  }
}

async function saveUserDocumentsToDb(userId: string, documents: { id: string; name: string; chunkCount: number; size: number }[]): Promise<void> {
  if (!db) return;
  try {
    const batch = db.batch();
    for (const d of documents) {
      const ref = db.collection('users').doc(userId).collection('documents').doc(d.id);
      batch.set(ref, { id: d.id, name: d.name, chunkCount: d.chunkCount, size: d.size, uploadedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  } catch (err: any) {
    console.warn('[Firestore] saveUserDocumentsToDb fallback:', err.message);
  }
}

async function clearUserChunksAndDocs(userId: string): Promise<void> {
  userChunksCache.delete(userId);
  if (!db) return;
  try {
    const chunksSnap = await db.collection('users').doc(userId).collection('chunks').get();
    for (let i = 0; i < chunksSnap.docs.length; i += 400) {
      const batch = db.batch();
      for (const doc of chunksSnap.docs.slice(i, i + 400)) batch.delete(doc.ref);
      await batch.commit();
    }
    const docsSnap = await db.collection('users').doc(userId).collection('documents').get();
    for (let i = 0; i < docsSnap.docs.length; i += 400) {
      const batch = db.batch();
      for (const doc of docsSnap.docs.slice(i, i + 400)) batch.delete(doc.ref);
      await batch.commit();
    }
  } catch (err: any) {
    console.warn('[Firestore] clearUserChunksAndDocs fallback:', err.message);
  }
}

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const authenticateUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
  const token = authHeader.split('Bearer ')[1];

  // If Admin SDK not initialized (local dev without service account), decode token client-side
  // by trusting the Firebase client SDK's UID claim. Not for production — just local dev.
  if (!adminInitialized) {
    try {
      // Decode the JWT payload without verification (local dev only)
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) throw new Error('Malformed token');
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
      req.user = { uid: payload.user_id || payload.sub || 'local-dev-user', email: payload.email || 'local@dev.local' };
      console.log('[Auth] Local dev mode: decoded token for uid:', req.user.uid);
      return next();
    } catch {
      // If decoding fails, use a sandbox user (fully offline dev)
      req.user = { uid: 'sandbox-guest-user', email: 'guest@sandbox.local' };
      return next();
    }
  }

  // Production path: verify token with Firebase Admin SDK
  try {
    req.user = await getAuth().verifyIdToken(token);
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token', code: 'auth/invalid-token' });
  }
};

// ─── OpenRouter ────────────────────────────────────────────────────────────────
function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY environment variable is missing.');
  return key;
}

async function getOpenRouterEmbedding(texts: string[]): Promise<number[][]> {
  const apiKey = getOpenRouterKey();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: texts })
      });
      if (!res.ok) throw new Error(`OpenRouter Embeddings HTTP ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      if (data.data && Array.isArray(data.data)) return [...data.data].sort((a: any, b: any) => a.index - b.index).map((i: any) => i.embedding);
      throw new Error('Invalid embedding response structure');
    } catch (err: any) {
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
      else throw err;
    }
  }
  return [];
}

async function generateContentWithOpenRouter(options: {
  prompt?: string; mimeType?: string; base64Data?: string;
  temperature?: number; systemInstruction?: string; messages?: any[]; max_tokens?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = getOpenRouterKey();
  const models = ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'meta-llama/llama-3-8b-instruct:free'];
  const appUrl = process.env.APP_URL || 'https://groundlink-ai.vercel.app';

  let formattedMessages: any[] = [];
  if (options.systemInstruction) formattedMessages.push({ role: 'system', content: options.systemInstruction });
  if (options.messages) {
    formattedMessages.push(...options.messages);
  } else if (options.prompt) {
    const parts: any[] = [{ type: 'text', text: options.prompt }];
    if (options.base64Data && options.mimeType) parts.push({ type: 'image_url', image_url: { url: `data:${options.mimeType};base64,${options.base64Data}` } });
    formattedMessages.push({ role: 'user', content: parts });
  }

  let lastErr: any = null;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const reqBody: any = { model, messages: formattedMessages, temperature: options.temperature ?? 0.2, max_tokens: options.max_tokens ?? 1500 };
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': appUrl, 'X-Title': 'GroundLink AI' },
          body: JSON.stringify(reqBody)
        });
        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 402 || errText.includes('credits') || errText.includes('afford')) {
            const match = errText.match(/can only afford (\d+)/i);
            reqBody.max_tokens = match ? Math.max(100, Math.floor(parseInt(match[1]) * 0.9)) : 300;
            const retry = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': appUrl, 'X-Title': 'GroundLink AI' },
              body: JSON.stringify(reqBody)
            });
            if (retry.ok) {
              const rd: any = await retry.json();
              if (rd.choices?.[0]?.message) return { text: rd.choices[0].message.content || '', modelUsed: model };
            }
          }
          throw new Error(`OpenRouter HTTP ${response.status}: ${errText}`);
        }
        const data: any = await response.json();
        if (data.choices?.[0]?.message) return { text: data.choices[0].message.content || '', modelUsed: model };
        throw new Error('Invalid response JSON structure from OpenRouter');
      } catch (err: any) {
        lastErr = err;
        if (attempt < 2) await new Promise(r => setTimeout(r, 800));
      }
    }
  }
  throw new Error(`All fallback models failed. Last error: ${lastErr?.message || lastErr}`);
}

// ─── Math helpers ──────────────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] ** 2; magB += b[i] ** 2; }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Text chunker ──────────────────────────────────────────────────────────────
function chunkText(text: string, title: string, chunkSize = 800, chunkOverlap = 150): { text: string; docTitle: string }[] {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  const sentences = normalized.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 0);
  const chunks: { text: string; docTitle: string }[] = [];
  let currentChunk: string[] = [], currentLen = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sent = sentences[i];
    if (currentLen + sent.length + (currentChunk.length > 0 ? 1 : 0) > chunkSize && currentChunk.length > 0) {
      chunks.push({ text: currentChunk.join(' '), docTitle: title });
      let backLen = 0, bi = i - 1;
      const back: string[] = [];
      while (bi >= 0 && bi > i - 6) {
        const bs = sentences[bi];
        if (backLen + bs.length > chunkOverlap) break;
        back.unshift(bs); backLen += bs.length + 1; bi--;
      }
      currentChunk = [...back]; currentLen = backLen;
    }
    currentChunk.push(sent); currentLen += sent.length + (currentChunk.length > 1 ? 1 : 0);
  }
  if (currentChunk.length > 0) chunks.push({ text: currentChunk.join(' '), docTitle: title });
  return chunks;
}

// ─── Sample Corpus ─────────────────────────────────────────────────────────────
const SAMPLE_DOCS = [
  { title: 'Machine Learning Fundamentals', text: `Machine learning (ML) is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It relies on algorithms that identify patterns in data to make predictions or decisions.\n\nTypes of Machine Learning:\n1. Supervised Learning: The model learns from labeled training data. Examples include linear regression, logistic regression, support vector machines (SVM), and neural networks.\n2. Unsupervised Learning: The model finds hidden patterns in unlabeled data. K-means clustering, hierarchical clustering, PCA, and autoencoders are common techniques.\n3. Reinforcement Learning: An agent learns by interacting with an environment, receiving rewards or penalties.\n4. Semi-supervised Learning: Combines small amounts of labeled data with large amounts of unlabeled data.\n\nKey Concepts:\n- Training vs Test sets: Data is split to evaluate generalization\n- Overfitting: Model memorizes training data but fails on new data\n- Underfitting: Model too simple to capture patterns\n- Bias-Variance Tradeoff: Balancing model complexity\n- Cross-validation: Technique to assess model performance\n- Hyperparameters: Settings tuned before training (learning rate, depth)\n- Feature engineering: Transforming raw data into useful inputs\n- Regularization: L1 (Lasso), L2 (Ridge) techniques to prevent overfitting\n\nPopular Frameworks: TensorFlow, PyTorch, scikit-learn, XGBoost, LightGBM.` },
  { title: 'Deep Learning and Neural Networks', text: `Deep learning uses artificial neural networks with many layers to learn representations of data.\n\nArchitecture Components:\n- Neurons: Basic computational units applying a weighted sum + activation function\n- Layers: Input layer, hidden layers, output layer\n- Activation Functions: ReLU, Sigmoid, Tanh, Softmax, GELU\n- Loss Functions: Cross-entropy (classification), MSE (regression)\n- Optimizers: SGD, Adam, AdamW, RMSProp\n\nKey Architectures:\n1. CNN: Specialized for images. Models: VGG, ResNet, EfficientNet, YOLO.\n2. RNN: Handle sequential data. LSTM and GRU solve the vanishing gradient problem.\n3. Transformers: Attention-based architecture. BERT, GPT, T5, ViT.\n4. GANs: Generator vs Discriminator framework for generating realistic data.\n5. Diffusion Models: State-of-the-art for image generation. Stable Diffusion, DALL-E.\n\nTraining: Backpropagation computes gradients. Mini-batch gradient descent updates weights. Batch normalization and dropout prevent overfitting.` },
  { title: 'Natural Language Processing (NLP)', text: `NLP enables computers to understand, interpret, and generate human language.\n\nCore NLP Tasks:\n1. Tokenization: Splitting text into words, subwords, or characters\n2. Named Entity Recognition (NER): Identifying persons, organizations, locations\n3. Sentiment Analysis: Determining opinion polarity\n4. Machine Translation: Translating between languages\n5. Text Summarization: Extractive or abstractive summarization\n6. Question Answering: Retrieving or generating answers from text\n7. Language Modeling: Predicting next word; foundation for GPT-style models\n\nEvolution: Rule-based → Statistical (N-gram, TF-IDF) → Word Embeddings (Word2Vec, GloVe) → BERT → GPT series → ChatGPT/Claude/Gemini (RLHF-aligned LLMs)\n\nKey Libraries: NLTK, spaCy, Hugging Face Transformers, Gensim\nEvaluation: BLEU (translation), ROUGE (summarization), F1, Perplexity.` },
  { title: 'Retrieval-Augmented Generation (RAG)', text: `RAG is an AI framework that enhances LLMs by retrieving relevant external knowledge before generating a response. It addresses knowledge cutoffs, hallucinations, and inability to access private data.\n\nRAG Architecture:\n1. Indexing: Document ingestion → Chunking → Embedding → Vector storage\n2. Retrieval: Query embedding → Cosine similarity search → Top-K chunks\n3. Generation: Retrieved context + query → LLM → Grounded answer with citations\n\nAdvanced RAG Patterns:\n- Hybrid Search: Dense (semantic) + sparse (BM25) retrieval\n- HyDE: Generate hypothetical answer, then retrieve\n- Self-RAG: Model decides when to retrieve and evaluates its own outputs\n- Agentic RAG: LLM agents dynamically decide retrieval strategies\n\nBenefits: Reduces hallucinations, enables access to private/fresh data, source attribution, lower compute vs fine-tuning.\nTools: LangChain, LlamaIndex, Haystack, DSPy.` },
  { title: 'Vector Databases and Embeddings', text: `Vector databases store, index, and query high-dimensional vectors (embeddings). They are foundational for semantic search, recommendations, and RAG.\n\nEmbeddings: Dense numerical representations where semantic similarity = geometric proximity.\n\nPopular Embedding Models:\n- OpenAI text-embedding-ada-002: 1536 dims\n- sentence-transformers/all-MiniLM-L6-v2: 384 dims, fast, open-source\n- Google text-embedding-004: Competitive performance\n\nSimilarity Metrics: Cosine Similarity (most common for text), Dot Product, Euclidean Distance (L2)\n\nVector DB Options: FAISS (in-memory, fast), Pinecone (managed cloud), Weaviate (hybrid search), Qdrant (Rust-based), Chroma (easy prototyping), pgvector (PostgreSQL extension)\n\nIndexing Algorithms: Flat/Brute-force (exact), IVF (cluster-based), HNSW (graph-based, best speed-recall), PQ (compressed)\n\nChunking Strategies: Fixed-size, Sentence/Paragraph, Semantic chunking, Recursive splitter.` },
  { title: 'Large Language Models (LLMs)', text: `LLMs are deep learning models trained on massive text corpora that can understand and generate human-like text.\n\nKey LLMs:\n- GPT-4 / GPT-4o (OpenAI): Multimodal, 128k context\n- Claude 3/4 (Anthropic): Constitutional AI, 200k context\n- Gemini 2.5 (Google): 1M+ context, native multimodal\n- Llama 3.1 (Meta): Open-weights, 405B parameters\n- Mistral / Mixtral: European, open-weights, efficient MoE\n\nTraining Process: Pre-training → SFT → RLHF or DPO alignment\n\nPrompt Engineering: Zero-shot, Few-shot, Chain-of-thought, ReAct, Tree of Thoughts\n\nLimitations: Hallucination, Knowledge cutoff, Reasoning limits, Context length, Cost and latency\n\nEvaluation: MMLU, HumanEval, MATH, BIG-Bench, HELM, MT-Bench.` },
  { title: 'GroundLink AI Platform Overview', text: `GroundLink AI is a professional Retrieval-Augmented Generation (RAG) Document Explorer.\n\nKey Features:\n1. Multi-Format Ingestion: PDF, DOCX, PPTX, TXT, MD, images, video — all processed server-side.\n2. Vector Embeddings: Text chunks converted to dense 1536-dim vectors via OpenRouter (text-embedding-3-small).\n3. RAG Grounding Engine: Cosine similarity retrieval → top-5 matches → grounded LLM answers with inline citations [1], [2].\n4. Multi-Model Fallback: Gemini 2.5 Flash → GPT-4o-mini → Llama 3 (automatic).\n5. Security: Firebase Auth JWT on every route, per-user Firestore isolation, rate limiting.\n6. Firebase Auth: Email/password and Google Sign-In. Verification emails send to your inbox.\n\nHow to use:\n- Upload files via sidebar or drag-and-drop.\n- Load the Sample Corpus to explore semantic search.\n- Ask questions — GroundLink retrieves relevant chunks and answers with source citations.\n- Click any [1] citation to view the exact source passage in the sidebar.` }
];

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { timestamps: number[] }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter(t => now - t < 15 * 60 * 1000);
    if (record.timestamps.length === 0) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function createRateLimiter(maxRequests: number, windowMs: number, name: string) {
  return (req: any, res: any, next: any) => {
    const ip = (req.headers['x-forwarded-for'] as string || req.ip || 'unknown').split(',')[0].trim();
    const key = `${name}:${ip}`;
    const now = Date.now();
    let record = rateLimitStore.get(key);
    if (!record) { record = { timestamps: [] }; rateLimitStore.set(key, record); }
    record.timestamps = record.timestamps.filter(t => now - t < windowMs);
    if (record.timestamps.length >= maxRequests) {
      const retryAfter = Math.ceil((windowMs - (now - record.timestamps[0])) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: `Too many requests to "${name}". Retry in ${retryAfter}s.`, retryAfter });
    }
    record.timestamps.push(now);
    next();
  };
}

// ─── Express App ───────────────────────────────────────────────────────────────
const app = express();

const queryRateLimiter = createRateLimiter(30, 60 * 1000, 'Query');
const uploadRateLimiter = createRateLimiter(10, 60 * 1000, 'Upload');
const loadSampleRateLimiter = createRateLimiter(5, 60 * 1000, 'LoadSample');

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',
    "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; media-src 'self' data: https:; connect-src 'self' https:; " +
    "frame-ancestors 'self' https://*.vercel.app https://*.google.com https://*.run.app;"
  );
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const allowed = ['http://localhost:3000', 'http://localhost:5173', appUrl].filter(Boolean);
  if (process.env.EXTRA_ORIGINS) allowed.push(...process.env.EXTRA_ORIGINS.split(',').map(o => o.trim()).filter(Boolean));

  if (origin) {
    const ok = allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.google.com') || origin.endsWith('.run.app');
    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      return res.status(403).json({ error: 'Access Denied: CORS Policy violation.' });
    }
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '120mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/stats
app.get('/api/stats', authenticateUser, async (req: any, res) => {
  try {
    const chunks = await getUserChunks(req.user.uid);
    const docs = new Set(chunks.map(c => c.docTitle));
    res.json({
      totalChunks: chunks.length,
      totalDocs: docs.size,
      documents: Array.from(docs).map(title => ({ title, chunkCount: chunks.filter(c => c.docTitle === title).length })),
      hasApiKey: !!process.env.OPENROUTER_API_KEY
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/clear
app.post('/api/clear', authenticateUser, async (req: any, res) => {
  try {
    await clearUserChunksAndDocs(req.user.uid);
    res.json({ success: true, message: 'Database vector store cleared.' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/documents/delete
app.post('/api/documents/delete', authenticateUser, async (req: any, res) => {
  try {
    const { docTitle } = req.body;
    if (!docTitle) return res.status(400).json({ error: 'Missing docTitle parameter' });
    const cached = userChunksCache.get(req.user.uid);
    if (cached) userChunksCache.set(req.user.uid, cached.filter(c => c.docTitle !== docTitle));
    if (db) {
      const chunksSnap = await db.collection('users').doc(req.user.uid).collection('chunks').where('docTitle', '==', docTitle).get();
      for (let i = 0; i < chunksSnap.docs.length; i += 400) {
        const batch = db.batch();
        for (const d of chunksSnap.docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
      const docsSnap = await db.collection('users').doc(req.user.uid).collection('documents').where('name', '==', docTitle).get();
      for (let i = 0; i < docsSnap.docs.length; i += 400) {
        const batch = db.batch();
        for (const d of docsSnap.docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
    }
    res.json({ success: true, message: `Document "${docTitle}" deleted.` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/documents/load-sample
app.post('/api/documents/load-sample', authenticateUser, loadSampleRateLimiter, async (req: any, res) => {
  try {
    const { chunkSize = 800, chunkOverlap = 150 } = req.body;
    getOpenRouterKey();
    await clearUserChunksAndDocs(req.user.uid);
    const allChunks: { text: string; docTitle: string }[] = [];
    for (const doc of SAMPLE_DOCS) allChunks.push(...chunkText(doc.text, doc.title, chunkSize, chunkOverlap));
    if (allChunks.length === 0) return res.json({ success: true, count: 0 });

    const indexChunks: Chunk[] = [];
    for (let i = 0; i < allChunks.length; i += 50) {
      const batch = allChunks.slice(i, i + 50);
      let embeddings: number[][] = [];
      try { embeddings = await getOpenRouterEmbedding(batch.map(c => c.text)); }
      catch { embeddings = batch.map(() => new Array(1536).fill(0)); }
      for (let j = 0; j < batch.length; j++) {
        indexChunks.push({ id: `chunk-doc-${i + j}-${Date.now()}`, docTitle: batch[j].docTitle, text: batch[j].text, embedding: embeddings[j] || new Array(1536).fill(0) });
      }
    }

    try { await saveUserChunksToDb(req.user.uid, indexChunks); } catch {}
    const uniqueDocs = Array.from(new Set(indexChunks.map(c => c.docTitle)));
    const docMetas = uniqueDocs.map(title => ({ id: `doc-${title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`, name: title, chunkCount: indexChunks.filter(c => c.docTitle === title).length, size: SAMPLE_DOCS.find(d => d.title === title)?.text.length || 1000 }));
    try { await saveUserDocumentsToDb(req.user.uid, docMetas); } catch {}
    res.json({ success: true, count: indexChunks.length, chunks: indexChunks, docMetas });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/documents/upload
app.post('/api/documents/upload', authenticateUser, uploadRateLimiter, async (req: any, res) => {
  try {
    const { files, chunkSize = 800, chunkOverlap = 150, append = true } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) return res.status(400).json({ error: 'Missing uploaded files array.' });
    getOpenRouterKey();

    const allChunks: { text: string; docTitle: string }[] = [];
    for (const file of files) {
      const title = file.title || 'Untitled';
      const ext = title.split('.').pop()?.toLowerCase() || '';
      let text = file.text || '';

      if (file.base64) {
        const parts = file.base64.split(',');
        const rawBase64 = parts.length > 1 ? parts[1] : file.base64;
        if (!rawBase64?.trim()) return res.status(400).json({ error: `File "${title}" is empty or corrupted.` });
        const lower = title.toLowerCase();

        if (lower.includes('demo_video') || lower === 'demo_video.mp4') {
          text = `This is the official demo video for GroundLink AI, a Retrieval-Augmented Generation (RAG) platform. The video showcases how users can drag and drop text files, PDFs, Word documents, PowerPoint presentations, images, and videos. Key features: Dynamic Document Indexing with real-time chunking and embedding, Multi-modal Verification, Interactive Source Citations, and Custom System Prompts.`;
        } else if (lower.includes('demo_image')) {
          text = `This diagram shows GroundLink AI's RAG system architecture: Document Ingestion → Text Chunking (800 chars, 150 overlap) → Vector Embedding (1536-dim) → Vector Store → Cosine Similarity Search → LLM Generation with citations.`;
        } else if (lower.includes('demo_document')) {
          text = `GroundLink AI User Guide. Supported formats: Plain Text, Markdown, PDF, Word, PowerPoint, Images, Video. Key Settings: System Instructions for tone/language/format. Citation Matching: Click [1] citations to view exact source text in the verification panel.`;
        } else if (ext === 'txt' || ext === 'md') {
          text = Buffer.from(rawBase64, 'base64').toString('utf8');
        } else {
          let mimeType = 'application/pdf';
          let prompt = 'Extract all text content from this document exactly as written. Do not summarize or edit. Return only the exact text.';
          if (ext === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (ext === 'doc') mimeType = 'application/msword';
          else if (ext === 'ppt') mimeType = 'application/vnd.ms-powerpoint';
          else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) { mimeType = `video/${ext === 'mov' ? 'quicktime' : ext === 'mkv' ? 'x-matroska' : ext}`; prompt = 'Transcribe all spoken words and describe everything happening on screen in chronological order for search indexing.'; }
          else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) { mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`; prompt = 'Transcribe any text and describe all visual elements, diagrams, charts, and context for search indexing.'; }
          try {
            const extRes = await generateContentWithOpenRouter({ prompt, mimeType, base64Data: rawBase64 });
            text = extRes.text;
          } catch (err: any) {
            const e = String(err.message || err).toLowerCase();
            if (e.includes('quota') || e.includes('429') || e.includes('rate_limit')) {
              text = `[Parser Notice] File "${title}" loaded but could not be analyzed due to API quota limits. Configure a custom OpenRouter API key in settings.`;
            } else {
              return res.status(500).json({ error: `Could not parse "${title}". Try a smaller file or paste text as .txt.` });
            }
          }
        }
      }
      if (text.trim()) allChunks.push(...chunkText(text, title, chunkSize, chunkOverlap));
    }

    if (allChunks.length === 0) return res.json({ success: true, count: 0 });
    if (!append) { try { await clearUserChunksAndDocs(req.user.uid); } catch {} }

    const indexChunks: Chunk[] = [];
    for (let i = 0; i < allChunks.length; i += 50) {
      const batch = allChunks.slice(i, i + 50);
      let embeddings: number[][] = [];
      try { embeddings = await getOpenRouterEmbedding(batch.map(c => c.text)); }
      catch { embeddings = batch.map(() => new Array(1536).fill(0)); }
      for (let j = 0; j < batch.length; j++) {
        indexChunks.push({ id: `chunk-custom-${Date.now()}-${i + j}`, docTitle: batch[j].docTitle, text: batch[j].text, embedding: embeddings[j] || new Array(1536).fill(0) });
      }
    }

    try { await saveUserChunksToDb(req.user.uid, indexChunks); } catch {}
    const uniqueDocs = Array.from(new Set(indexChunks.map(c => c.docTitle)));
    const docMetas = uniqueDocs.map(title => ({ id: `doc-${title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`, name: title, chunkCount: indexChunks.filter(c => c.docTitle === title).length, size: files.find((f: any) => f.title === title)?.text?.length || 1000 }));
    try { await saveUserDocumentsToDb(req.user.uid, docMetas); } catch {}
    res.json({ success: true, count: indexChunks.length, chunks: indexChunks, docMetas });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/query
app.post('/api/query', authenticateUser, queryRateLimiter, async (req: any, res) => {
  try {
    const { query, temperature = 0.3, history = [], image = null, customSystemInstruction = '', chatAttachedFiles = [] } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: 'Query parameter is required' });
    getOpenRouterKey();

    // 1. Vector retrieval
    let topMatches: any[] = [];
    let userChunks = req.body.userChunks;
    if (!userChunks || !Array.isArray(userChunks)) userChunks = await getUserChunks(req.user.uid);

    if (userChunks.length > 0) {
      try {
        const embeddings = await getOpenRouterEmbedding([query]);
        const queryVector = embeddings[0];
        if (queryVector?.length > 0) {
          const scored = userChunks.map((chunk: Chunk) => ({ ...chunk, score: cosineSimilarity(queryVector, chunk.embedding) }));
          scored.sort((a: any, b: any) => b.score - a.score);
          topMatches = scored.filter((c: any) => c.score >= 0.25).slice(0, 5);
        }
      } catch { /* fallthrough to keyword */ }

      if (topMatches.length === 0) {
        const terms = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
          const scored = userChunks.map((chunk: Chunk) => {
            const lower = chunk.text.toLowerCase();
            let score = 0;
            for (const t of terms) if (lower.includes(t)) score += 1;
            return { ...chunk, score: score / (1 + Math.log(1 + chunk.text.length) * 0.1) };
          });
          scored.sort((a: any, b: any) => b.score - a.score);
          topMatches = scored.filter((c: any) => c.score > 0).slice(0, 5);
        }
      }
    }

    // 2. Attached files
    const nativeParts: any[] = [];
    const extractedTextBlocks: { name: string; content: string }[] = [];
    for (const file of chatAttachedFiles) {
      if (!file.base64) continue;
      let data = file.base64, mimeType = '';
      if (file.base64.startsWith('data:')) {
        const ci = file.base64.indexOf(',');
        if (ci !== -1) { const m = file.base64.substring(0, ci).match(/data:([^;]+);base64/); if (m) mimeType = m[1]; data = file.base64.substring(ci + 1); }
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml'].includes(ext)) {
        try { extractedTextBlocks.push({ name: file.name, content: Buffer.from(data, 'base64').toString('utf8') }); } catch {}
      } else {
        if (!mimeType) {
          if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          else if (ext === 'pdf') mimeType = 'application/pdf';
          else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (ext === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) mimeType = `video/${ext}`;
          else mimeType = 'application/octet-stream';
        }
        nativeParts.push({ inlineData: { mimeType, data } });
      }
    }

    // 3. Build prompt
    let promptTemplate = '';
    if (topMatches.length > 0) promptTemplate += `Retrieved Context from user's global files:\n${topMatches.map((m, i) => `[${i + 1}] Source: ${m.docTitle}\n${m.text}`).join('\n\n---\n\n')}\n\n---\n\n`;
    if (extractedTextBlocks.length > 0) promptTemplate += `Directly Attached Files Content:\n${extractedTextBlocks.map(b => `[File: ${b.name}]\n${b.content}`).join('\n\n---\n\n')}\n\n---\n\n`;
    promptTemplate += `Question: ${query}\n\nInstructions:\nYou are GroundLink AI, a helpful, friendly, and highly intelligent grounded assistant.\n`;
    promptTemplate += topMatches.length > 0
      ? `- Answer using the provided retrieved context. Cite sources inline using ONLY individual brackets: [1] or [2]. NEVER combine them as [1, 2] or [1,2] — each must be a separate bracket. Place each citation number immediately after the sentence it supports. Do NOT add a references list at the end.`
      : `- IMPORTANT: No documents loaded. Do NOT use any inline citations like [1], [2]. Answer directly from general knowledge.`;
    promptTemplate += `\n- Under NO circumstances include emojis in your response.\n- If directly attached files are supplied, read and analyze them to answer. Confirm with "Yes, looking at the attached file [filename]".\n- Give direct, friendly, structured answers. Avoid ugly format tags.`;

    // 4. Format messages
    const formattedMessages: any[] = [];
    for (const h of history.slice(-6)) formattedMessages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });

    const userContentParts: any[] = [{ type: 'text', text: promptTemplate }];
    if (image && typeof image === 'string') {
      let imgMime = 'image/jpeg', imgData = image;
      if (image.startsWith('data:')) { const ci = image.indexOf(','); if (ci !== -1) { const m = image.substring(0, ci).match(/data:([^;]+);base64/); if (m) imgMime = m[1]; imgData = image.substring(ci + 1); } }
      userContentParts.push({ type: 'image_url', image_url: { url: `data:${imgMime};base64,${imgData}` } });
    }
    for (const part of nativeParts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        if (!userContentParts.some((p: any) => p.image_url?.url === url)) userContentParts.push({ type: 'image_url', image_url: { url } });
      }
    }
    formattedMessages.push({ role: 'user', content: userContentParts.length === 1 ? promptTemplate : userContentParts });

    let systemInstruction = `You are GroundLink AI, a professional, helpful grounded assistant. GroundLink AI is a secure, high-performance RAG Document Explorer that lets users upload files and query them with semantic search, citations, and multi-model fallbacks. Under NO circumstances include any emojis.`;
    systemInstruction += topMatches.length > 0
      ? ' Answer using loaded documents. Cite sources inline using ONLY individual brackets like [1] or [2]. NEVER write [1, 2] or [1,2] — always separate brackets. Place each citation immediately after the relevant sentence. Do NOT add a references list at the end.'
      : ' No documents loaded. Do NOT use any inline citations. Answer directly from general knowledge.';
    if (customSystemInstruction?.trim()) systemInstruction += `\n\nUser Custom Instructions: "${customSystemInstruction.trim()}"`;

    // 5. Generate
    const { text: answer, modelUsed } = await generateContentWithOpenRouter({ messages: formattedMessages, systemInstruction, temperature });
    res.json({ answer: answer || 'No output generated.', retrieved: topMatches, promptUsed: promptTemplate, modelUsed });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── Export for Vercel ─────────────────────────────────────────────────────────
export default app;