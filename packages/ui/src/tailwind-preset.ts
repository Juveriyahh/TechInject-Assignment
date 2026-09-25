import type { Config } from 'tailwindcss';

/** Maps a `--token` CSS variable onto a Tailwind colour with opacity support. */
const token = (name: string): string => `hsl(var(--${name}) / <alpha-value>)`;

/**
 * Shared Tailwind preset. Applications spread this in their own config so the
 * design tokens, typography scale, radii and shadows stay identical everywhere.
 */
export const techInjectPreset: Omit<Config, 'content'> = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        surface: { DEFAULT: token('surface'), foreground: token('surface-foreground') },
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        elevated: token('elevated'),
        'border-strong': token('border-strong'),
        selection: { DEFAULT: token('selection'), foreground: token('selection-foreground') },
        tag: {
          blue: token('tag-blue'),
          green: token('tag-green'),
          purple: token('tag-purple'),
          amber: token('tag-amber'),
          yellow: token('tag-yellow'),
          rose: token('tag-rose'),
          cyan: token('tag-cyan'),
          slate: token('tag-slate')
        },
        chart: {
          low: token('chart-low'),
          mid: token('chart-mid'),
          high: token('chart-high'),
          track: token('chart-track')
        },
        popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
          subtle: token('success-subtle')
        },
        warning: {
          DEFAULT: token('warning'),
          foreground: token('warning-foreground'),
          subtle: token('warning-subtle')
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
          subtle: token('destructive-subtle')
        },
        info: { DEFAULT: token('info'), foreground: token('info-foreground') }
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)'
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0em' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '-0.006em' }],
        base: ['0.875rem', { lineHeight: '1.375rem', letterSpacing: '-0.011em' }],
        lg: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.014em' }],
        xl: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.017em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }]
      },
      boxShadow: {
        xs: '0 1px 2px 0 hsl(240 10% 2% / 0.28)',
        card: '0 1px 2px 0 hsl(240 10% 2% / 0.3), 0 1px 3px 0 hsl(240 10% 2% / 0.2)',
        popover: '0 8px 24px -4px hsl(240 10% 2% / 0.5), 0 2px 6px -2px hsl(240 10% 2% / 0.4)'
      }
    }
  }
};

export default techInjectPreset;
