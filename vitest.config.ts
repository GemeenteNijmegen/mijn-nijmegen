import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.mustache'],
  test: {
    root: __dirname, // When we run test directly from a file or from a dir a reports.json is created in node_modules. Setting this makes sure the file is not in the way as it is anoying.
    environment: 'node',
    coverage: {
      enabled: false // TODO maybe later we want coverage
    },
    globals: false, // I think this is a better practice (importing what we need instead of relying on globals)
    setupFiles: ['./test/setup.ts']
  },
});