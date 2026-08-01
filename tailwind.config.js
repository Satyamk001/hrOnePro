/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        elevated: 'var(--color-elevated)',
        ink: 'var(--color-ink)',
        body: 'var(--color-body)',
        mute: 'var(--color-mute)',
        faint: 'var(--color-faint)',
        hairline: 'var(--color-hairline)',
        'hairline-soft': 'var(--color-hairline-soft)',
        link: '#0070f3',
        error: '#ee0000',
        warning: '#f5a623',
      },
      fontFamily: {
        sans: ['Inter', 'Geist Sans', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Geist Mono', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '16px',
        pill: '100px',
      },
      letterSpacing: {
        'display': '-0.05em',
        'heading': '-0.04em',
        'subheading': '-0.02em',
      },
    },
  },
  plugins: [],
}
