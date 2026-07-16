/** @type {import('tailwindcss').Config} */
// Design tokens per RADlab-Onboarding-Redesign-V1-Dev-Spec.md §1 (+ gate decisions
// in design-audit/DRIFT-REPORT.md §9). Values mirror the CSS custom properties in
// src/index.css — keep the two in sync.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Onboarding Redesign v1 tokens (Dev Spec §1.1) ──
        base:             '#FCF0F5',
        surface:          '#FFFFFF',
        tint:             '#FBEAF3',
        primary:          '#F068A4',
        'primary-dark':   '#C04A82',
        'text-main':      '#1C1C1E',
        'text-secondary': '#6B6C70',
        'text-muted':     '#ABADB0',
        // Semantic error set (DRIFT-REPORT §9 Q2) — from the auth-page error boxes
        'error-bg':     '#FCEBEB',
        'error-border': '#F09595',
        'error-text':   '#A32D2D',
        // ── Legacy aliases (pre-redesign) — same values, kept for existing call sites ──
        pk:  '#f068a4',
        pkd: '#c04a82',
        gy:  '#abadb0',
      },
      borderRadius: {
        // Radii rule (Dev Spec §1.3): 24px = clickable buttons ONLY;
        // 12px = eyebrow labels AND cards/panels. No other radii without justification.
        btn:  '24px',
        card: '12px',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono:  ['"Space Mono"', '"Courier New"', 'monospace'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
