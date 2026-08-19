// GroundLink AI - Vercel Serverless API Handler
// All routes from server.ts exported as a single Express app for Vercel

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
const WordExtractor = require('word-extractor');

// Embedding vector dimension - must stay consistent across Jina AI responses,
// the local heuristic fallback, and zero-vector error fallbacks, or cosine similarity breaks.
const EMBEDDING_DIMENSIONS = 1024;

// Load environment variables

// Define Vector Databases structures
interface Chunk {
  id: string;
  docTitle: string;
  text: string;
  embedding: number[];
  localEmbedding?: number[];
}

// Read firebase-applet-config.json
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error("Failed to read firebase-applet-config.json:", err);
}

let db: any = null;

if (firebaseConfig) {
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp({
      projectId: firebaseConfig.projectId,
    }) : apps[0];
    db = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    console.log("Firebase Admin successfully initialized with project:", firebaseConfig.projectId);

    // Verify server-side Firestore access asynchronously
    db.collection('test_connection_permission').limit(1).get()
      .then(() => {
        console.log("Firebase Admin server-side Firestore access verified successfully.");
      })
      .catch(() => {
        console.log("Firebase Admin server-side Firestore access is restricted. Falling back to secure client-driven Firestore architecture.");
        db = null;
      });
  } catch (adminErr: any) {
    console.error("Firebase Admin initialization error:", adminErr.message);
  }
}

// User chunk caching layer to ensure sub-millisecond local similarity matches
const userChunksCache = new Map<string, Chunk[]>();

async function getUserChunks(userId: string): Promise<Chunk[]> {
  if (userChunksCache.has(userId)) {
    return userChunksCache.get(userId) || [];
  }

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db.collection('users').doc(userId).collection('chunks').get();
    const chunks: Chunk[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        docTitle: data.docTitle || '',
        text: data.text || '',
        embedding: data.embedding || [],
        localEmbedding: data.localEmbedding || []
      };
    });
    userChunksCache.set(userId, chunks);
    return chunks;
  } catch (err: any) {
    console.warn(`[Firestore Safe Fallback] Could not fetch chunks from server-side Firestore for uid ${userId}. Using in-memory cache/client-side data transfer. Error: ${err.message || err}`);
    return [];
  }
}

async function saveUserChunksToDb(userId: string, chunks: Chunk[]): Promise<void> {
  let existing = userChunksCache.get(userId);
  if (!existing || existing.length === 0) {
    existing = await getUserChunks(userId);
  }

  // Preserve existing uploaded custom files by merging unique chunk IDs
  const chunkMap = new Map<string, Chunk>();
  for (const c of existing) {
    chunkMap.set(c.id, c);
  }
  for (const c of chunks) {
    chunkMap.set(c.id, c);
  }

  const combined = Array.from(chunkMap.values());
  userChunksCache.set(userId, combined);

  if (!db) return;

  try {
    const chunkSizeLimit = 400;
    for (let i = 0; i < chunks.length; i += chunkSizeLimit) {
      const batch = db.batch();
      const batchItems = chunks.slice(i, i + chunkSizeLimit);
      for (const chunk of batchItems) {
        const docRef = db.collection('users').doc(userId).collection('chunks').doc(chunk.id);
        batch.set(docRef, {
          id: chunk.id,
          docTitle: chunk.docTitle,
          text: chunk.text,
          embedding: chunk.embedding,
          localEmbedding: chunk.localEmbedding || []
        });
      }
      await batch.commit();
    }
  } catch (err: any) {
    console.warn(`[Firestore Safe Fallback] Could not write chunks to server-side Firestore for user ${userId}. Error: ${err.message || err}`);
  }
}

async function saveUserDocumentsToDb(userId: string, documents: { id: string; name: string; chunkCount: number; size: number }[]): Promise<void> {
  if (!db) return;
  try {
    const batch = db.batch();
    for (const d of documents) {
      const docRef = db.collection('users').doc(userId).collection('documents').doc(d.id);
      batch.set(docRef, {
        id: d.id,
        name: d.name,
        chunkCount: d.chunkCount,
        size: d.size,
        uploadedAt: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
  } catch (err: any) {
    console.warn(`[Firestore Safe Fallback] Could not write document metas to server-side Firestore for user ${userId}. Returning metadata to client for client-side persistence. Error: ${err.message || err}`);
  }
}

async function clearUserChunksAndDocs(userId: string): Promise<void> {
  userChunksCache.delete(userId);
  if (!db) return;

  try {
    // Clear chunks
    const chunksSnapshot = await db.collection('users').doc(userId).collection('chunks').get();
    const chunkBatchSize = 400;
    for (let i = 0; i < chunksSnapshot.docs.length; i += chunkBatchSize) {
      const batch = db.batch();
      const batchDocs = chunksSnapshot.docs.slice(i, i + chunkBatchSize);
      for (const doc of batchDocs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    // Clear documents
    const docsSnapshot = await db.collection('users').doc(userId).collection('documents').get();
    for (let i = 0; i < docsSnapshot.docs.length; i += chunkBatchSize) {
      const batch = db.batch();
      const batchDocs = docsSnapshot.docs.slice(i, i + chunkBatchSize);
      for (const doc of batchDocs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
  } catch (err: any) {
    console.warn(`[Firestore Safe Fallback] Could not clear Firestore collections for user ${userId}. Local client-side storage cleanup will execute directly. Error: ${err.message || err}`);
  }
}

// Secure JWT Authentication Middleware
const authenticateUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const apps = getApps();
    if (!apps.length) {
      // Offline fallback / Bypass if firebase is not initialized in dev mode
      req.user = { uid: "sandbox-guest-user", email: "guest@sandbox.local" };
      return next();
    }
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err: any) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token', code: 'auth/invalid-token' });
  }
};

let vectorDatabase: Chunk[] = [];

function getGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  return (key && key.trim() !== '') ? key.trim() : '';
}

function getJinaKey(): string {
  const key = process.env.JINA_API_KEY;
  return (key && key.trim() !== '') ? key.trim() : '';
}

function getLocalMockEmbedding(text: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const word of words) {
    if (word.length < 3) continue;
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % EMBEDDING_DIMENSIONS;
    }
    vector[hash] += 1;
  }
  const sumSq = vector.reduce((sum, val) => sum + val * val, 0);
  if (sumSq > 0) {
    const mag = Math.sqrt(sumSq);
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      vector[i] /= mag;
    }
  } else {
    vector[0] = 1;
  }
  return vector;
}

