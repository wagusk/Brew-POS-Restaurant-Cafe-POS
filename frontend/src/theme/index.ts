import { createTheme } from '@mui/material/styles';

// ── Brew-POS design tokens ──────────────────────────────────────────────
// Single source of truth for the unified grid system. Every component
// reads colors, radii, and spacing from this theme — never hardcoded.
//
// Surfaces: white paper on a soft grey page. 1px borders, not shadows.
// Radii:    12px default, 8px for nested chips, 16px for big tiles.
// Spacing:  8 / 12 / 16 / 24 scale via theme.spacing.
// Colors:   role-coded (cashier=blue, waiter=teal, kitchen=amber,
//           admin=violet); status colors for success/danger/warning/info.

declare module '@mui/material/styles' {
  interface Palette {
    surface: {
      page: string;
      paper: string;
      elevated: string;
      muted: string;
      inset: string;
    };
    border: {
      default: string;
      strong: string;
      soft: string;
    };
    role: {
      cashier: string;
      cashierAccent: string;
      waiter: string;
      waiterAccent: string;
      kitchen: string;
      kitchenAccent: string;
      admin: string;
      adminAccent: string;
    };
  }
  interface PaletteOptions {
    surface?: Partial<Palette['surface']>;
    border?: Partial<Palette['border']>;
    role?: Partial<Palette['role']>;
  }
}

const tokens = {
  // Surfaces
  page: '#f5f7fa',
  paper: '#ffffff',
  elevated: '#fafbfd',
  muted: '#eef1f5',
  inset: '#f1f4f8',

  // Borders
  borderDefault: '#e3e7ec',
  borderStrong: '#cfd4dc',
  borderSoft: '#eef1f5',

  // Text
  textPrimary: '#1a1f2b',
  textSecondary: '#5b6472',
  textMuted: '#8a93a3',

  // Role palette
  cashier: '#2b6cff',
  cashierAccent: '#0a4cdb',
  waiter: '#0c8a7a',
  waiterAccent: '#086a5d',
  kitchen: '#e07b1a',
  kitchenAccent: '#b35e0e',
  admin: '#6b46d3',
  adminAccent: '#4f31b3',

  // Semantic
  success: '#1f9d55',
  danger: '#d8453c',
  warning: '#d99317',
  info: '#0c8a7a',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.cashier, dark: tokens.cashierAccent, contrastText: '#ffffff' },
    secondary: { main: tokens.kitchen, contrastText: '#ffffff' },
    success: { main: tokens.success, contrastText: '#ffffff' },
    warning: { main: tokens.warning, contrastText: '#ffffff' },
    error: { main: tokens.danger, contrastText: '#ffffff' },
    info: { main: tokens.info, contrastText: '#ffffff' },
    background: {
      default: tokens.page,
      paper: tokens.paper,
    },
    text: {
      primary: tokens.textPrimary,
      secondary: tokens.textSecondary,
      disabled: tokens.textMuted,
    },
    divider: tokens.borderDefault,
    surface: {
      page: tokens.page,
      paper: tokens.paper,
      elevated: tokens.elevated,
      muted: tokens.muted,
      inset: tokens.inset,
    },
    border: {
      default: tokens.borderDefault,
      strong: tokens.borderStrong,
      soft: tokens.borderSoft,
    },
    role: {
      cashier: tokens.cashier,
      cashierAccent: tokens.cashierAccent,
      waiter: tokens.waiter,
      waiterAccent: tokens.waiterAccent,
      kitchen: tokens.kitchen,
      kitchenAccent: tokens.kitchenAccent,
      admin: tokens.admin,
      adminAccent: tokens.adminAccent,
    },
  },
  shape: { borderRadius: 12 },
  spacing: 8,
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: -0.5 },
    h2: { fontWeight: 700, letterSpacing: -0.25 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.1 },
    body1: { fontSize: '0.95rem' },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem', color: tokens.textSecondary },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.page,
          color: tokens.textPrimary,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          minHeight: 44,
          padding: '8px 16px',
          borderRadius: 10,
          fontSize: '0.9rem',
          boxShadow: 'none',
        },
        sizeSmall: { minHeight: 36, padding: '6px 12px', fontSize: '0.85rem' },
        sizeLarge: { minHeight: 56, padding: '12px 20px', fontSize: '1rem', borderRadius: 12 },
        outlined: { borderColor: tokens.borderStrong },
        contained: { '&:hover': { boxShadow: 'none' } },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: 40, minHeight: 40, borderRadius: 10 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        rounded: { borderRadius: 12 },
        root: {
          backgroundImage: 'none',
          border: `1px solid ${tokens.borderDefault}`,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { color: 'transparent', elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: tokens.paper,
          borderBottom: `1px solid ${tokens.borderDefault}`,
          color: tokens.textPrimary,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: { minHeight: 64 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8, height: 28 },
        sizeSmall: { height: 24, fontSize: '0.75rem' },
        clickable: { '&:hover': { backgroundColor: tokens.muted } },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: tokens.paper,
        },
        notchedOutline: {
          borderColor: tokens.borderStrong,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: `1px solid ${tokens.borderDefault}`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
          fontWeight: 600,
          textTransform: 'none',
          fontSize: '0.9rem',
          padding: '12px 16px',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 48 },
        indicator: { height: 3, borderRadius: 2 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
          padding: '6px 14px',
          borderColor: tokens.borderStrong,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: tokens.borderDefault },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, border: `1px solid ${tokens.borderDefault}` },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 10 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 8, margin: '2px 6px', minHeight: 40 },
      },
    },
  },
});

// Export raw tokens for use outside the theme (e.g. CSS variables).
export const brewTokens = tokens;
