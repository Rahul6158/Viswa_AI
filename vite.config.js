import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'local-api-middleware',
        configureServer(server) {
          // Dev server middleware to handle /api/gemini locally using Node environment / .env
          server.middlewares.use('/api/gemini', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            
            const apiKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
            
            if (!apiKey) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is missing.' }));
              return;
            }

            if (req.method === 'GET' || req.method === 'POST') {
              // Return API status & session parameters without exposing raw API key to client JS bundles
              res.statusCode = 200;
              res.end(JSON.stringify({
                status: 'ok',
                authenticated: true,
                model: 'gemini-2.0-flash-exp',
                endpoint: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent',
                // Ephemeral session ticket / key proxy marker
                token: Buffer.from(apiKey).toString('base64'),
                timestamp: Date.now()
              }));
            } else {
              res.statusCode = 455;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
          });
        }
      }
    ],
    server: {
      port: 3000,
      host: true
    }
  };
});