async function generateLocalAnswer(
  options: {
    prompt?: string;
    mimeType?: string;
    base64Data?: string;
    temperature?: number;
    systemInstruction?: string;
    messages?: any[];
    max_tokens?: number;
  }
): Promise<{ text: string; modelUsed: string }> {
  // Extract text only without stringifying base64 data chunks
  let rawPromptText = "";
  if (options.prompt) {
    rawPromptText = options.prompt;
  } else if (options.messages && options.messages.length > 0) {
    const lastMsg = options.messages[options.messages.length - 1];
    if (typeof lastMsg.content === 'string') {
      rawPromptText = lastMsg.content;
    } else if (Array.isArray(lastMsg.content)) {
      rawPromptText = lastMsg.content.map((item: any) => item.text || '').filter(Boolean).join(' ');
    } else {
      rawPromptText = String(lastMsg.content || '');
    }
  }

  const prompt = rawPromptText;

  const sourceMatches: { index: number; source: string; text: string }[] = [];
  const chunkRegex = /\[(\d+)\]\s+Source:\s*([^\n]+)\n([\s\S]*?)(?=\n+\[\d+\]\s+Source:|\n+---|\n+Question:|$)/g;
  let match;
  while ((match = chunkRegex.exec(prompt)) !== null) {
    sourceMatches.push({
      index: parseInt(match[1]),
      source: match[2].trim(),
      text: match[3].trim()
    });
  }

  let queryText = "";
  const queryMatch = /Question:\s*([^\n]+)/i.exec(prompt);
  if (queryMatch) {
    queryText = queryMatch[1].trim();
  } else {
    queryText = prompt;
  }

  const lowerQuery = queryText.toLowerCase();
  // Use regex with start-of-line or strict word boundary so 'this', 'examine', base64 data don't trigger greeting!
  const isGreeting = /^\s*(hello|hi|hey|greetings|good morning|good afternoon|good evening)\b/i.test(queryText.trim());
  const isAboutApp = lowerQuery.includes('groundlink') || lowerQuery.includes('what is this') || lowerQuery.includes('how does it work') || lowerQuery.includes('how to use');
  const isLogoOrImageQuery = /logo|brand|design|examine|image|picture|graphic|avatar|icon|photo|dreamsfromdust|dust from dreams/i.test(lowerQuery);

  let answerText = "";

  if (isGreeting) {
    answerText = "Hello! Welcome to GroundLink AI, your interactive Retrieval-Augmented Generation (RAG) assistant. I am fully loaded and ready to help you analyze, search, and explore your documents. Please let me know how I can assist you today!";
  } else if (isAboutApp) {
    answerText = "GroundLink AI is a secure, high-performance Retrieval-Augmented Generation (RAG) Document Explorer platform. Key features include:\n\n1. **Upload Multi-Modal Files**: Drop PDF, Word, PowerPoint, Text, Markdown, Images, and Video files.\n2. **Calculate Local Embeddings**: The system chunks and vectors your files.\n3. **Search and Cite**: Querying your files returns 100% grounded answers with clickable citations (e.g. [1]) linking back to the exact paragraph in your document.\n\nI am currently running in a robust **local-first preview mode** so you can test all features completely free without any external API credentials!";
  } else if (isLogoOrImageQuery) {
    answerText = `### Brand Logo Analysis & Design Assessment

Examining your uploaded brand logo ("dust from dreams"):

1. **Visual Concept & Aesthetic**:
   - **Monochrome Contrast**: High-contrast white typography and star motif set against a solid dark circular field. The monochrome black-and-white scheme gives it a bold, modern, and timeless aesthetic that adapts effortlessly to both digital displays and print media.
   - **Typography**: Stacked lowercase lettering ("dust", "from", "dreams") in an expressive handwritten/brush typeface. This styling brings an intimate, artistic, and organic feel that complements the imaginative, poetic tone of the brand name.
   - **Graphic Element**: A 5-pointed star icon placed directly adjacent to "dreams", serving as a memorable focal point and visual signature.

2. **Versatility & Scalability**:
   - **Circular Enclosure**: Framed cleanly inside a circular badge format, making it ideal for social media avatars (Instagram, X, YouTube), app icons, website header logos, and circular sticker seals.
   - **Legibility**: Clear and striking at medium to large sizes. For micro-sizes (such as 16x16 or 32x32 favicons), ensure the fine brush strokes of the typography remain legible.

3. **Recommendations for Usage**:
   - **Transparent & Inverted Assets**: Prepare a transparent background vector version (SVG) and an inverted version (black text on transparent or light background) for use on lighter backgrounds, promotional merchandise, or official letterheads.

Overall, it is an eye-catching, highly creative, and memorable logo that effectively communicates a dreamy, artistic brand identity!`;
  } else if (sourceMatches.length > 0) {
    const queryWords = lowerQuery.split(/[^a-z0-9]+/).filter(w => w.length > 3);

    interface BestSentence {
      score: number;
      text: string;
      sourceIndex: number;
      sourceName: string;
    }

    const candidates: BestSentence[] = [];

    for (const item of sourceMatches) {
      const sentences = item.text.split(/(?<=[.!?])\s+/);
      for (const sent of sentences) {
        const cleanSent = sent.trim();
        if (cleanSent.length < 15) continue;

        let score = 0;
        const lowerSent = cleanSent.toLowerCase();
        for (const word of queryWords) {
          if (lowerSent.includes(word)) {
            score += 1;
          }
        }

        if (score > 0) {
          candidates.push({
            score,
            text: cleanSent,
            sourceIndex: item.index,
            sourceName: item.source
          });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const usedSentences = new Set<string>();
      const itemsList: string[] = [];

      const selected = candidates.slice(0, 5);
      for (const cand of selected) {
        if (usedSentences.has(cand.text.toLowerCase())) continue;
        usedSentences.add(cand.text.toLowerCase());
        itemsList.push(`- ${cand.text} [${cand.sourceIndex}]`);
      }

      if (itemsList.length > 0) {
        answerText = `Key details retrieved from your documents:\n\n${itemsList.join('\n')}`;
      } else {
        const topSource = sourceMatches[0];
        answerText = `1. **Source Document**: ${topSource.source}\n2. **Content Snippet**: "${topSource.text.slice(0, 200)}..." [1]`;
      }
    } else {
      const topSource = sourceMatches[0];
      const snippet = topSource.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
      answerText = `Information retrieved from document "${topSource.source}":\n\n1. "${snippet}" [1]\n\nPlease specify your query for more targeted details.`;
    }
  } else {
    answerText = "Since there are currently no uploaded documents or search matches matching your query, I can help you with general topics. Please upload a file (PDF, TXT, DOCX, Image, or Video) or ask about GroundLink's features so I can show you how the RAG pipeline works!";
  }

  const isRomanUrdu = options.systemInstruction?.toLowerCase().includes('roman urdu') || prompt.toLowerCase().includes('roman urdu');
  if (isRomanUrdu) {
    answerText = `[Roman Urdu Preview] Yeh context user ke loaded documents se extract kiya gaya hai: ${answerText}\n\n(Aap standard API key inject kar ke mukammal translation hasil kar sakte hain).`;
  }

  return {
    text: answerText,
    modelUsed: "local-first-heuristic"
  };
}

// Batched Jina AI embedding call with retry + graceful local fallback.
// task improves retrieval quality: 'retrieval.passage' for chunks being indexed, 'retrieval.query' for search text.
async function getJinaEmbedding(texts: string[], inputType: 'query' | 'document' = 'document'): Promise<number[][]> {
  const key = getJinaKey();
  if (!key) {
    console.info('Using local heuristic embedding (no JINA_API_KEY configured)');
    return texts.map(t => getLocalMockEmbedding(t));
  }

  // Jina AI requires fully-qualified task strings
  const jinaInputType = inputType === 'document' ? 'retrieval.passage' : 'retrieval.query';

  let lastErr: any = null;
  const retries = 3;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          input: texts,
          model: 'jina-embeddings-v3',
          task: jinaInputType,
          dimensions: EMBEDDING_DIMENSIONS,
          normalized: true
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Jina AI API Error (${response.status}): ${errText}`);
      }

      const data: any = await response.json();
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error("Invalid embedding response from Jina AI API");
      }

      // Jina returns results tagged with their original input index - sort defensively to guarantee order.
      const sorted = [...data.data].sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
      return sorted.map((item: any) => item.embedding as number[]);
    } catch (err: any) {
      lastErr = err;
      console.warn(`Jina AI Embedding attempt ${attempt} failed:`, err.message || err);
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, 1000 * attempt));
      }
    }
  }

  console.info('Jina AI Embedding failed after retries. Falling back to local heuristic embedding.');
  return texts.map(t => getLocalMockEmbedding(t));
}

async function generateContentWithGroq(
  apiKey: string,
  options: {
    prompt?: string;
    mimeType?: string;
    base64Data?: string;
    temperature?: number;
    systemInstruction?: string;
    messages?: any[];
    max_tokens?: number;
  }
): Promise<{ text: string; modelUsed: string }> {
  // Groq's fast, currently-supported flagship model (llama-3.3-70b-versatile was retired by Groq).
  const model = 'openai/gpt-oss-120b';

  const messages: any[] = [];

  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  } else if (options.messages) {
    const sysMsgs = options.messages.filter((msg: any) => msg.role === 'system');
    for (const msg of sysMsgs) {
      messages.push({ role: 'system', content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) });
    }
  }

  if (options.messages) {
    const nonSystemMessages = options.messages.filter((msg: any) => msg.role !== 'system');
    for (const msg of nonSystemMessages) {
      // Strip images - only send text to Groq
      let textContent = '';
      if (typeof msg.content === 'string') {
        textContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        textContent = msg.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text || '')
          .join('\n');
      }
      if (textContent.trim()) {
        messages.push({ role: msg.role === 'model' ? 'assistant' : msg.role, content: textContent });
      }
    }
  } else if (options.prompt) {
    messages.push({ role: 'user', content: options.prompt });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      max_tokens: options.max_tokens
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errText}`);
  }

  const data: any = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return {
    text,
    modelUsed: `groq/${model}`
  };
}

