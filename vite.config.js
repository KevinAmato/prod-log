import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA. No server, no env secrets — the user's Anthropic key lives only
// in their browser (localStorage). Build output in /dist is deployed as-is to
// any free static host (Cloudflare Pages, GitHub Pages, Netlify).
export default defineConfig({
  plugins: [react()],
  // Cloudflare Pages / Netlify / a custom domain serve from the root, so the
  // default base "/" is correct there. GitHub Pages serves from
  // /<repo>/ — set BASE_PATH=/diligence/ (or your repo name) for that build:
  //   BASE_PATH=/diligence/ npm run build
  base: process.env.BASE_PATH || '/',
});
