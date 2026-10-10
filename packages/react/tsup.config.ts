import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'tsup';

const USE_CLIENT = '"use client";';
const OUT_DIR = 'dist';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: OUT_DIR,
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  // ESM splitting keeps the default markdown renderer (react-markdown +
  // remark-gfm) in its own lazily-imported chunk.
  splitting: true,
  external: ['react', 'react-dom'],
  // esbuild drops module-level directives when it bundles, so the
  // 'use client' at the top of each src/*.tsx file never reaches the entry
  // in dist/. Without it, importing <BookingInline> or <ClndrProvider> into
  // a Next.js App Router Server Component crashes (hooks / createContext on
  // the server). Put it back at the top of every emitted JS file.
  banner: { js: USE_CLIENT },
  // With `splitting`, tsup builds the CJS output as ESM and converts it with
  // sucrase, which inserts its `"use strict"` + interop helpers *in front of*
  // the banner — leaving the directive mid-file, where it is a no-op string.
  // Hoist it back to line 1 (and drop the duplicate esbuild keeps in chunks
  // whose source file already starts with 'use client').
  async onSuccess() {
    for (const name of await readdir(OUT_DIR)) {
      if (!/\.m?js$/.test(name)) continue;
      const file = path.join(OUT_DIR, name);
      const code = await readFile(file, 'utf8');
      const body = code.replace(/(?<=^|[;}\n])"use client";\n?/g, '');
      await writeFile(file, `${USE_CLIENT}\n${body}`);
    }
  },
});