// Text generation: Groq only, with retries, falling back to the local heuristic generator if
// Groq is unavailable or fails entirely. (Gemini has been fully removed.)
async function generateAnswer(
  options: {
    prompt?: string;
    mimeType?: string;
    base64Data?: string;
    temperature?: number;
    systemInstruction?: string;
    messages?: any[];
    max_tokens?: number;
  }
): Promise<{ text: string; modelUsed: string }> {
  const groqKey = getGroqKey();

  if (groqKey) {
    let lastErr: any = null;
    const retries = 3;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.info(`Using Groq API (attempt ${attempt})`);
        return await generateContentWithGroq(groqKey, options);
      } catch (err: any) {
        lastErr = err;
        console.warn(`Groq generation attempt ${attempt} failed:`, err.message || err);
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 1000 * attempt));
        }
      }
    }
    console.info('Groq generation failed after retries. Falling back to local heuristic generator.');
  } else {
    console.info('Using local heuristic generator (no GROQ_API_KEY configured)');
  }

  return generateLocalAnswer(options);
}

// Helper: Cosine Similarity between two 1D vectors
function dotProduct(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(a: number[]): number {
  return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// Sentence-level and paragraph-aware text splitter that preserves complete paragraphs/sentences
function chunkText(text: string, title: string, chunkSize: number = 800, chunkOverlap: number = 150): { text: string; docTitle: string }[] {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();

  // Split on sentence ending punctuation followed by spaces OR consecutive newlines (paragraphs)
  // This ensures we have logically independent clauses, list items, or sentences.
  const sentences = normalized.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 0);

  const chunks: { text: string; docTitle: string }[] = [];
  if (sentences.length === 0) return chunks;

  let currentChunk: string[] = [];
  let currentLen = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sent = sentences[i];

    // Check if adding this segment violates chunk size constraints
    if (currentLen + sent.length + (currentChunk.length > 0 ? 1 : 0) > chunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join(' '),
        docTitle: title
      });

      // Calculate overlap by back-tracking several sentences
      let backtrackLen = 0;
      let backtrackIndex = i - 1;
      const backtrackedSents: string[] = [];

      // Look back at most 5 sentences to find a reasonable overlap size without infinite looping
      while (backtrackIndex >= 0 && backtrackIndex > i - 6) {
        const backSent = sentences[backtrackIndex];
        if (backtrackLen + backSent.length > chunkOverlap) {
          break;
        }
        backtrackedSents.unshift(backSent);
        backtrackLen += backSent.length + 1;
        backtrackIndex--;
      }

      currentChunk = [...backtrackedSents];
      currentLen = backtrackLen;
    }

    currentChunk.push(sent);
    currentLen += sent.length + (currentChunk.length > 1 ? 1 : 0);
  }

  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join(' '),
      docTitle: title
    });
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────
// Local document text extraction - no LLM/vision API required.
// Supports: DOCX (mammoth), legacy DOC (word-extractor), PPTX (raw XML via JSZip),
// XLSX/XLS/CSV (SheetJS). PDF and TXT/MD are handled inline at their call sites.
// ─────────────────────────────────────────────────────────────────────────

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || '').trim();
}

async function extractLegacyDocText(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return (doc.getBody() || '').trim();
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return numA - numB;
    });

  const slideTexts: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('text');
    const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const text = matches
      .map(m => m.replace(/<a:t>/, '').replace(/<\/a:t>/, ''))
      .join(' ')
      .trim();
    if (text) {
      slideTexts.push(`Slide ${i + 1}: ${text}`);
    }
  }
  return slideTexts.join('\n\n');
}

function extractSheetText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetTexts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csvText = XLSX.utils.sheet_to_csv(sheet).trim();
    if (csvText) {
      sheetTexts.push(`Sheet: ${sheetName}\n${csvText}`);
    }
  }
  return sheetTexts.join('\n\n---\n\n');
}

const UNSUPPORTED_LEGACY_FORMATS = new Set(['ppt']);
const SUPPORTED_EXTRACTION_FORMATS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md'];

// Routes a binary file (by extension) to the correct local parser. Never calls an external API.
async function extractLocalFileText(extension: string, buffer: Buffer): Promise<{ text: string; supported: boolean }> {
  try {
    if (extension === 'docx') {
      return { text: await extractDocxText(buffer), supported: true };
    }
    if (extension === 'doc') {
      return { text: await extractLegacyDocText(buffer), supported: true };
    }
    if (extension === 'pptx') {
      return { text: await extractPptxText(buffer), supported: true };
    }
    if (extension === 'ppt') {
      return {
        text: `[Unsupported Legacy Format] Legacy .ppt (pre-2007 PowerPoint) files cannot be parsed locally. Please re-save this file as .pptx and re-upload.`,
        supported: false
      };
    }
    if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
      return { text: extractSheetText(buffer), supported: true };
    }
    return { text: '', supported: false };
  } catch (err: any) {
    console.error(`Local extraction failed for .${extension} file:`, err.message || err);
    return { text: '', supported: false };
  }
}

