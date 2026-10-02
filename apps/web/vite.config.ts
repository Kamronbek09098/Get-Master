import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';

const PANELS: Record<string, { label: string; color: string }> = {
  CUSTOMER: { label: 'Mijoz paneli', color: '#155DFC' },
  MASTER: { label: 'Usta paneli', color: '#0E9F6E' },
  ADMIN: { label: 'Admin paneli', color: '#B42318' },
};

/** Frontend uchun Content-Security-Policy: faqat o‘z manbalar, API va kerakli tashqi xizmatlar (xarita, shriftlar). */
function buildCsp(html: string, apiBase: string | undefined): string {
  let apiOrigin = '';
  try {
    if (apiBase) apiOrigin = new URL(apiBase).origin;
  } catch {
    /* noto‘g‘ri URL — faqat 'self' */
  }
  // Index.html ichidagi inline mavzu skripti hash bilan ruxsat etiladi (unsafe-inline kerak emas).
  const inlineHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1] ?? '').digest('base64')}'`);
  return [
    "default-src 'self'",
    `script-src 'self' https://accounts.google.com ${inlineHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: https: ${apiOrigin}`.trim(),
    `media-src 'self' blob: https: ${apiOrigin}`.trim(),
    `connect-src 'self' https://accounts.google.com ${apiOrigin}`.trim(),
    "frame-src https://accounts.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const role = env.VITE_APP_ROLE;
  const panel = PANELS[role];

  return {
    plugins: [
      react(),
      {
        // Faqat production build: dev serverda HMR uchun CSP qo‘yilmaydi.
        name: 'getmaster-csp',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler: (html: string) =>
            html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${buildCsp(html, env.VITE_API_BASE_URL)}" />`),
        },
      },
      {
        name: 'getmaster-panel',
        transformIndexHtml: (html: string) =>
          panel
            ? html
                .replace('<title>GetMaster</title>', `<title>GetMaster — ${panel.label}</title>`)
                .replace('content="#155DFC"', `content="${panel.color}"`)
                .replace('<html ', `<html data-panel="${role}" `)
            : html,
        configureServer(server) {
          if (!panel) return;
          server.httpServer?.once('listening', () => {
            setTimeout(() => console.log(`\n  ➜  ${panel.label.toUpperCase()} (${role})\n`), 50);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    // Production'da kod minifikatsiya qilinadi, source map chiqarilmaydi, console/debugger olib tashlanadi.
    esbuild: mode === 'development' ? undefined : { drop: ['console', 'debugger'], legalComments: 'none' },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  };
});
