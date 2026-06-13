import { defineConfig } from 'orval';

export default defineConfig({
  apiTypes: {
    input: '../docs/openapi.json',
    output: {
      mode: 'single',
      target: './src/shared/api/__generated__/api.types.ts',
      // 'fetch' avoids an axios dependency. Orval always generates fetch wrapper functions
      // alongside types — there is no types-only mode. The generated functions are used
      // in jobApi.ts via the customFetch mutator below.
      client: 'fetch',
      override: {
        useTypeOverInterfaces: true,
        mutator: {
          path: './src/shared/api/mutator.ts',
          name: 'customFetch',
        },
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