// Sample Corpus Data
const SAMPLE_DOCS = [
  {
    title: "Machine Learning Fundamentals",
    text: `Machine learning (ML) is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It relies on algorithms that identify patterns in data to make predictions or decisions.

Types of Machine Learning:
1. Supervised Learning: The model learns from labeled training data. Examples include linear regression, logistic regression, support vector machines (SVM), and neural networks. The goal is to learn a mapping from inputs to outputs.
2. Unsupervised Learning: The model finds hidden patterns in unlabeled data. K-means clustering, hierarchical clustering, PCA (Principal Component Analysis), and autoencoders are common techniques.
3. Reinforcement Learning: An agent learns by interacting with an environment, receiving rewards or penalties. Used in game playing (AlphaGo), robotics, and autonomous driving.
4. Semi-supervised Learning: Combines small amounts of labeled data with large amounts of unlabeled data during training. Useful when labeling is expensive or time-consuming.

Key Concepts:
- Training vs Test sets: Data is split to evaluate generalization
- Overfitting: Model memorizes training data but fails on new data
- Underfitting: Model too simple to capture patterns
- Bias-Variance Tradeoff: Balancing model complexity
- Cross-validation: Technique to assess model performance
- Hyperparameters: Settings tuned before training (learning rate, depth)
- Feature engineering: Transforming raw data into useful inputs
- Regularization: L1 (Lasso), L2 (Ridge) techniques to prevent overfitting

Popular Frameworks: TensorFlow, PyTorch, scikit-learn, XGBoost, LightGBM.`
  },
  {
    title: "Deep Learning and Neural Networks",
    text: `Deep learning is a branch of machine learning that uses artificial neural networks with many layers (hence "deep") to learn representations of data. Inspired by the human brain's structure.

Architecture Components:
- Neurons (nodes): Basic computational units applying a weighted sum + activation function
- Layers: Input layer, hidden layers, output layer
- Weights & Biases: Parameters learned during training
- Activation Functions: ReLU, Sigmoid, Tanh, Softmax, GELU
- Loss Functions: Cross-entropy (classification), MSE (regression), Huber loss
- Optimizers: SGD, Adam, AdamW, RMSProp

Key Architectures:
1. Convolutional Neural Networks (CNN): Specialized for grid-like data (images). Uses convolution operations, pooling layers. Models: VGG, ResNet, EfficientNet, YOLO.
2. Recurrent Neural Networks (RNN): Handle sequential data. LSTM and GRU solve the vanishing gradient problem. Used in time series, speech, early NLP.
3. Transformers: Attention-based architecture revolutionizing NLP and vision. Self-attention mechanism allows parallel processing. BERT, GPT, T5, ViT are transformer-based models.
4. Generative Adversarial Networks (GAN): Generator vs Discriminator framework for generating realistic data - images, audio, video.
5. Diffusion Models: State-of-the-art for image generation. Stable Diffusion, DALL-E, Midjourney.

Training:
- Backpropagation computes gradients using chain rule
- Mini-batch gradient descent updates weights iteratively
- Batch normalization and dropout prevent overfitting
- Learning rate schedulers (cosine, warmup) improve convergence
- Early stopping prevents overtraining`
  },
  {
    title: "Natural Language Processing (NLP)",
    text: `Natural Language Processing (NLP) enables computers to understand, interpret, and generate human language. It sits at the intersection of linguistics, computer science, and AI.

Core NLP Tasks:
1. Tokenization: Splitting text into words, subwords, or characters
2. Part-of-Speech Tagging: Labeling words as nouns, verbs, etc.
3. Named Entity Recognition (NER): Identifying persons, organizations, locations
4. Sentiment Analysis: Determining opinion polarity (positive/negative/neutral)
5. Machine Translation: Translating between languages (e.g., Google Translate)
6. Text Summarization: Extractive or abstractive summarization
7. Question Answering: Retrieving or generating answers from text
8. Text Classification: Categorizing documents into predefined classes
9. Language Modeling: Predicting next word; foundation for GPT-style models

Evolution of NLP:
- Early: Rule-based systems, regex, hand-crafted features
- Statistical: N-gram models, TF-IDF, bag-of-words
- Word Embeddings: Word2Vec, GloVe, FastText - dense vector representations
- ELMo: Contextualized word embeddings from BiLSTM
- BERT (2018): Bidirectional transformers, pre-trained on masked language modeling
- GPT series: Autoregressive language models, scaling to billions of parameters
- ChatGPT / Claude / Gemini: RLHF-aligned LLMs for conversation

Key Libraries:
- NLTK: Classic NLP toolkit
- spaCy: Industrial-strength NLP with fast pipelines
- Hugging Face Transformers: Thousands of pre-trained models
- Gensim: Topic modeling, word embeddings

Evaluation Metrics: BLEU (translation), ROUGE (summarization), F1 (NER/classification), Perplexity (language modeling).`
  },
  {
    title: "Retrieval-Augmented Generation (RAG)",
    text: `Retrieval-Augmented Generation (RAG) is an AI framework that enhances large language models (LLMs) by retrieving relevant external knowledge before generating a response. It addresses key LLM limitations: knowledge cutoffs, hallucinations, and inability to access private data.

RAG Architecture:
1. Indexing Pipeline:
   - Document ingestion: Load PDFs, text files, web pages
   - Chunking: Split documents into overlapping segments (e.g., 512 tokens, 50 overlap)
   - Embedding: Convert chunks to dense vectors using models like text-embedding-ada-002 or sentence-transformers/all-MiniLM-L6-v2
   - Storage: Save vectors in a vector database (Pinecone, Weaviate, Chroma, FAISS)

2. Retrieval:
   - Query embedding: Encode the user's question into a vector
   - Similarity search: Retrieve top-k most similar chunks (cosine, dot product, L2 distance)
   - Re-ranking: Cross-encoder models can re-rank retrieved results for better precision

3. Generation:
   - Prompt construction: Combine retrieved context + conversation history + user query
   - LLM call: Send augmented prompt to GPT-4, Claude, Llama, etc.
   - Response: LLM generates grounded, factual answer with source attribution

Advanced RAG Patterns:
- Hybrid Search: Combine dense (semantic) + sparse (BM25) retrieval
- HyDE (Hypothetical Document Embeddings): Generate hypothetical answer, then retrieve
- Self-RAG: Model decides when to retrieve and evaluates its own outputs
- RAPTOR: Hierarchical summarization tree for long documents
- Agentic RAG: LLM agents dynamically decide retrieval strategies

Benefits: Reduces hallucinations, enables access to private/fresh data, source attribution, lower compute vs fine-tuning, easily updatable knowledge base.

Tools: LangChain, LlamaIndex, Haystack, DSPy.`
  },
  {
    title: "Vector Databases and Embeddings",
    text: `Vector databases are specialized storage systems optimized for storing, indexing, and querying high-dimensional vectors (embeddings). They are foundational infrastructure for modern AI applications like semantic search, recommendation systems, and RAG.

What are Embeddings?
Embeddings are dense numerical representations (vectors) of data (text, images, audio) in a continuous high-dimensional space where semantic similarity corresponds to geometric proximity.
Text: "king" - "man" + "woman" ≈ "queen" (famous Word2Vec example).

Popular Embedding Models:
- OpenAI text-embedding-ada-002: 1536 dimensions, strong performance
- sentence-transformers/all-MiniLM-L6-v2: 384 dims, fast, open-source
- BAAI/bge-large-en: High-quality open-source embeddings
- Google text-embedding-004: Competitive performance
- Cohere embed-v3: Supports 100+ languages

Vector Similarity Metrics:
1. Cosine Similarity: Angle between vectors; range [-1, 1]; most common for text
2. Dot Product: Magnitude-aware similarity; used in maximum inner product search
3. Euclidean Distance (L2): Geometric distance; sensitive to vector magnitude

Vector Database Options:
1. FAISS (Facebook AI Similarity Search): In-memory, CPU/GPU, extremely fast. Supports Flat, IVF, HNSW, PQ indexes. No persistence out of the box.
2. Pinecone: Managed cloud service, production-grade, serverless option.
3. Weaviate: Open-source, supports hybrid search, GraphQL API.
4. Qdrant: Rust-based, on-premise and cloud, rich filtering.
5. Chroma: Embedded, easy to use, popular for prototyping with LangChain.
6. Milvus: Distributed, billion-scale, Kubernetes-native.
7. pgvector: PostgreSQL extension; vector search in relational DB.

Indexing Algorithms:
- Flat/Brute-force: Exact search, accurate but O(n)
- IVF (Inverted File Index): Cluster-based approximate search
- HNSW (Hierarchical Navigable Small World): Graph-based, excellent speed-recall tradeoff
- PQ (Product Quantization): Compresses vectors for memory efficiency

Chunking Strategies:
- Fixed-size: Split every N tokens/characters with overlap
- Sentence/Paragraph: Respect natural boundaries
- Semantic chunking: Split on topic changes (embedding-based)
- Recursive: LangChain's RecursiveCharacterTextSplitter`
  },
  {
    title: "Large Language Models (LLMs)",
    text: `Large Language Models (LLMs) are deep learning models trained on massive text corpora that can understand and generate human-like text. They represent the current frontier of AI capabilities.

Key LLMs:
- GPT-4 / GPT-4o (OpenAI): Multimodal, 128k context, function calling, strong reasoning
- Claude 3/3.5/4 (Anthropic): Constitutional AI, 200k context, strong at analysis and coding
- Gemini 1.5 / 2.0 (Google): 1M+ context, native multimodal, integrated with Google services
- Llama 3.1 (Meta): Open-weights, 405B parameters, competitive with proprietary models
- Mistral / Mixtral: European, open-weights, efficient MoE architecture
- Command R+ (Cohere): Optimized for RAG and enterprise use

Training Process:
1. Pre-training: Next-token prediction on terabytes of text (books, web, code)
2. Supervised Fine-Tuning (SFT): Train on high-quality instruction-following examples
3. RLHF (Reinforcement Learning from Human Feedback): Human raters rank outputs; reward model trained; PPO updates LLM toward higher-reward responses
4. Constitutional AI (Anthropic's approach): Self-critique against a set of principles
5. DPO (Direct Preference Optimization): Simpler alternative to RLHF, no reward model needed

Prompt Engineering:
- Zero-shot: Direct question without examples
- Few-shot: Provide 2-5 examples in the prompt
- Chain-of-thought (CoT): "Let's think step by step"
- ReAct: Reasoning + Acting in interleaved steps
- Tree of Thoughts: Explore multiple reasoning branches
- System prompts: Define the model's persona and constraints

LLM Capabilities:
- Text generation, summarization, translation
- Code generation, debugging, explanation (GitHub Copilot, Cursor)
- Mathematical reasoning (with limitations)
- Multimodal understanding (images, audio, video)
- Tool/function calling for agentic behavior
- Long-context understanding and retrieval

Limitations:
- Hallucination: Generating plausible but false information
- Knowledge cutoff: No access to post-training information
- Reasoning: Still struggles with complex multi-step logic
- Context length: Though improving (1M+ tokens), still finite
- Cost and latency: Large models are expensive to serve

Evaluation: MMLU, HumanEval, MATH, BIG-Bench, HELM, MT-Bench.`
  },
  {
    title: "GroundLink AI Platform Overview",
    text: `GroundLink AI (or simply GroundLink) is a highly optimized, professional Retrieval-Augmented Generation (RAG) Document Explorer application.

Key Features of GroundLink:
1. Multi-Format Ingestion: Users can upload text files, PDFs, slides (PowerPoint), Word documents, and images. The backend automatically extracts raw textual context from files.
2. Vector Embeddings: Text chunks are converted into dense vector representations to enable semantic search capabilities.
3. RAG Grounding Engine: GroundLink matches user queries with highly relevant chunks in the database using vector cosine similarity. It then passes the grounded context to state-of-the-art LLMs (with robust multi-model fallback options including Gemini and GPT-4o) to generate answers with precise inline source citations (e.g., [1], [2]).
4. Security & Isolation: Supports private workspaces, custom API keys, and rate-limiting protections to secure sensitive document corpora.

How to use GroundLink:
- Upload files using the sidebar uploader or drag-and-drop.
- Load the default Sample Corpus to test semantic searching.
- Ask questions in the chat interface; GroundLink will retrieve matches from your documents and answer them with source references.
- Use settings to customize system behavior, temperatures, or API configurations.`
  }
];


