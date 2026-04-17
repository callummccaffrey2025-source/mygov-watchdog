import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**']
  }
});
