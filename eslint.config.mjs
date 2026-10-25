import js from '@eslint/js';
import parser from '@typescript-eslint/parser';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.vite/**', '.claude/**', 'test-results/**'] },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      ...js.configs.recommended.rules,
      // TypeScript checks name resolution and declaration merging. Unused-declaration cleanup is a separate policy.
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'max-len': [
        'error',
        {
          code: 120,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: true,
        },
      ],
    },
  },
];
