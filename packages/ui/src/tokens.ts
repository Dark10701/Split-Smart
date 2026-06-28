/** Shared design tokens for web and mobile clients. */

export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F6F8',
    text: '#1A1D23',
    textMuted: '#6B7280',
    primary: '#2563EB',
    positive: '#16A34A',
    negative: '#DC2626',
    border: '#E5E7EB',
  },
  dark: {
    background: '#0F1115',
    surface: '#1A1D23',
    text: '#F5F6F8',
    textMuted: '#9CA3AF',
    primary: '#3B82F6',
    positive: '#22C55E',
    negative: '#EF4444',
    border: '#2A2E37',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 4, md: 8, lg: 16, pill: 999 } as const;

export const typography = {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  sizes: { caption: 12, body: 14, title: 18, heading: 24 },
} as const;

export type ThemeMode = keyof typeof colors;
