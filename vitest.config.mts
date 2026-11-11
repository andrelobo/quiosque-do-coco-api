import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // esbuild não emite `design:type`; o SWC emite, o que é obrigatório para
    // os decorators do Nest e para o SchemaFactory do @nestjs/mongoose.
    swc.vite(),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/seed/**'],
    },
  },
});
