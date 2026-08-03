import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 터미널 테마(기본 테마)의 실제 색상에 맞춘 PWA 브랜드 컬러.
// src/themes/terminal/terminal.css의 --term-bg / --term-accent 참조.
const TERM_BG = '#0b0c0f';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // base가 상대경로('./')이므로 start_url/scope도 상대경로로 고정해
      // GitHub Pages 서브패스(/agent-typer/)에서도 manifest.webmanifest와
      // 같은 디렉터리를 기준으로 올바르게 해석되게 한다.
      manifest: {
        name: 'AgentTyper',
        short_name: 'AgentTyper',
        description: '일하는 것처럼 보이는 타자연습',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: TERM_BG,
        theme_color: TERM_BG,
        lang: 'ko',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
