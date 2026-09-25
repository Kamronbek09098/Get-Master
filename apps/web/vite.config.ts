import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const PANELS: Record<string, { label: string; color: string }> = {
  CUSTOMER: { label: 'Mijoz paneli', color: '#155DFC' },
  MASTER: { label: 'Usta paneli', color: '#0E9F6E' },
  ADMIN: { label: 'Admin paneli', color: '#B42318' },
};

export default defineConfig(({ mode }) => {
  const role = loadEnv(mode, process.cwd(), '').VITE_APP_ROLE;
  const panel = PANELS[role];

  return {
    plugins: [
      react(),
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
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  };
});
