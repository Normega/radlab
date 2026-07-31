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

      // ── React Compiler diagnostics: warn, not error ───────────────────────
      //
      // eslint-plugin-react-hooks v7's `recommended` preset turns on ~15 rules
      // beyond the classic two, most at error. They are React Compiler
      // *preconditions*: the compiler auto-memoizes components and must prove
      // each one is pure and idempotent to do so safely. We do not run the
      // compiler (vite.config.js is a bare `react()` — no
      // babel-plugin-react-compiler), so none of these change runtime
      // behaviour today.
      //
      // Only the rules we currently violate are demoted; the rest keep their
      // default error severity and act as free guards, since a new violation
      // would then be the only error in the output. That is the whole point:
      // at 0 errors, a red lint means "you just broke something", which is
      // what makes the CI gate in .github/workflows/ci.yml meaningful. With 94
      // permanent errors it meant nothing, and real bugs hid in the noise for
      // months (see website.md on issueLink and the Ebb & Flow aggregates).
      //
      // These stay reported and stay countable. If the React Compiler is ever
      // adopted, flip these back to error and the backlog is unchanged.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      // Deliberately NOT demoted: react-hooks/rules-of-hooks and
      // react-hooks/set-state-in-render. Both are genuine correctness rules
      // (broken hook order; render-phase setState loops) and both are at zero
      // violations, so keeping them at error costs nothing and guards a real
      // footgun.

      // Fast Refresh reliability in dev only — never a production concern.
      'react-refresh/only-export-components': 'warn',
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