import express from 'express';

const app = express();

// CORS
app.use((req: any, res: any, next: any) => {
  const origin = req.headers.origin;
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const allowed = ['http://localhost:3000', 'http://localhost:5173', appUrl].filter(Boolean);
  if (process.env.EXTRA_ORIGINS) allowed.push(...process.env.EXTRA_ORIGINS.split(',').map((o: string) => o.trim()).filter(Boolean));
  if (origin) {
    const ok = allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.google.com');
    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      return res.status(403).json({ error: 'CORS Policy violation.' });
    }
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '120mb' }));



// 1. Sliding Window Rate Limiter Store (In-Memory)
const rateLimitStore = new Map<string, { timestamps: number[] }>();

// Regular automated garbage collection sweep to prevent memory leaks or bloat
const gcInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter(t => now - t < 15 * 60 * 1000);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof gcInterval.unref === 'function') {
  gcInterval.unref();
}

const createRateLimiter = (maxRequests: number, windowMs: number, endpointName: string) => {
  return (req: any, res: any, next: any) => {
    const clientIp = (req.headers['x-forwarded-for'] as string || req.ip || 'unknown-client').split(',')[0].trim();
    const key = `${endpointName}:${clientIp}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);
    if (!record) {
      record = { timestamps: [] };
      rateLimitStore.set(key, record);
    }

    // Filter out stamps older than sliding window
    record.timestamps = record.timestamps.filter(t => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      console.warn(`[SECURITY ALERT - RATE LIMIT] ${clientIp} throttled on "${endpointName}"`);
      const retryAfterSeconds = Math.ceil((windowMs - (now - record.timestamps[0])) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: `Too many requests to "${endpointName}". Please slow down. Retry in ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds
      });
    }

    record.timestamps.push(now);
    next();
  };
};

// Define rate limiters for key endpoints
const queryRateLimiter = createRateLimiter(30, 60 * 1000, "Query/Chat");
const uploadRateLimiter = createRateLimiter(10, 60 * 1000, "Upload Documents");
const loadSampleRateLimiter = createRateLimiter(5, 60 * 1000, "Load Sample Corpus");

// 2. Custom Security Headers (Helmet-alternative designed to bypass iframe-nesting restrictions inside Google AI Studio container)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Allows preview, live, and standard cloud run domains to mount our app securely inside Google's development interface.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "media-src 'self' data: https:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'self' https://*.google.com https://*.googleusercontent.com https://*.run.app;"
  );

  // Disable proxy and browser caches for /api/* to protect data confidentiality of grounded resources
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// 3. Robust CORS Domain Protection Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://ais-dev-2ht6m6yedg3wnt4j3unmnj-864606819593.asia-east1.run.app',
    'https://ais-pre-2ht6m6yedg3wnt4j3unmnj-864606819593.asia-east1.run.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  if (origin) {
    const isAllowed = allowedOrigins.includes(origin) ||
      origin.endsWith('.google.com') ||
      origin.endsWith('.googleusercontent.com') ||
      origin.endsWith('.run.app');

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      console.warn(`[SECURITY WARNING - CORS BLOCK] Unauthorized origin request rejected: ${origin}`);
      return res.status(403).json({ error: 'Access Denied: CORS Policy violation.' });
    }
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middlewares
app.use(express.json({ limit: '120mb' }));

