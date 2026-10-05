import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';

function minifyServiceWorker() {
  return {
    name: 'minify-service-worker',
    apply: 'build',
    async closeBundle() {
      const source = await readFile(new URL('./public/sw.js', import.meta.url), 'utf8');
      const result = await transform(source, {
        minify: true,
        legalComments: 'none',
        target: 'es2020'
      });
      await writeFile(new URL('./dist/sw.js', import.meta.url), result.code, 'utf8');
    }
  };
}

function preserveCloudflareBypass() {
  return {
    name: 'preserve-cloudflare-bypass',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<script\s+type="module"(?![^>]*data-cfasync)/g,
        '<script type="module" data-cfasync="false"'
      );
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'mobile' && !/^https:\/\//i.test(String(env.VITE_API_BASE_URL || ''))) {
    throw new Error('Mobile builds require VITE_API_BASE_URL to be an HTTPS production URL');
  }
  return {
    plugins: [react(), minifyServiceWorker(), preserveCloudflareBypass()],
    server: { port:3000, proxy: { '/api':{ target:'http://localhost:5000', changeOrigin:true }, '/uploads':{ target:'http://localhost:5000', changeOrigin:true } } },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: true
    }
  };
});
