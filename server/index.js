import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import router from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// In dev mode (NODE_ENV not set), use 3001 so Vite can proxy to it
// In production (Railway sets PORT), use that
const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 3001) : 3001;

app.use(cors());
app.use(express.json());
app.use('/api', router);

// In production, serve the built React app
const distPath = join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // Catch-all: serve index.html for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rapid Hot server running on http://0.0.0.0:${PORT}`);
});
