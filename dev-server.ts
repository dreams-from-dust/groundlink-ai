import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

async function start() {
  try {
    const mod = await import('./api/index.ts');
    const app = mod.default;
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n✅ GroundLink AI API running at http://localhost:' + PORT);
      console.log('   Open UI at http://localhost:5173\n');
      if (!process.env.GROQ_API_KEY) console.warn('WARNING: GROQ_API_KEY not set (chat generation will use local heuristic fallback)');
      else console.log('OK: GROQ_API_KEY loaded');
      if (!process.env.JINA_API_KEY) console.warn('WARNING: JINA_API_KEY not set (embeddings will use local heuristic fallback)');
      else console.log('OK: JINA_API_KEY loaded');
    });
  } catch (err: any) {
    console.error('\n❌ Failed to start:', err.message);
    process.exit(1);
  }
}
start();
