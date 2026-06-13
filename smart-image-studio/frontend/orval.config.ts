import { defineConfig } from 'orval';

export default defineConfig({
  apiTypes: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.types.ts',
      override: {
        useTypeOverInterfaces: true,
      },
    },
  },
  apiSchemas: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.schemas.ts',
      client: 'zod',
    },
  },
});
