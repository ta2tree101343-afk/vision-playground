import { defineConfig } from 'orval';

export default defineConfig({
  apiTypes: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.types.ts',
      // 'fetch' avoids an axios dependency. Orval always generates fetch wrapper functions
      // alongside types — there is no types-only mode. The generated functions are unused
      // dead code; use shared/api/jobApi.ts for all HTTP calls.
      client: 'fetch',
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
      override: {
        zod: {
          generateReusableSchemas: true,
        },
      },
    },
  },
});
