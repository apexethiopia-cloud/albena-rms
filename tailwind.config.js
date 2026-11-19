/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian & Metallic Gold base surfaces.
        obsidian: '#09090B',
        surface: '#16161B',
        champagne: '#F3E5AB',

        // Metallic gold brand ramp. Keys are preserved from ADR-017 so existing
        // utilities keep working; values are now dark-canvas appropriate.
        brand: {
          50: '#1A160C',   // tinted gold surface for quiet badges
          100: '#2C2413',  // active navigation pill surface
          200: '#8A6D28',  // muted gold border
          500: '#D4AF37',  // focus ring / input focus border
          600: '#C9A227',  // primary CTA fill (dark text)
          700: '#E3C462',  // brighter gold hover / logo tile (dark text)
          800: '#B8860B',
          900: '#F3E5AB',  // champagne text on gold-tinted surfaces
        },

        // Slate is the workhorse family (60% of utilities). Light shades become
        // obsidian/charcoal/gold borders; dark shades become champagne text.
        slate: {
          50: '#09090B',
          100: '#2A2418',
          200: '#6E5623',
          300: '#A6883A',
          400: '#A89B84',
          500: '#C0B49B',
          600: '#D8CDB4',
          700: '#E8DFC8',
          800: '#F0E4B8',
          900: '#F3E5AB',
        },

        // Semantic ramps adapted for dark surfaces: 50/100 = dark tinted
        // surfaces, 200/300 = borders, 500/600/700 = bright fill + text,
        // 800/900 = high-contrast text.
        emerald: {
          50: '#0C2019', 100: '#123326', 200: '#1E5C42', 300: '#10B981',
          400: '#34D399', 500: '#34D399', 600: '#34D399', 700: '#6EE7B7',
          800: '#A7F3D0', 900: '#D1FAE5',
        },
        red: {
          50: '#2A1215', 100: '#3B1A1F', 200: '#7F1D22', 300: '#B91C1C',
          400: '#F87171', 500: '#F87171', 600: '#F87171', 700: '#FCA5A5',
          800: '#FECACA', 900: '#FEE2E2',
        },
        amber: {
          50: '#241B0C', 100: '#35280F', 200: '#6B4A0A', 300: '#B45309',
          400: '#FBBF24', 500: '#FBBF24', 600: '#FBBF24', 700: '#FCD34D',
          800: '#FDE68A', 900: '#FEF3C7',
        },
        rose: {
          50: '#2A1018', 100: '#3D1723', 200: '#7F1D33', 300: '#BE123C',
          400: '#FB7185', 500: '#FB7185', 600: '#FB7185', 700: '#FDA4AF',
          800: '#FECDD3', 900: '#FFE4E6',
        },
        sky: {
          50: '#0C1E2C', 100: '#123047', 200: '#1E4E73', 300: '#0EA5E9',
          400: '#38BDF8', 500: '#38BDF8', 600: '#38BDF8', 700: '#7DD3FC',
          800: '#BAE6FD', 900: '#E0F2FE',
        },
        indigo: {
          50: '#14152C', 100: '#1E2042', 200: '#373964', 300: '#6366F1',
          400: '#818CF8', 500: '#818CF8', 600: '#818CF8', 700: '#A5B4FC',
          800: '#C7D2FE', 900: '#E0E7FF',
        },
      },
      backgroundImage: {
        metallic:
          'linear-gradient(135deg, rgba(243,229,171,0.10) 0%, rgba(212,175,55,0.02) 45%, rgba(243,229,171,0.07) 100%)',
        'metallic-strong':
          'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0.08) 100%)',
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,0.35), 0 8px 24px rgba(0,0,0,0.45)',
        'gold-sm': 'inset 0 1px 0 rgba(243,229,171,0.10)',
      },
    },
  },
  plugins: [],
}