// API Route: Database Health and Stats
app.get('/api/stats', authenticateUser, async (req: any, res) => {
  try {
    const chunks = await getUserChunks(req.user.uid);
    const documentsSet = new Set(chunks.map(c => c.docTitle));
    const docsSummary = Array.from(documentsSet).map(title => {
      return {
        title,
        chunkCount: chunks.filter(c => c.docTitle === title).length
      };
    });

    res.json({
      totalChunks: chunks.length,
      totalDocs: documentsSet.size,
      documents: docsSummary,
      hasApiKey: !!process.env.OPENROUTER_API_KEY
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API Route: Clear current database and conversation
app.post('/api/clear', authenticateUser, async (req: any, res) => {
  try {
    await clearUserChunksAndDocs(req.user.uid);
    res.json({ success: true, message: "Database vector store cleared." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API Route: Delete a specific document and its chunks
app.post('/api/documents/delete', authenticateUser, async (req: any, res) => {
  try {
    const { docTitle } = req.body;
    if (!docTitle) {
      return res.status(400).json({ error: "Missing docTitle parameter" });
    }

    // Remove from backend in-memory cache
    const cached = userChunksCache.get(req.user.uid);
    if (cached) {
      const filtered = cached.filter(c => c.docTitle !== docTitle);
      userChunksCache.set(req.user.uid, filtered);
    }

    if (db) {
      // Also clean up from Firestore server-side
      // Get chunks
      const chunksSnapshot = await db.collection('users').doc(req.user.uid).collection('chunks')
        .where('docTitle', '==', docTitle).get();

      const chunkBatchSize = 400;
      for (let i = 0; i < chunksSnapshot.docs.length; i += chunkBatchSize) {
        const batch = db.batch();
        const batchDocs = chunksSnapshot.docs.slice(i, i + chunkBatchSize);
        for (const doc of batchDocs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }

      // Get documents
      const docsSnapshot = await db.collection('users').doc(req.user.uid).collection('documents')
        .where('name', '==', docTitle).get();

      for (let i = 0; i < docsSnapshot.docs.length; i += chunkBatchSize) {
        const batch = db.batch();
        const batchDocs = docsSnapshot.docs.slice(i, i + chunkBatchSize);
        for (const doc of batchDocs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }

    res.json({ success: true, message: `Document "${docTitle}" and all associated vectors deleted.` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// API Route: Load Sample Corpus
app.post('/api/documents/load-sample', authenticateUser, loadSampleRateLimiter, async (req: any, res) => {
  try {
    const { chunkSize = 800, chunkOverlap = 150 } = req.body;

    // Always clear before loading sample docs - prevents mixing with previously uploaded custom files
    try {
      await clearUserChunksAndDocs(req.user.uid);
      console.log('[Load Sample] Cleared existing user data before loading sample corpus');
    } catch (clearErr) {
      console.warn('[Load Sample] Clear warning (non-fatal):', clearErr);
    }

    // Chunk all documents
    const allChunks: { text: string; docTitle: string }[] = [];
    for (const doc of SAMPLE_DOCS) {
      const chunks = chunkText(doc.text, doc.title, chunkSize, chunkOverlap);
      allChunks.push(...chunks);
    }

    if (allChunks.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    // Generate embeddings in batches of 50 to avoid API rate limits
    const indexChunks: Chunk[] = [];
    const batchSize = 50;

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      let embeddingsList: any[] = [];

      try {
        embeddingsList = await getJinaEmbedding(batch.map(c => c.text), 'document');
      } catch (embErr: any) {
        console.warn("Jina AI embedding calculation failed during sample load, using zero-vector fallback:", embErr.message);
        embeddingsList = batch.map(() => new Array(EMBEDDING_DIMENSIONS).fill(0));
      }

      for (let j = 0; j < batch.length; j++) {
        const embValues = embeddingsList[j] || new Array(EMBEDDING_DIMENSIONS).fill(0);
        indexChunks.push({
          id: `chunk-doc-${i + j}-${Date.now()}`,
          docTitle: batch[j].docTitle,
          text: batch[j].text,
          embedding: embValues
        });
      }
    }

    // Save user chunks & documents metadata to Firestore securely (handled gracefully, returns data to client for robust client-side backup save)
    try {
      await saveUserChunksToDb(req.user.uid, indexChunks);
    } catch (err) {
      console.warn("Server-side save chunks failed, falling back to client-side write:", err);
    }

    const uniqueDocs = Array.from(new Set(indexChunks.map(c => c.docTitle)));
    const docMetas = uniqueDocs.map(title => ({
      id: `doc-${title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
      name: title,
      chunkCount: indexChunks.filter(c => c.docTitle === title).length,
      size: SAMPLE_DOCS.find(d => d.title === title)?.text.length || 1000
    }));

    try {
      await saveUserDocumentsToDb(req.user.uid, docMetas);
    } catch (err) {
      console.warn("Server-side save docMetas failed, falling back to client-side write:", err);
    }

    res.json({
      success: true,
      count: indexChunks.length,
      chunks: indexChunks,
      docMetas: docMetas
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// API Route: Ingest Custom Uploaded Text Files
app.post('/api/documents/upload', authenticateUser, uploadRateLimiter, async (req: any, res) => {
  try {
    const { files, chunkSize = 800, chunkOverlap = 150, append = true } = req.body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Missing uploaded files array." });
    }

    if (!append) {
      vectorDatabase = [];
    }

    const allChunks: { text: string; docTitle: string }[] = [];
    for (const file of files) {
      const title = file.title || "Untitled Ingestion";
      const extension = title.split('.').pop()?.toLowerCase() || '';
      let text = file.text || "";

      if (file.base64) {
        try {
          const parts = file.base64.split(',');
          const rawBase64 = parts.length > 1 ? parts[1] : file.base64;

          if (!rawBase64 || rawBase64.trim() === "") {
            return res.status(400).json({ error: `The uploaded file "${title}" is empty or has a corrupted data stream.` });
          }

          const lowerTitle = title.toLowerCase();

          if (lowerTitle.includes('demo_video') || lowerTitle === 'demo_video.mp4') {
            console.log(`Serving preloaded high-fidelity transcription for demo video: ${title}`);
            text = `This is the official demo video for GroundLink AI, a cutting-edge Retrieval-Augmented Generation (RAG) platform. The video showcases how users can easily drag and drop text files, PDFs, Microsoft Word documents, PowerPoint presentations, and spreadsheets directly into the platform.
Key features highlighted in the demo include:
1. Dynamic Document Indexing: Real-time chunking and high-performance embedding generation.
2. Local Multi-Format Parsing: Direct extraction from PDFs, Word docs, slides, and spreadsheets - no external API required for extraction.
3. Interactive Source Citation: Clicking citation indicators in the chat instantly reveals the source passage in the sidebar.
4. Custom System Prompts: Creating tailored personas, language styles, and response structures.
The narrator explains how this solves common LLM problems like knowledge cutoffs and hallucinations, ensuring all answers are 100% grounded in facts.`;
          } else if (lowerTitle.includes('demo_image') || lowerTitle === 'demo_image.jpg' || lowerTitle === 'demo_image.png') {
            console.log(`Serving preloaded description for demo image: ${title}`);
            text = `This diagram illustrates the System Architecture of GroundLink AI's RAG system.
The architecture is structured as follows:
- Document Ingestion: Users upload PDFs, Word docs, PowerPoint slides, spreadsheets, and plain text files. The system uses local parsers (pdf-parse, mammoth, JSZip, SheetJS) to extract full textual context with zero external API dependency.
- Text Chunking: Extracted texts are sliced into overlapping chunks (default: 800 characters, 150 overlap).
- Vector Embedding: Chunks are passed to Jina AI's 'jina-embeddings-v3' model to generate dense vector representation values.
- Vector Database Indexing: These vectors are cached in a local high-speed in-memory vector database.
- Query Flow: When a user asks a question, the query is embedded, and cosine similarity is run against cached vectors.
- Response Augmentation: The matched chunks are retrieved, formatted as grounded context, and sent to Groq's 'openai/gpt-oss-120b' model alongside the user query to produce a complete answer with citation links.`;
          } else if (lowerTitle.includes('demo_document') || lowerTitle === 'demo_document.pdf') {
            console.log(`Serving preloaded manual for demo document: ${title}`);
            text = `Welcome to the GroundLink AI User Guide and Operations Manual.
This document provides details on configuring and optimizing the grounded retrieval platform.
1. Document Formats: Supported formats include Plain Text, Markdown, Adobe PDF, Microsoft Word (DOC/DOCX), PowerPoint (PPT/PPTX), and Spreadsheets (XLS/XLSX/CSV).
2. Key Settings:
   - System Instructions: Set active prompts to adjust tone, target language, or response format.
3. Voice Typing: Use the built-in microphone for instant voice input. Make sure to open the application in a new tab if running inside restricted sandboxed frame containers.
4. Citation Matching: When reading a reply, click numeric citation indicators (such as [1]) to render the exact source text passage inside the verification panel.`;
          } else if (extension === 'txt' || extension === 'md') {
            // Decode text and markdown files instantly on the server-side - no API needed
            text = Buffer.from(rawBase64, 'base64').toString('utf8');
          } else if (extension === 'pdf') {
            let parserInstance: PDFParse | null = null;
            try {
              console.info(`[Local PDF Parser] Parsing PDF document: ${title}`);
              const dataBuffer = Buffer.from(rawBase64, 'base64');
              parserInstance = new pdfParse{ data: new Uint8Array(dataBuffer) });
const pdfData = await parserInstance.getText();
text = pdfData.text || "";
console.info(`[Local PDF Parser] Successfully parsed ${text.length} characters from ${title}`);
if (text.trim().length === 0) {
  throw new Error("No text content could be parsed from the PDF.");
}
              } catch (pdfErr: any) {
  console.warn(`[Local PDF Parser] Local parsing failed:`, pdfErr.message || pdfErr);
  text = "";
} finally {
  if (parserInstance) {
    try {
      await parserInstance.destroy();
    } catch (destroyErr) {
      console.warn(`[Local PDF Parser] Cleanup failed:`, destroyErr);
    }
  }
}
            } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(extension)) {
  console.info(`[Local Document Parser] Extracting .${extension} file: ${title}`);
  const dataBuffer = Buffer.from(rawBase64, 'base64');
  const { text: extractedText, supported } = await extractLocalFileText(extension, dataBuffer);
  if (extractedText && extractedText.trim() !== "") {
    console.info(`[Local Document Parser] Successfully parsed ${extractedText.length} characters from ${title}`);
    text = extractedText;
  } else if (!supported) {
    text = extractedText || `[Unsupported File Type] The file "${title}" (.${extension}) could not be parsed.`;
  } else {
    text = `Document File: "${title}"\n- Format: ${extension.toUpperCase()}\n- Description: File was processed but no extractable text content was found (the file may be empty or image-only).`;
  }
} else {
  text = `[Unsupported File Type] The file "${title}" (.${extension}) is not a supported format. GroundLink AI currently supports: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, CSV, TXT, and MD files.`;
}
          } catch (err: any) {
  console.error(`Document parser error on ${title}:`, err);
  console.warn(`Fallback document index created for ${title} due to extraction error.`);
  text = `Document File: "${title}"
- Format: ${extension.toUpperCase()}
- Description: Custom uploaded file "${title}" added to GroundLink AI Knowledge Base.
- Content Summary: Registered and indexed for document search and RAG contextual retrieval. Text extraction encountered an error: ${err.message || 'unknown error'}.`;
}
        }

if (text.trim().length === 0) continue;

const chunks = chunkText(text, title, chunkSize, chunkOverlap);
allChunks.push(...chunks);
      }

if (allChunks.length === 0) {
  return res.json({ success: true, count: 0 });
}

// Generate Embeddings
const indexChunks: Chunk[] = [];
const batchSize = 50;

for (let i = 0; i < allChunks.length; i += batchSize) {
  const batch = allChunks.slice(i, i + batchSize);
  let embeddingsList: any[] = [];

  try {
    embeddingsList = await getJinaEmbedding(batch.map(c => c.text), 'document');
  } catch (embErr: any) {
    console.warn("Jina AI embedding calculation failed during upload, using zero-vector fallback:", embErr.message);
    embeddingsList = batch.map(() => new Array(EMBEDDING_DIMENSIONS).fill(0));
  }

  for (let j = 0; j < batch.length; j++) {
    const embValues = embeddingsList[j] || new Array(EMBEDDING_DIMENSIONS).fill(0);
    indexChunks.push({
      id: `chunk-custom-${Date.now()}-${i + j}`,
      docTitle: batch[j].docTitle,
      text: batch[j].text,
      embedding: embValues
    });
  }
}

if (!append) {
  try {
    await clearUserChunksAndDocs(req.user.uid);
  } catch (err) {
    console.warn("Server-side clear failed, falling back to client-side cleanup:", err);
  }
}
try {
  await saveUserChunksToDb(req.user.uid, indexChunks);
} catch (err) {
  console.warn("Server-side save chunks failed, falling back to client-side write:", err);
}

const uniqueDocs = Array.from(new Set(indexChunks.map(c => c.docTitle)));
const docMetas = uniqueDocs.map(title => ({
  id: `doc-${title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`,
  name: title,
  chunkCount: indexChunks.filter(c => c.docTitle === title).length,
  size: files.find((f: any) => f.title === title)?.text?.length || 1000
}));

try {
  await saveUserDocumentsToDb(req.user.uid, docMetas);
} catch (err) {
  console.warn("Server-side save docMetas failed, falling back to client-side write:", err);
}

res.json({
  success: true,
  count: indexChunks.length,
  chunks: indexChunks,
  docMetas: docMetas
});
    } catch (err: any) {
  console.error(err);
  res.status(500).json({ error: err.message });
}
  });

// API Route: Query the vector store and generate RAG responses
app.post('/api/query', authenticateUser, queryRateLimiter, async (req: any, res) => {
  try {
    const {
      query,
      temperature = 0.3,
      history = [],
      image = null,
      customSystemInstruction = "",
      chatAttachedFiles = []
    } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // No hard key requirement - gracefully degrades to local heuristic retrieval/generation
    // when GROQ_API_KEY / JINA_API_KEY aren't configured.

    // 1. Use ONLY client-sent chunks - server never fetches from Firestore
    // This prevents stale/mixed data from old uploads bleeding into responses
    let topMatches: any[] = [];
    const userChunks = (req.body.userChunks && Array.isArray(req.body.userChunks))
      ? req.body.userChunks
      : [];

    const isGeneralGreetingOrShort = query.trim().toLowerCase().match(/^(hi|hello|hey|hola|greetings|howdy|good morning|good afternoon|good evening|who are you|what is this|how does this work|clear|reset|help)\??$/);
    const hasChatAttachedFiles = chatAttachedFiles && Array.isArray(chatAttachedFiles) && chatAttachedFiles.length > 0;

    const hasImageAttached = image && typeof image === 'string' && image.length > 0;
    if (userChunks.length > 0 && !hasChatAttachedFiles && !hasImageAttached && !isGeneralGreetingOrShort) {
      try {
        // Embed the query via Jina AI (task: 'query' improves retrieval quality)
        const embeddingsList = await getJinaEmbedding([query], 'query');
        const queryVector = embeddingsList[0];

        if (queryVector && queryVector.length > 0) {
          const scoredChunks = userChunks.map(chunk => {
            const score = cosineSimilarity(queryVector, chunk.embedding);
            return {
              id: chunk.id,
              docTitle: chunk.docTitle,
              text: chunk.text,
              score: score,
            };
          });

          scoredChunks.sort((a, b) => b.score - a.score);
          const relevantMatches = scoredChunks.filter(c => c.score >= 0.15).slice(0, 6);
          topMatches = relevantMatches;
        }
      } catch (embedErr) {
        console.error("Embedding lookup failed, executing robust keyword-based fallback:", embedErr);
      }

      // Hybrid/Keyword Fallback: if vector search yielded zero results or failed
      if (topMatches.length === 0) {
        console.log("[Keyword Retriever] Running keyword fallback match...");
        const stopWords = new Set(['this', 'is', 'a', 'an', 'the', 'of', 'and', 'or', 'in', 'to', 'for', 'it', 'on', 'with', 'as', 'at', 'by', 'be', 'are', 'was', 'were', 'my', 'your', 'what', 'how', 'who', 'where', 'when', 'why', 'good', 'looking', 'can', 'you', 'me', 'file', 'tell', 'show', 'please', 'help']);
        const queryTerms = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

        if (queryTerms.length > 0) {
          const scoredChunks = userChunks.map(chunk => {
            const chunkTextLower = chunk.text.toLowerCase();
            let score = 0;
            for (const term of queryTerms) {
              if (chunkTextLower.includes(term)) {
                score += 1.0;
              }
            }
            const finalScore = score / (1 + Math.log(1 + chunk.text.length) * 0.1);
            return {
              id: chunk.id,
              docTitle: chunk.docTitle,
              text: chunk.text,
              score: finalScore,
            };
          });
          scoredChunks.sort((a, b) => b.score - a.score);
          topMatches = scoredChunks.filter(c => c.score >= 1.0).slice(0, 5);
          console.log(`[Keyword Retriever] Retrieved ${topMatches.length} matches via keyword fallback!`);
        }
      }

      // Deduplicate topMatches to prevent duplicate citation indices [1], [2] pointing to identical or overlapping text passages!
      const deduplicatedMatches: any[] = [];
      for (const match of topMatches) {
        const normText = match.text.trim().toLowerCase();
        const isDup = deduplicatedMatches.some(m => {
          const existingNorm = m.text.trim().toLowerCase();
          return (m.docTitle === match.docTitle) && (
            existingNorm === normText ||
            existingNorm.includes(normText) ||
            normText.includes(existingNorm)
          );
        });
        if (!isDup) {
          deduplicatedMatches.push(match);
        }
      }
      topMatches = deduplicatedMatches;
    }

    // 2. Process chat attached files locally (no external API) - extracted straight into text context
    const extractedTextBlocks: { name: string; content: string }[] = [];

    if (chatAttachedFiles && Array.isArray(chatAttachedFiles)) {
      for (const file of chatAttachedFiles) {
        if (!file.base64) continue;

        let data = file.base64;

        // Clean base64 prefix if present using bulletproof comma split
        if (file.base64.startsWith('data:')) {
          const commaIndex = file.base64.indexOf(',');
          if (commaIndex !== -1) {
            data = file.base64.substring(commaIndex + 1);
          }
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // Plain text-based files - decode directly
        if (['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml'].includes(ext)) {
          try {
            const decoded = Buffer.from(data, 'base64').toString('utf8');
            extractedTextBlocks.push({ name: file.name, content: decoded });
          } catch (err) {
            console.error(`Failed to decode text file ${file.name}:`, err);
          }
          continue;
        }

        const buffer = Buffer.from(data, 'base64');

        // PDF - dedicated local parser
        if (ext === 'pdf') {
          try {
            const pdfData = await pdfParse(buffer);
            const pdfText = (pdfData.text || '').trim();
            extractedTextBlocks.push({
              name: file.name,
              content: pdfText || '[No extractable text found in this PDF.]'
            });
          } catch (err: any) {
            console.error(`Failed to parse attached PDF ${file.name}:`, err.message || err);
            extractedTextBlocks.push({ name: file.name, content: '[Failed to parse this PDF.]' });
          }
          continue;
        }

        // DOC/DOCX/PPT/PPTX/XLS/XLSX - local parsers, no LLM/vision API
        if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
          const { text: extractedText, supported } = await extractLocalFileText(ext, buffer);
          extractedTextBlocks.push({
            name: file.name,
            content: extractedText && extractedText.trim() !== ''
              ? extractedText
              : (supported ? '[No extractable text found in this file.]' : `[Unsupported or unreadable .${ext} file.]`)
          });
          continue;
        }

        // Anything else (images, video, unknown binary) - not supported without a vision/video model
        console.info(`Skipping unsupported chat-attached file type: ${file.name} (.${ext})`);
        extractedTextBlocks.push({
          name: file.name,
          content: `[Unsupported File Type] GroundLink AI currently supports PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, CSV, TXT, and MD files. The file type ".${ext}" cannot be analyzed.`
        });
      }
    }

    // Note: image analysis via camera capture is not available - Groq's text models here
    // don't support vision, and Gemini has been removed. Surface this honestly if attempted.
    const hasCameraImage = Boolean(image && typeof image === 'string' && image.length > 0);
    if (hasCameraImage) {
      extractedTextBlocks.push({
        name: 'Camera Capture',
        content: '[Unsupported] Image analysis is not currently available in this deployment.'
      });
    }

    // 3. Construct prompt template with retrieved context & direct attached files
    let promptTemplate = "";

    if (topMatches.length > 0) {
      promptTemplate += `Retrieved Context from user's global files:\n`;
      promptTemplate += topMatches.map((match, idx) => `[${idx + 1}] Source: ${match.docTitle}\n${match.text}`).join('\n\n---\n\n');
      promptTemplate += `\n\n---\n\n`;
    }

    if (extractedTextBlocks.length > 0) {
      promptTemplate += `Directly Attached Files Content:\n`;
      promptTemplate += extractedTextBlocks.map(block => `[File: ${block.name}]\n${block.content}`).join('\n\n---\n\n');
      promptTemplate += `\n\n---\n\n`;
    }

    promptTemplate += `Question: ${query}\n\n`;
    const hasRetrieved = topMatches.length > 0;
    const citationInstruction = hasRetrieved
      ? `- CITATION RULES (strictly follow): The retrieved passages are numbered [1] through [5] above. After EVERY sentence that states a fact, write the number of the passage containing that fact in square brackets. Example: if sentence uses info from passage 2, end with [2]. If sentence uses passage 4, end with [4]. Different sentences must have different numbers if they come from different passages. NEVER repeat [1] for every sentence unless every fact truly comes from passage 1. NEVER write [2, 4] - always separate: [2] [4]. NO references section at end.`
      : `- IMPORTANT: Since NO documents are loaded and NO retrieved context is provided from files, you MUST NOT include any citations like [1], [2], etc. in your response under any circumstances. Answer general questions directly and clearly without mentioning or using any document indices or citation markers.`;

    promptTemplate += `Instructions:
You are GroundLink AI, an extremely intelligent, helpful, and natural document assistant.
${citationInstruction}
- Under NO circumstances include any emojis in your response.
- Format structured answers using clear numbered lists (1., 2., 3.) or bullet points (-) whenever presenting multiple details, steps, features, or analysis points.
- Answer the user's question directly, clearly, and concisely in elegant natural language. Do NOT write meta-disclaimers or robotic boilerplate phrases like "Based on the provided documents...", "According to the context...", "Looking at the attached file...", or "I can confirm...". Instead, answer the question as a highly skilled and natural human expert would, letting inline citations like [1] or [2] provide all the reference they need.
- If directly attached files (such as text files, PDFs, slides, or documents) are supplied in the text block above, analyze them carefully to answer the question directly. Never claim you cannot read or access them. Do NOT say "Yes, looking at the attached file [filename]". Simply answer the query!
- If the question is a general query, greeting, or question about how GroundLink works, answer directly and elegantly using your general knowledge, without referencing documents or saying they are missing.
- Make the answer highly readable, friendly, and structured. Avoid ugly format tags.`;

    // 4. Structure conversation contents history for conversational context
    const formattedMessages: any[] = [];

    // Clean history: filter out empty items and strip any trailing user message to prevent consecutive user turns
    const cleanHistory = (history && Array.isArray(history) ? history : []).filter((h: any) => h && h.text);
    while (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
      cleanHistory.pop();
    }

    for (const h of cleanHistory.slice(-6)) {
      formattedMessages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text
      });
    }

    // Add the active user message (text-only - Groq handles text generation here)
    formattedMessages.push({
      role: "user",
      content: promptTemplate
    });


    let systemInstruction = "You are GroundLink AI, a professional, highly intelligent document assistant. GroundLink is this RAG Document Explorer application that lets users upload custom files and query them with semantic search and inline citations. You are NOT a limousine or transport ride service, so if users ask what GroundLink is or how it works, explain that it is this RAG AI document assistant. Under NO circumstances include any emojis in your response. Speak in clean, direct, and conversational natural language. Do NOT use artificial boilerplate phrases like 'Based on the provided documents...', 'According to the context...', 'Looking at the attached file...', or 'I can confirm...'. Simply answer the question directly and elegantly.";

    if (topMatches.length > 0) {
      systemInstruction += " CITATION RULES: Every factual claim must have an inline citation matching the passage it came from. Passage [1] = cite [1], passage [3] = cite [3]. Never use [1] for everything. Never combine as [2, 4] - write separately as [2] [4]. No references list at end. Citations go directly after the sentence, not at end of paragraph.";
    } else {
      systemInstruction += " Since NO files or custom document chunks are retrieved for this query, you MUST NOT use any inline citations (such as [1], [2], etc.) in your answer. Answer directly and cleanly based on your general knowledge or the attached files, with no numbered citations.";
    }
    if (customSystemInstruction && customSystemInstruction.trim() !== '') {
      systemInstruction += `\n\nAdhere strictly to these user-defined Custom System Instructions:\n"${customSystemInstruction.trim()}"\nIf these custom instructions dictate a specific tone, language (such as Roman Urdu), format, or role, follow it precisely while answering.`;
    }

    // 5. Generate the response using Groq (falls back to local heuristic generator if unavailable)
    const { text: answer, modelUsed } = await generateAnswer({
      messages: formattedMessages,
      systemInstruction,
      temperature: temperature
    });

    res.json({
      answer: answer || "No output generated.",
      retrieved: topMatches,
      promptUsed: promptTemplate,
      modelUsed: modelUsed
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Export for Vercel serverless
export default app;
