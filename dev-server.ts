// dev-server.ts — Local development only. NOT used in Vercel production.
// Wraps api/index.ts (the Express app) and runs it on PORT 3000.
// Vite dev server runs separately on 5173 with /api proxy → 3000.
//
// Run with: npm run dev:api   (in one terminal)
//       and: npm run dev:ui    (in another terminal)
// Or use:    npm run dev       (runs both concurrently)

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local first
dotenv.config({ path: '.env.local' });
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Dynamically import the Express app from api/index.ts
const { default: app } = await import('./api/index.ts');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ GroundLink AI API running at http://localhost:5173/`);
  console.log(`   Open the UI at http://localhost:5173  (npm run dev:ui)\n`);
});
