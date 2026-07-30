# Brew-POS Unified Grid System Redesign — Implementation Plan
Date: 2026-07-28
Project: /home/lenovo/Hermes-Project/Brew-POS

## Objective
Replace the dark themed "showcase" UI with a unified grid system using
a single set of rectangular tokens (rounded 8px-16px), white surfaces,
and per-button color codes. Every element should align on the same
spacing scale and feel like one product, not five components bolted
together.

## Pillars
1. **One grid** — every layout uses MUI Grid / CSS Grid with explicit columns.
2. **One corner radius** — 12px baseline, 8px for nested chips, 16px for big tiles.
3. **One surface** — light theme with white `#ffffff` surfaces and `#f5f7fa`
   page background. Borders instead of shadows as separators.
4. **One spacing scale** — 8px / 12px / 16px / 24px via theme spacing.
5. **Color-coded by role / action** — each button has its semantic color.

## Color System

### Surface
| Token | Value | Use |
|------|-------|-----|
| `surface.page` | `#f5f7fa` | app background |
| `surface.paper` | `#ffffff` | cards, dialogs |
| `surface.elevated` | `#fafbfd` | hover/inset |
| `surface.muted` | `#eef1f5` | chips, secondary fills |
| `border.default` | `#e3e7ec` | borders |
| `border.strong` | `#cfd4dc` | dividers |
| `text.primary` | `#1a1f2b` | headings |
| `text.secondary` | `#5b6472` | body |
| `text.muted` | `#8a93a3` | meta |

### Action palette (each button gets a code)
| Token | Value | Role |
|------|-------|-----|
| `cashier.primary` | `#2b6cff` | blue — POS |
| `cashier.accent` | `#0a4cdb` | blue — pressed |
| `waiter.primary` | `#0c8a7a` | teal — floor |
| `waiter.accent` | `#086a5d` | teal — pressed |
| `kitchen.primary` | `#e07b1a` | amber — tickets |
| `kitchen.accent` | `#b35e0e` | amber — pressed |
| `admin.primary` | `#6b46d3` | violet — analytics |
| `admin.accent` | `#4f31b3` | violet — pressed |
| `action.success` | `#1f9d55` | charge, served |
| `action.danger` | `#d8453c` | delete, void |
| `action.warning` | `#d99317` | backspace, clear |
| `action.info` | `#0c8a7a` | neutral confirm |
| `keypad` | `#eef1f5` | numeric keys |
| `keypad.text` | `#1a1f2b` | numeric key text |

### Category accents (used for product tiles)
Each category gets its own chip color — supplied by `category.color`
seeded by the backend (already provided). UI must use it consistently.

## Component Specs

### Shell (top bar)
- White surface, 1px bottom border.
- Height: 64px.
- Role chip color matches role palette (cashier/waiter/kitchen/admin).
- Logout button: text-secondary → danger hover.

### Login
- Centered single card (420px max).
- Card has 16px radius, 1px border, no shadow.
- Header: Coffee icon + Brew-POS wordmark + subtitle.
- PIN display: bordered monospace digits.
- Keypad: 3x4 grid of 64px tiles, 8px gap.
  - Digit keys: `keypad` background, dark text.
  - Enter key: `cashier.primary` blue.
  - Clear key: `action.warning` outline.
- Backspace: text button below grid.

### Cashier
- Layout: full-height flex column.
- Search bar: white surface, 1px border, 56px height.
- Category tabs: full-width horizontal scroll, no underline, color-banded
  selection indicator.
- Product grid: `repeat(auto-fill, minmax(180px, 1fr))`, 12px gap.
  - Each tile: white surface, 1px border, 12px radius.
  - 6px top color band uses `category.color`.
  - Footer row: price (amber) + options chip (outlined).
- Cart bottom bar: white surface, 1px top border, 72px collapsed.
  - Expanded panel: 1px top border, 16px padding.
  - Line items: 1px border, 8px radius.
  - Payment toggle: segmented control with color-coded selected state.
  - Charge button: full-width `cashier.primary`, 56px tall.

### Waiter
- Page padding 24px.
- Table grid: `repeat(auto-fill, minmax(160px, 1fr))`, 16px gap.
- Each tile: white, 12px radius, table icon + name + seats.
  - If occupied: 2px border in `action.warning`.
- Dialog: white surface, 12px radius.
  - Left panel: category chips + product mini-grid.
  - Right panel: items list with totals.

### Kitchen
- Page padding 24px.
- Order grid: `repeat(auto-fill, minmax(280px, 1fr))`, 16px gap.
- Each ticket: white, 12px radius, 1px border.
  - Header row: order # + status chip.
  - Status chip color: amber (open/preparing), success (ready), info (served).
  - Items list: bordered rows, 8px radius.
  - Bottom action bar: full-width color-coded state machine button.

### Admin
- Page padding 24px.
- Stat grid: `xs={12} sm={6} md={3}`, 16px gap.
- Each stat card: white, 12px radius, 4px top accent (role color).
- Menu status panel: white, 12px radius, 16px padding.
  - Category chips: 1px border, color = category color.

### Modifier Modal
- 12px radius, white surface.
- Group title: h6 weight 600.
- Single-select: 2-line rows with radio.
- Multi-select: chips, 44px height, 1px border, primary when selected.
- Notes field: full-width textarea.
- Cancel button: text-warning.
- Confirm button: cashier-primary, large.

## Implementation Phases

1. **Theme + global CSS** — switch to light palette, set 12px radius, add
   `tokens` for spacing. Update index.css.
2. **Shell** — white top bar, color-coded role chip.
3. **Login** — keypad grid, color-coded keys.
4. **Cashier** — product grid + bottom cart.
5. **Modifier modal** — grouped chips, color-coded actions.
6. **Waiter** — floor plan grid.
7. **Kitchen** — ticket cards.
8. **Admin** — stat grid.
9. **Verify** — `npm run lint` 0 warnings, `npm run build` exit 0.

## Verification
- `cd frontend && npm run lint` — 0 warnings, 0 errors.
- `cd frontend && npm run build` — exit 0, fresh asset hash.
- Smoke load the cashier page; visual sanity check (out of scope this
  session — UI is text-rendered in terminal; we verify via lint+build).
