import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `resources/` is an archive of zips, extracted third-party drops, and
  // briefing docs. Nothing under src/ imports from it and it is not the Vite
  // publicDir, so it never reaches a bundle — linting it only produced noise
  // from code we do not ship or maintain.
  globalIgnores(['dist', 'resources']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // caughtErrorsIgnorePattern: `catch (_)` is the other half of the
      // best-effort-teardown idiom allowed by no-empty below — the binding is
      // named `_` precisely because it is never inspected.
      // ignoreRestSiblings: `const { tag, key, ...attrs } = desc` names a
      // property precisely so the rest object does NOT contain it. Reporting
      // those bindings as unused invites a "fix" that reintroduces the
      // property — in descToEl that would write key= onto the SVG element.
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      // Best-effort teardown (`try { node.stop() } catch (_) {}`) is a
      // deliberate idiom in the audio and device code, where a failed stop on
      // an already-dead node is not worth handling.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Vercel serverless functions run in Node, not the browser
    files: ['api/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Build/tooling config runs in Node, not the browser
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
