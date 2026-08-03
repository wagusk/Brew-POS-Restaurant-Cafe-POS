import { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, Stack, Divider, InputAdornment,
  Alert, CircularProgress, Snackbar, IconButton, Tooltip,
} from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import TuneIcon from '@mui/icons-material/Tune';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StorageIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import PercentIcon from '@mui/icons-material/Percent';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintIcon from '@mui/icons-material/Print';
import RouterIcon from '@mui/icons-material/Router';
import UsbIcon from '@mui/icons-material/Usb';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { Admin, Settings, Printer, Discount, type SettingsPayload, type PrinterConfig, type PrintResult, type DiscountPolicy, type DiscountPreset } from '../lib/api';
import type { AdminCategory, AdminProduct, AdminTable } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────
// SHARP THEME OVERRIDES — settings uses tighter radii (4-8px) like admin
// ─────────────────────────────────────────────────────────────────────
const SHAPE = {
  card: 6,
  button: 4,
  chip: 4,
  iconBtn: 4,
  dialog: 8,
};

// ── Main menu color codes ────────────────────────────────────────────
// M25 — SettingsPage now only owns Database + Printer. Products / Tables /
// Tax & Discounts were moved to AdminPage (they're admin-owned settings,
// not "device / environment" settings). MainKey narrowed accordingly.
type MainKey = 'database' | 'printer';

const MAIN_COLOR: Record<MainKey, string> = {
  database: '#5b6472',
  printer: '#7b3aa8',
};

interface MainItem {
  key: MainKey;
  label: string;
  icon: React.ReactNode;
}

const MAIN_ITEMS: MainItem[] = [
  // Database + Database Ops are merged into one menu entry — both workspaces
  // (URL editor + operation tiles) render side-by-side under the single
  // "Database" tile (M25 row collapse) so admins don't have to bounce
  // between two near-identical grey buttons to manage the DB.
  { key: 'database', label: 'Database', icon: <StorageIcon /> },
  // Printer config — mode (dummy/network/usb), paper, header/footer,
  // auto-print toggles, dry-run. Test Print button fires a real ticket
  // through the configured sender so admins can verify reachability.
  { key: 'printer', label: 'Printer', icon: <PrintIcon /> },
];

// ─────────────────────────────────────────────────────────────────────
// Reusable: ColumnHeader
// ─────────────────────────────────────────────────────────────────────
function ColumnHeader({
  title, color, count, action,
}: {
  title: string;
  color: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'border.default',
        bgcolor: 'surface.paper',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 56,
      }}
    >
      <Box sx={{ width: 6, height: 24, bgcolor: color, borderRadius: '2px' }} />
      <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1, color: 'text.primary', flex: 1 }}>
        {title}
        {count !== undefined && (
          <Box component="span" sx={{ ml: 0.75, color: 'text.secondary' }}>
            · {count}
          </Box>
        )}
      </Typography>
      {action}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Reusable: ListItemButton
// ─────────────────────────────────────────────────────────────────────
function ListItemButton({
  active, color, label, sublabel, onClick, accent, leading, trailing,
}: {
  active: boolean;
  color: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  accent?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      sx={{
        position: 'relative',
        px: 1.75,
        py: 1.25,
        minHeight: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        borderBottom: '1px solid',
        borderColor: 'border.soft',
        bgcolor: active ? `${color}14` : 'transparent',
        borderLeft: accent ? '3px solid' : '3px solid transparent',
        borderLeftColor: accent ? color : 'transparent',
        transition: 'background-color 0.1s',
        '&:hover': { bgcolor: active ? `${color}1f` : 'surface.muted' },
        '&:focus-visible': { outline: `2px solid ${color}`, outlineOffset: -2 },
      }}
    >
      {leading && (
        <Box
          sx={{
            width: 32, height: 32,
            borderRadius: `${SHAPE.button}px`,
            bgcolor: active ? color : 'surface.muted',
            color: active ? '#fff' : color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            '& .MuiSvgIcon-root': { fontSize: 18 },
            flexShrink: 0,
            transition: 'background-color 0.1s, color 0.1s',
          }}
        >
          {leading}
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Typography sx={{ fontWeight: active ? 700 : 600, lineHeight: 1.2, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </Typography>
        {sublabel && (
          <Typography variant="caption" sx={{ display: 'block', color: active ? color : 'text.secondary', fontWeight: 600 }}>
            {sublabel}
          </Typography>
        )}
      </Box>
      {/* Trailing actions (Edit / Delete) — stop propagation so clicking
          them doesn't ALSO trigger the row's onClick (which selects the
          category). Always rendered so admins can fix/delete without
          first selecting. */}
      {trailing && (
        <Box
          sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {trailing}
        </Box>
      )}
      {active && !trailing && <ChevronRightIcon sx={{ fontSize: 18, color }} />}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty-state helper
// ─────────────────────────────────────────────────────────────────────
function ColumnEmpty({ message }: { message: string }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
      <Typography variant="body2">{message}</Typography>
      <Typography variant="caption">Pick an item on the left.</Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [main, setMain] = useState<MainKey>('database');

  const color = MAIN_COLOR[main];

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'surface.page' }}>
      {/* TOP STRIP */}
      <Box
        sx={{
          minHeight: 64,
          px: 2.5,
          py: 1.5,
          bgcolor: 'surface.paper',
          borderBottom: '1px solid',
          borderColor: 'border.default',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 44, height: 44, borderRadius: `${SHAPE.button}px`,
            bgcolor: 'role.admin', color: 'common.white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            '& .MuiSvgIcon-root': { fontSize: 22 },
          }}
        >
          <SettingsIcon />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Settings
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {MAIN_ITEMS.find((m) => m.key === main)?.label} workspace
          </Typography>
        </Box>
      </Box>

      {/* CASCADING COLUMNS */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* COLUMN 1 — main menu */}
        <Paper
          square
          sx={{
            width: '25%',
            minWidth: 220,
            maxWidth: 320,
            display: 'flex',
            flexDirection: 'column',
            borderTop: 'none', borderLeft: 'none', borderBottom: 'none',
            borderRadius: 0,
          }}
        >
          <ColumnHeader title="MENU" color={color} count={MAIN_ITEMS.length} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {MAIN_ITEMS.map((m) => (
              <ListItemButton
                key={m.key}
                active={main === m.key}
                color={MAIN_COLOR[m.key]}
                label={m.label}
                onClick={() => setMain(m.key)}
                leading={m.icon}
                accent={main === m.key}
              />
            ))}
          </Box>
        </Paper>

        <Divider orientation="vertical" flexItem />

        {/* COLUMN 2+ — chosen workspace */}
        {/* M25 — Products / Tables / Tax & Discounts branches removed
            (those workspaces live on the Admin page now). SettingsPage
            only owns the device / environment knobs: Database + Printer. */}
        {main === 'database' && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Combined Database view: URL editor (top) + operation tiles
                (bottom), no divider — the user wants them as one block.
                flexDirection column lets each workspace keep its own
                internal vertical scroll (overflowY:auto) so tall operation
                tiles don't push the URL editor offscreen. */}
            <DatabaseWorkspace color={color} />
            <DbOpsWorkspace color={color} />
          </Box>
        )}
        {main === 'printer' && (
          <PrinterWorkspace color={MAIN_COLOR.printer} />
        )}
   </Box>
 </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PRODUCTS NESTED WORKSPACE — 4 columns deep
// Products > Categories > Menu Items > Item Settings
// ─────────────────────────────────────────────────────────────────────
// M25 — Products / Tables / Tax & Discounts workspaces moved to AdminPage.
// The bodies below are kept as dead code for now (delete in a future
// commit once we're confident the AdminPage copies cover every case).
//   ProductsNestedWorkspace  → AdminPage.ProductsWorkspace (3-col variant)
//   TablesWorkspace          → AdminPage.TablesWorkspace   (identical)
//   TaxDiscountsWorkspace    → AdminPage.TaxDiscountsWorkspace (verbatim)
function ProductsNestedWorkspace({ color }: { color: string }) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  // M24 — category edit state. `creatingCategory` opens a blank dialog;
  // `editingCategory` opens a dialog pre-filled with that category. Both
  // route through the same `CategoryDialog` component below.
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  // M24 — product edit state. Edit happens inline via `selectedProductId`
  // (which renders the full ProductSettingsForm in column 4 with name,
  // price, active, and station-routing override fields). The row's
  // Edit button just selects the product so the form opens.
  const [creatingProduct, setCreatingProduct] = useState(false);
  // Toast for create / edit / delete success or backend error messages.
  const [catToast, setCatToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [prodToast, setProdToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // Load categories on mount
  useEffect(() => {
    Admin.listCategories().then(setCategories).catch(() => {});
  }, []);

  // Load products when category selected
  useEffect(() => {
    if (selectedCategoryId !== null) {
      Admin.listProducts().then((prods) => {
        setProducts(prods.filter((p) => p.category_id === selectedCategoryId));
      }).catch(() => {});
    } else {
      setProducts([]);
    }
    setSelectedProductId(null);
  }, [selectedCategoryId]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  const reloadCategories = () => {
    Admin.listCategories().then(setCategories).catch(() => {});
  };

  const reloadProducts = () => {
    if (selectedCategoryId !== null) {
      Admin.listProducts().then((prods) => {
        setProducts(prods.filter((p) => p.category_id === selectedCategoryId));
      }).catch(() => {});
    }
  };

  const saveCategory = async (payload: {
    name: string; color: string; icon?: string; sort?: number; kind?: string;
  }) => {
    try {
      if (editingCategory) {
        // PATCH — partial update, only send changed fields.
        const updated = await Admin.updateCategory(editingCategory.id, payload);
        reloadCategories();
        setCatToast({ msg: `Updated category "${updated.name}"`, severity: 'success' });
        setEditingCategory(null);
      } else {
        const created = await Admin.createCategory(payload) as AdminCategory;
        reloadCategories();
        setSelectedCategoryId(created.id);
        setCreatingCategory(false);
        setCatToast({ msg: `Created category "${created.name}"`, severity: 'success' });
      }
    } catch (e: any) {
      setCatToast({
        msg: e?.response?.data?.detail ?? 'Failed to save category',
        severity: 'error',
      });
    }
  };

  const removeCategory = async (id: number) => {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    if (!window.confirm(
      `Delete category "${target.name}"? Any products still in this category must be moved first.`,
    )) return;
    try {
      await Admin.deleteCategory(id);
      // If the deleted category was selected, clear selection so the
      // product column resets too.
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
        setProducts([]);
      }
      reloadCategories();
      setCatToast({ msg: `Deleted category "${target.name}"`, severity: 'success' });
    } catch (e: any) {
      setCatToast({
        msg: e?.response?.data?.detail ?? 'Failed to delete category',
        severity: 'error',
      });
    }
  };

  const saveProduct = async (payload: {
    name: string; price: number; category_id: number; active?: boolean;
    kind?: string;
  }) => {
    try {
      // Backend allows description/image to default to "" so we always
      // send them explicitly (the API signature requires them).
      const created = await Admin.createProduct({
        ...payload,
        description: '',
        image: '',
        active: payload.active ?? true,
      }) as AdminProduct;
      reloadProducts();
      setSelectedProductId(created.id);
      setCreatingProduct(false);
      setProdToast({ msg: `Created product "${created.name}"`, severity: 'success' });
    } catch (e: any) {
      setProdToast({
        msg: e?.response?.data?.detail ?? 'Failed to save product',
        severity: 'error',
      });
    }
  };

  const removeProduct = async (id: number) => {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    if (!window.confirm(
      `Delete product "${target.name}"? This is permanent — historical order items keep their snapshotted name so they still render on past bills.`,
    )) return;
    try {
      await Admin.deleteProduct(id);
      if (selectedProductId === id) {
        setSelectedProductId(null);
      }
      reloadProducts();
      setProdToast({ msg: `Deleted product "${target.name}"`, severity: 'success' });
    } catch (e: any) {
      setProdToast({
        msg: e?.response?.data?.detail ?? 'Failed to delete product',
        severity: 'error',
      });
    }
  };

  return (
    <>
      {/* COLUMN 2 — Categories */}
      <Paper
        square
        sx={{
          width: '25%',
          minWidth: 220,
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderBottom: 'none',
          borderRadius: 0,
        }}
      >
        <ColumnHeader 
          title="CATEGORIES" 
          color="#0c8a7a" 
          count={categories.length}
          action={
            <Button
              size="small"
              variant="contained"
              onClick={() => setCreatingCategory(true)}
              sx={{
                bgcolor: '#0c8a7a',
                '&:hover': { bgcolor: '#0c8a7a', filter: 'brightness(0.9)' },
                borderRadius: `${SHAPE.button}px`,
                minHeight: 36,
                fontWeight: 700,
                px: 1,
              }}
            >
              + New
            </Button>
          }
        />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {categories.length === 0 ? (
            <ColumnEmpty message="No categories" />
          ) : categories.map((c) => (
            <ListItemButton
              key={c.id}
              active={selectedCategoryId === c.id}
              color={c.color}
              label={c.name}
              sublabel={`${c.kind ?? 'kitchen'} · ${c.color}`}
              onClick={() => setSelectedCategoryId(c.id)}
              trailing={
                <>
                  <Tooltip title="Edit category">
                    <IconButton
                      size="small"
                      onClick={() => setEditingCategory(c)}
                      sx={{
                        bgcolor: 'rgba(43, 108, 255, 0.12)',
                        color: '#2b6cff',
                        borderRadius: `${SHAPE.iconBtn}px`,
                        '&:hover': { bgcolor: 'rgba(43, 108, 255, 0.22)' },
                      }}
                    >
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete category">
                    <IconButton
                      size="small"
                      onClick={() => removeCategory(c.id)}
                      sx={{
                        bgcolor: 'rgba(216, 69, 60, 0.12)',
                        color: '#d8453c',
                        borderRadius: `${SHAPE.iconBtn}px`,
                        '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.22)' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </>
              }
            />
          ))}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 3 — Products (Menu Items) in selected category */}
      <Paper
        square
        sx={{
          width: '25%',
          minWidth: 220,
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderBottom: 'none',
          borderRadius: 0,
        }}
      >
        <ColumnHeader 
          title="MENU ITEMS" 
          color="#2b6cff" 
          count={products.length}
          action={
            <Button
              size="small"
              variant="contained"
              onClick={() => setCreatingProduct(true)}
              disabled={!selectedCategoryId}
              sx={{
                bgcolor: '#2b6cff',
                '&:hover': { bgcolor: '#2b6cff', filter: 'brightness(0.9)' },
                borderRadius: `${SHAPE.button}px`,
                minHeight: 36,
                fontWeight: 700,
                px: 1,
              }}
            >
              + New
            </Button>
          }
        />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {!selectedCategoryId ? (
            <ColumnEmpty message="Select a category" />
          ) : products.length === 0 ? (
            <ColumnEmpty message="No products" />
          ) : products.map((p) => {
            // Effective station (product.kind overrides category.kind)
            const effectiveKind = p.kind || selectedCategory?.kind || 'kitchen';
            return (
              <ListItemButton
                key={p.id}
                active={selectedProductId === p.id}
                color={selectedCategory?.color ?? '#2b6cff'}
                label={p.name}
                sublabel={`$${p.price.toFixed(2)} · ${effectiveKind}${!p.active ? ' · off' : ''}`}
                onClick={() => setSelectedProductId(p.id)}
                trailing={
                  <>
                    <Tooltip title="Edit product (opens full settings in column 4)">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedProductId(p.id)}
                        sx={{
                          bgcolor: 'rgba(43, 108, 255, 0.12)',
                          color: '#2b6cff',
                          borderRadius: `${SHAPE.iconBtn}px`,
                          '&:hover': { bgcolor: 'rgba(43, 108, 255, 0.22)' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete product">
                      <IconButton
                        size="small"
                        onClick={() => removeProduct(p.id)}
                        sx={{
                          bgcolor: 'rgba(216, 69, 60, 0.12)',
                          color: '#d8453c',
                          borderRadius: `${SHAPE.iconBtn}px`,
                          '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.22)' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </>
                }
              />
            );
          })}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 4 — Product Settings */}
      <Paper
        square
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderBottom: 'none', borderRight: 'none',
          borderRadius: 0,
        }}
      >
        {selectedProduct ? (
          <ProductSettingsForm
            product={selectedProduct}
            category={selectedCategory}
            onSave={() => reloadProducts()}
            onDelete={(id) => removeProduct(id)}
            color={color}
          />
        ) : (
          <ColumnEmpty message="Select a product to edit" />
        )}
      </Paper>

      {/* New / Edit Category Dialog — M24 unified for both create and edit */}
      {(creatingCategory || editingCategory) && (
        <CategoryDialog
          open
          initial={editingCategory ?? undefined}
          onClose={() => { setCreatingCategory(false); setEditingCategory(null); }}
          onSave={saveCategory}
        />
      )}

      {/* New Product Dialog */}
      {creatingProduct && selectedCategoryId && (
        <ProductCreateDialog
          categoryId={selectedCategoryId}
          onSave={saveProduct}
          onClose={() => setCreatingProduct(false)}
        />
      )}

      {/* Toast: category create / edit / delete feedback */}
      <Snackbar
        open={!!catToast}
        autoHideDuration={4000}
        onClose={() => setCatToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={catToast?.severity ?? 'success'}
          variant="filled"
          onClose={() => setCatToast(null)}
          sx={{ borderRadius: `${SHAPE.button}px` }}
        >
          {catToast?.msg ?? ''}
        </Alert>
      </Snackbar>

      {/* Toast: product create / edit / delete feedback */}
      <Snackbar
        open={!!prodToast}
        autoHideDuration={4000}
        onClose={() => setProdToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={prodToast?.severity ?? 'success'}
          variant="filled"
          onClose={() => setProdToast(null)}
          sx={{ borderRadius: `${SHAPE.button}px` }}
        >
          {prodToast?.msg ?? ''}
        </Alert>
      </Snackbar>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Category Create / Edit Dialog — M24
// ─────────────────────────────────────────────────────────────────────
function CategoryDialog({
  open, initial, onClose, onSave,
}: {
  open: boolean;
  initial?: AdminCategory;
  onClose: () => void;
  onSave: (p: { name: string; color: string; icon?: string; sort?: number; kind?: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0c8a7a');
  const [icon, setIcon] = useState('restaurant');
  const [sort, setSort] = useState(0);
  const [kind, setKind] = useState<'kitchen' | 'bar' | 'both'>('kitchen');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setColor(initial?.color ?? '#0c8a7a');
      setIcon(initial?.icon ?? 'restaurant');
      setSort(initial?.sort ?? 0);
      setKind((initial?.kind as 'kitchen' | 'bar' | 'both') ?? 'kitchen');
    }
  }, [open, initial]);

  const validHex = /^#[0-9a-fA-F]{6}$/.test(color);
  const canSave = !!name.trim() && validHex;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px`, borderTop: '4px solid', borderTopColor: MAIN_COLOR.products } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initial ? 'Edit Category' : 'New Category'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth size="small" autoFocus
          />
          <TextField
            label="Sort order"
            type="number"
            value={sort}
            onChange={(e) => setSort(parseInt(e.target.value) || 0)}
            fullWidth size="small"
          />

          {/* Print routing (kitchen / bar / both) — drives which station
              sees the order. Admin can flip this at any time; the new
              value applies to NEW orders only (existing OrderItem.station
              snapshots are preserved). */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}>
              PRINT ROUTING
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
              {(['kitchen', 'bar', 'both'] as const).map((k) => {
                const selected = kind === k;
                const colorMap = {
                  kitchen: '#d99317',  // amber — matches Kitchen role color
                  bar: '#0e9ec7',      // cyan — matches Bar role color
                  both: '#6b46d3',     // violet — both stations
                };
                return (
                  <Box
                    key={k}
                    role="button"
                    tabIndex={0}
                    onClick={() => setKind(k)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setKind(k); }}
                    sx={{
                      flex: 1,
                      py: 1.25,
                      borderRadius: `${SHAPE.button}px`,
                      border: '2px solid',
                      borderColor: selected ? colorMap[k] : 'border.default',
                      bgcolor: selected ? colorMap[k] : 'transparent',
                      color: selected ? '#fff' : colorMap[k],
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      transition: 'background-color 0.1s, border-color 0.1s, color 0.1s',
                      '&:hover': { borderColor: colorMap[k], bgcolor: selected ? colorMap[k] : `${colorMap[k]}14` },
                      '&:focus-visible': { outline: `2px solid ${colorMap[k]}`, outlineOffset: 2 },
                    }}
                  >
                    {k}
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* Color picker — native HTML5 + hex text + 10-swatch quick palette */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}>
              COLOR
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 48, height: 48, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}
              />
              <TextField
                value={color}
                onChange={(e) => setColor(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="#rrggbb"
                error={!validHex}
                helperText={!validHex ? 'Must be #rrggbb' : undefined}
              />
              <Box sx={{ width: 48, height: 48, borderRadius: `${SHAPE.button}px`, bgcolor: color, border: '1px solid', borderColor: 'border.default' }} />
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b'].map((sw) => (
                <Box
                  key={sw}
                  onClick={() => setColor(sw)}
                  sx={{
                    width: 28, height: 28, borderRadius: `${SHAPE.chip}px`, bgcolor: sw, cursor: 'pointer',
                    border: '2px solid', borderColor: color.toLowerCase() === sw ? 'text.primary' : 'transparent',
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="warning">Cancel</Button>
        <Button
          onClick={() => canSave && onSave({ name: name.trim(), color, icon, sort, kind })}
          variant="contained"
          disabled={!canSave}
          sx={{
            bgcolor: MAIN_COLOR.products,
            '&:hover': { bgcolor: MAIN_COLOR.products, filter: 'brightness(0.9)' },
            borderRadius: `${SHAPE.button}px`,
            fontWeight: 700,
          }}
        >
          {initial ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Product Create Dialog
// ─────────────────────────────────────────────────────────────────────
function ProductCreateDialog({
  categoryId,
  onSave,
  onClose,
}: {
  categoryId: number;
  onSave: (p: { name: string; price: number; category_id: number; active?: boolean }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New Product</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            autoFocus
          />
          <TextField
            label="Price"
            type="number"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            fullWidth
            size="small"
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
          />
        </Stack>
      </DialogContent>
      <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSave({ name, price, category_id: categoryId, active: true })}
          disabled={!name.trim()}
          sx={{ bgcolor: '#2b6cff', '&:hover': { bgcolor: '#2b6cff' } }}
        >
          Create
        </Button>
      </Box>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PRODUCT SETTINGS FORM — includes station routing override
// ─────────────────────────────────────────────────────────────────────
function ProductSettingsForm({
  product,
  category,
  onSave,
  onDelete,
  color,
}: {
  product: AdminProduct;
  category: AdminCategory | null;
  onSave: () => void;
  onDelete?: (id: number) => void;
  color: string;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price);
  const [active, setActive] = useState(product.active ?? true);
  const [productKind, setProductKind] = useState<string>(product.kind ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get effective kind (product overrides category)
  const effectiveKind = productKind || category?.kind || 'kitchen';
  const kColor = effectiveKind === 'bar' ? '#0e9ec7' : effectiveKind === 'both' ? '#6b46d3' : '#e07b1a';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Pass empty string as null to clear the override
      const kindValue = productKind === '' ? null : productKind;
      await Admin.updateProduct(product.id, {
        name,
        price,
        active,
        kind: kindValue,
      });
      onSave();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
      <ColumnHeader title="ITEM SETTINGS" color={color} />

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack spacing={2} sx={{ mt: 2 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Price"
          type="number"
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
          fullWidth
          size="small"
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />
        <FormControlLabel
          control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
          label="Available"
        />

        {/* Station Routing Override */}
        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'border.default', borderRadius: `${SHAPE.card}px` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <TuneIcon sx={{ color: '#6b46d3', fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Station Routing Override
            </Typography>
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Category default: <strong>{category?.kind ?? 'kitchen'}</strong>
            {productKind === '' && (
              <span> (inherited)</span>
            )}
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {([
              ['', 'Use Category', '#5b6472'],
              ['kitchen', 'Kitchen', '#e07b1a'],
              ['bar', 'Bar', '#0e9ec7'],
              ['both', 'Both', '#6b46d3'],
            ] as const).map(([k, label, c]) => {
              const active = productKind === k;
              return (
                <Button
                  key={k}
                  size="small"
                  variant={active ? 'contained' : 'outlined'}
                  onClick={() => setProductKind(k)}
                  startIcon={k === 'bar' ? <LocalBarIcon sx={{ fontSize: 14 }} /> : k === 'both' ? <RestaurantMenuIcon sx={{ fontSize: 14 }} /> : k === 'kitchen' ? <SoupKitchenIcon sx={{ fontSize: 14 }} /> : undefined}
                  sx={{
                    borderRadius: `${SHAPE.button}px`,
                    minHeight: 36,
                    fontWeight: 700,
                    color: active ? 'common.white' : c,
                    borderColor: c,
                    bgcolor: active ? c : 'transparent',
                    '&:hover': { bgcolor: active ? c : `${c}1a`, borderColor: c },
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Box>

          {productKind !== '' && (
            <Chip
              size="small"
              label={`Override: ${effectiveKind}`}
              icon={effectiveKind === 'bar' ? <LocalBarIcon sx={{ fontSize: 14 }} /> : effectiveKind === 'both' ? <RestaurantMenuIcon sx={{ fontSize: 14 }} /> : <SoupKitchenIcon sx={{ fontSize: 14 }} />}
              sx={{ mt: 1.5, bgcolor: kColor, color: 'common.white', fontWeight: 700, '& .MuiChip-icon': { color: 'common.white' } }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', mt: 2, alignItems: 'center' }}>
          {onDelete ? (
            <Button
              variant="outlined"
              color="error"
              onClick={() => onDelete(product.id)}
              startIcon={<DeleteIcon />}
              sx={{
                borderRadius: `${SHAPE.button}px`,
                minHeight: 40,
                fontWeight: 700,
                borderColor: '#d8453c',
                color: '#d8453c',
                '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.08)', borderColor: '#d8453c' },
              }}
            >
              Delete
            </Button>
          ) : <Box />}
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={<CheckCircleIcon />}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TABLES WORKSPACE (reused from before)
// ─────────────────────────────────────────────────────────────────────
function TablesWorkspace({ color }: { color: string }) {
  const [items, setItems] = useState<AdminTable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminTable | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const reload = () => {
    Admin.listTables().then((tables) => {
      setItems(tables);
      if (selectedId == null && tables.length) setSelectedId(tables[0].id);
    }).catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => t.name.toLowerCase().includes(q));
  }, [items, search]);

  const selected = items.find((t) => t.id === selectedId) ?? null;

  const save = async (payload: { name: string; seats: number; active: boolean }) => {
    if (editing) {
      await Admin.updateTable(editing.id, payload);
    } else {
      const created = await Admin.createTable(payload) as AdminTable;
      setSelectedId(created.id);
    }
    setEditing(null);
    setCreating(false);
    reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this table?')) return;
    try {
      await Admin.deleteTable(id);
      setSelectedId(null);
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Cannot delete');
    }
  };

  return (
    <>
      {/* COLUMN 2 — list */}
      <Paper
        square
        sx={{
          width: '25%',
          minWidth: 220,
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderBottom: 'none',
          borderRadius: 0,
        }}
      >
        <ColumnHeader
          title="TABLES"
          color={color}
          count={items.length}
          action={
            <Button
              size="small"
              variant="contained"
              onClick={() => setCreating(true)}
              sx={{
                bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' },
                borderRadius: `${SHAPE.button}px`,
                minHeight: 36, fontWeight: 700, px: 1.25,
              }}
            >
              New
            </Button>
          }
        />
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'border.default' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <ColumnEmpty message="No tables" />
          ) : filtered.map((t) => (
            <ListItemButton
              key={t.id}
              active={selectedId === t.id}
              color={color}
              label={t.name}
              sublabel={`${t.seats} seats`}
              onClick={() => setSelectedId(t.id)}
            />
          ))}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 3 — detail */}
      <Paper
        square
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderBottom: 'none', borderRight: 'none',
          borderRadius: 0,
        }}
      >
        {selected || creating ? (
          <TableForm
            table={editing}
            onSave={save}
            onCancel={() => { setEditing(null); setCreating(false); }}
            onDelete={selected ? () => remove(selected.id) : undefined}
            color={color}
          />
        ) : (
          <ColumnEmpty message="Select a table to edit" />
        )}
      </Paper>

      {creating && !editing && (
        <Dialog open={creating} onClose={() => setCreating(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>New Table</DialogTitle>
          <DialogContent>
            <TableForm
              table={null}
              onSave={save}
              onCancel={() => setCreating(false)}
              color={color}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function TableForm({
  table,
  onSave,
  onCancel,
  onDelete,
  color,
}: {
  table: AdminTable | null;
  onSave: (p: any) => void;
  onCancel: () => void;
  onDelete?: () => void;
  color: string;
}) {
  const [name, setName] = useState(table?.name ?? '');
  const [seats, setSeats] = useState(table?.seats ?? 4);
  const [active, setActive] = useState(table?.active ?? true);

  return (
    <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
      <Stack spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Seats"
          type="number"
          value={seats}
          onChange={(e) => setSeats(parseInt(e.target.value) || 1)}
          fullWidth
          size="small"
        />
        <FormControlLabel
          control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
          label="Active"
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          {onDelete && (
            <Button color="error" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => onSave({ name, seats, active })}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}
          >
            {table ? 'Update' : 'Create'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TAX WORKSPACE
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// TAX & DISCOUNTS WORKSPACE — M21
// One menu entry, two stacked Paper sections:
//
//   ┌─ TAX ─────────────────────────┐
//   │  Free-form numeric input      │  (no slider, no template)
//   │  (% of subtotal, 0–100)        │
//   │  Save button                   │
//   └────────────────────────────────┘
//
//   ┌─ DISCOUNT PRESETS ─────────────┐
//   │  Add / edit / delete row list  │  Each preset is a $ button
//   │  Max cap (% subtotal) +        │  the cashier will see on a
//   │  Require-reason toggle          │  closed bill (later).
//   └────────────────────────────────┘
//
// Both sections share one GET /admin/settings round-trip
// (SettingsOut now carries `discount_policy` inline).
// ─────────────────────────────────────────────────────────────────────
function TaxDiscountsWorkspace({ color }: { color: string }) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  // ── Tax draft (free-form numeric input, no template/chips) ────────
  // The input accepts ANY value 0–100 (we map to the 0.0–1.0 fraction
  // the backend persists). Admin types a literal percent — no slider,
  // no quick-pick — so changing the rate is explicit, never accidental.
  const [taxInput, setTaxInput] = useState<string>('10.00');
  const [taxDirty, setTaxDirty] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  // ── Discount drafts ───────────────────────────────────────────────
  const [capInput, setCapInput] = useState<string>('50.00');
  const [capDirty, setCapDirty] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [presets, setPresets] = useState<DiscountPreset[]>([]);
  // M21.1 — preset draft now carries mode (amount | percent) and value
  // (dollars for amount, 0–100 for percent) so the admin can flip each
  // row's semantics without losing the rest of the line.
  const [presetDraft, setPresetDraft] = useState<{
    label: string;
    mode: 'amount' | 'percent';
    value: string;
  }>({ label: '', mode: 'amount', value: '' });
  const [editingPreset, setEditingPreset] = useState<number | null>(null); // index being edited

  // Migrate legacy {label, amount} shapes when reading from disk —
  // older settings.json files predate M21.1's mode+value split.
  const migratePresets = (rows: any[]): DiscountPreset[] => {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => {
      if (!r || typeof r !== 'object') return null;
      if (r.mode === 'amount' || r.mode === 'percent') {
        return {
          label: String(r.label || '').slice(0, 32),
          mode: r.mode,
          value: Number(r.value ?? 0),
        };
      }
      const amt = Number(r.amount ?? 0);
      return {
        label: String(r.label || '').slice(0, 32),
        mode: 'amount',
        value: amt,
      };
    }).filter((r): r is DiscountPreset => !!r && !!r.label);
  };

  const reload = () => {
    setLoading(true);
    Settings.get()
      .then((s) => {
        setSettings(s);
        const taxPct = Number(s.tax_rate ?? 0) * 100;
        setTaxInput(taxPct.toFixed(2));
        setTaxDirty(false);
        const pol = (s as any).discount_policy ?? {
          max_discount_pct: 0.5,
          presets: [],
          require_reason: true,
        };
        setCapInput((Number(pol.max_discount_pct ?? 0) * 100).toFixed(2));
        setCapDirty(false);
        setPresets(migratePresets(pol.presets));
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  // Guard for adding/updating a preset row (mode-aware validation).
  const validatePresetDraft = (label: string, mode: 'amount' | 'percent', valueNum: number): string | null => {
    if (!label) return 'Preset label cannot be empty.';
    if (Number.isNaN(valueNum) || valueNum <= 0) return 'Preset value must be positive.';
    if (mode === 'percent' && valueNum > 100) return 'Percent presets must be 100 or less.';
    return null;
  };

  // Preset CRUD — all deferred until "Save discounts" — keeps the PUT
  // path minimal and the optimistic UX predictable.
  const addOrUpdatePreset = () => {
    const label = presetDraft.label.trim();
    const valueNum = parseFloat(presetDraft.value);
    const err = validatePresetDraft(label, presetDraft.mode, valueNum);
    if (err) { setToast({ msg: err, severity: 'error' }); return; }
    const next = [...presets];
    const cleanRow: DiscountPreset = {
      label: label.slice(0, 32),
      mode: presetDraft.mode,
      value: Math.round(valueNum * 100) / 100,
    };
    if (editingPreset !== null && editingPreset >= 0 && editingPreset < next.length) {
      next[editingPreset] = cleanRow;
    } else {
      next.push(cleanRow);
    }
    setPresets(next);
    setPresetDraft({ label: '', mode: 'amount', value: '' });
    setEditingPreset(null);
    setCapDirty(true);
  };

  const editPreset = (idx: number) => {
    const row = presets[idx];
    if (!row) return;
    setPresetDraft({
      label: row.label,
      mode: row.mode ?? 'amount',
      value: String(row.value ?? 0),
    });
    setEditingPreset(idx);
  };

  const removePreset = (idx: number) => {
    setPresets(presets.filter((_, i) => i !== idx));
    if (editingPreset === idx) {
      setPresetDraft({ label: '', mode: 'amount', value: '' });
      setEditingPreset(null);
    }
    setCapDirty(true);
  };

  const cancelEdit = () => {
    setPresetDraft({ label: '', mode: 'amount', value: '' });
    setEditingPreset(null);
  };

  const setPresetMode = (mode: 'amount' | 'percent') => {
    setPresetDraft({ ...presetDraft, mode });
  };

  // Save tax (only the rate — discount section saves separately)
  const saveTax = async () => {
    const parsed = parseFloat(taxInput);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setToast({ msg: 'Tax rate must be between 0 and 100 percent.', severity: 'error' });
      return;
    }
    setSavingTax(true);
    try {
      const next = await Settings.setTax(parsed / 100);
      setSettings(next);
      setTaxInput((Number(next.tax_rate ?? 0) * 100).toFixed(2));
      setTaxDirty(false);
      setToast({ msg: `Tax saved at ${parsed.toFixed(2)}%.`, severity: 'success' });
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? 'Failed to update tax', severity: 'error' });
    } finally {
      setSavingTax(false);
    }
  };

  // Save discount section wholesale (cap + require_reason + presets)
  const persistDiscount = async (
    newPresets: DiscountPreset[],
    newCapPct: number,
    newRequireReason: boolean,
  ): Promise<boolean> => {
    if (Number.isNaN(newCapPct) || newCapPct < 0 || newCapPct > 100) {
      setToast({ msg: 'Discount cap must be between 0 and 100 percent.', severity: 'error' });
      return false;
    }
    if (newPresets.length > 8) {
      setToast({ msg: 'Maximum 8 discount presets allowed.', severity: 'error' });
      return false;
    }
    setSavingDiscount(true);
    try {
      const next: DiscountPolicy = await Discount.update({
        presets: newPresets,
        max_discount_pct: newCapPct / 100,
        require_reason: newRequireReason,
      });
      setPresets(next.presets ?? []);
      setCapInput((Number(next.max_discount_pct ?? 0) * 100).toFixed(2));
      setCapDirty(false);
      setToast({ msg: 'Discount policy saved.', severity: 'success' });
      return true;
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.detail ?? 'Failed to save discounts', severity: 'error' });
      return false;
    } finally {
      setSavingDiscount(false);
    }
  };

  const saveDiscounts = () => {
    const capNum = parseFloat(capInput);
    const requireReason = !!(settings as any)?.discount_policy?.require_reason;
    persistDiscount(presets, capNum, requireReason);
  };

  if (loading && !settings) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!settings) {
    return (
      <Box sx={{ flex: 1, p: 3 }}>
        <Alert severity="error">{error ?? 'Could not load settings.'}</Alert>
      </Box>
    );
  }

  const policy = (settings as any).discount_policy ?? {
    max_discount_pct: 0.5,
    presets: [],
    require_reason: true,
  };

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ───── TAX SECTION ───── */}
      <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <PercentIcon sx={{ color }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Tax</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Applied to every new order at checkout. Type any rate between 0 and 100
          (interpreted as a percent of the bill subtotal). No presets — change it
          only when you mean to.
        </Typography>

        <TextField
          label="Tax rate (%)"
          type="number"
          size="small"
          value={taxInput}
          onChange={(e) => { setTaxInput(e.target.value); setTaxDirty(true); }}
          inputProps={{ min: 0, max: 100, step: 0.01 }}
          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          sx={{ width: 220, mr: 1.5 }}
        />
        <Box sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', ml: 0.5 }}>
          {taxDirty && (
            <Button size="small" color="warning" onClick={() => { setTaxInput((Number(settings.tax_rate ?? 0) * 100).toFixed(2)); setTaxDirty(false); }}>
              Discard
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!taxDirty || savingTax}
            onClick={saveTax}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}
          >
            {savingTax ? 'Saving…' : 'Save tax'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Preview: 10% on a $20 subtotal = <strong>$2.00</strong> tax.
        </Typography>
      </Paper>

      {/* ───── DISCOUNT PRESETS SECTION ───── */}
      <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <LocalOfferIcon sx={{ color }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Discount presets</Typography>
          <Chip
            size="small"
            label={`${presets.length}/8`}
            sx={{ ml: 1, borderRadius: `${SHAPE.chip}px`, bgcolor: 'surface.subtle', fontWeight: 700 }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Buttons the cashier can tap on a closed bill. Each preset stores a label
          and a fixed dollar amount. The cashier can only apply presets you define
          here (free-form discount amounts are reserved for admins and capped at
          the percentage below).
        </Typography>

        {/* Cap + require-reason row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            label="Max discount cap (%)"
            type="number"
            size="small"
            value={capInput}
            onChange={(e) => { setCapInput(e.target.value); setCapDirty(true); }}
            inputProps={{ min: 0, max: 100, step: 1 }}
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            sx={{ width: 220 }}
            helperText="Of subtotal; above this amount only admins can apply."
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!policy.require_reason}
                onChange={async (e) => {
                  const newPol: DiscountPolicy = await Discount.update({
                    require_reason: e.target.checked,
                  }).catch(() => policy);
                  setSettings({ ...settings, discount_policy: newPol } as any);
                  setToast({ msg: `Require-reason ${e.target.checked ? 'enabled' : 'disabled'}.`, severity: 'success' });
                }}
              />
            }
            label="Require reason when applying discount"
            sx={{ ml: 1 }}
          />
        </Box>

        {/* Preset list */}
        {presets.length === 0 ? (
          <Box
            sx={{
              border: '1px dashed',
              borderColor: 'border.default',
              borderRadius: `${SHAPE.card}px`,
              p: 2,
              textAlign: 'center',
              color: 'text.secondary',
              mb: 2,
            }}
          >
            No presets yet — add one below to expose quick-pick buttons at checkout.
          </Box>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {presets.map((p, idx) => {
              const isEditing = editingPreset === idx;
              const mode = (p.mode ?? 'amount') as 'amount' | 'percent';
              const valueLabel =
                mode === 'percent'
                  ? `${Number(p.value ?? 0).toFixed(mode === 'percent' && Number.isInteger(p.value) ? 0 : 2)}%`
                  : `$${Number(p.value ?? 0).toFixed(2)}`;
              return (
                <Box
                  key={`${p.label}-${idx}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    borderRadius: `${SHAPE.button}px`,
                    border: '1px solid',
                    borderColor: isEditing ? color : 'border.default',
                    bgcolor: isEditing ? 'rgba(224, 123, 26, 0.06)' : 'surface.paper',
                  }}
                >
                  <Chip
                    size="small"
                    icon={<LocalOfferIcon />}
                    label={p.label}
                    sx={{ borderRadius: `${SHAPE.chip}px`, fontWeight: 700, minWidth: 110 }}
                  />
                  <Chip
                    size="small"
                    label={mode === 'percent' ? '% off' : '$ off'}
                    sx={{
                      borderRadius: `${SHAPE.chip}px`,
                      bgcolor: mode === 'percent' ? 'rgba(124, 58, 168, 0.12)' : 'rgba(43, 108, 255, 0.12)',
                      color: mode === 'percent' ? '#7b3aa8' : '#2b6cff',
                      fontWeight: 700,
                    }}
                  />
                  <Typography sx={{ fontWeight: 700, color: color, fontSize: '1rem' }}>
                    {valueLabel}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {isEditing ? (
                    <Button size="small" onClick={cancelEdit} sx={{ color: 'text.secondary' }}>
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      onClick={() => editPreset(idx)}
                      sx={{
                        minWidth: 40,
                        bgcolor: 'rgba(43, 108, 255, 0.12)',
                        color: '#2b6cff',
                        '&:hover': { bgcolor: 'rgba(43, 108, 255, 0.2)' },
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => removePreset(idx)}
                    sx={{
                      minWidth: 40,
                      bgcolor: 'rgba(216, 69, 60, 0.12)',
                      color: '#d8453c',
                      '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.2)' },
                    }}
                  >
                    Delete
                  </Button>
                </Box>
              );
            })}
          </Stack>
        )}

        {/* Add / edit row */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: `${SHAPE.card}px`,
            borderStyle: 'dashed',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
          }}
        >
          <TextField
            label="Label"
            size="small"
            value={presetDraft.label}
            onChange={(e) => setPresetDraft({ ...presetDraft, label: e.target.value })}
            inputProps={{ maxLength: 32 }}
            sx={{ flex: '1 1 160px', minWidth: 140 }}
            placeholder="VIP / Loyalty / Staff"
          />
          {/* M21.1 — mode toggle (Amount / Percent) + value input.
              Pill pair keeps it tactile without a third dropdown. */}
          <Box
            role="group"
            aria-label="Discount mode"
            sx={{
              display: 'inline-flex',
              border: '1px solid',
              borderColor: 'border.default',
              borderRadius: `${SHAPE.chip}px`,
              overflow: 'hidden',
              height: 40,
              alignSelf: 'center',
            }}
          >
            {(['amount', 'percent'] as const).map((m) => {
              const selected = presetDraft.mode === m;
              return (
                <Box
                  key={m}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPresetMode(m)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPresetMode(m); }
                  }}
                  sx={{
                    px: 1.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    bgcolor: selected ? color : 'surface.paper',
                    color: selected ? 'common.white' : 'text.primary',
                    '&:hover': selected ? {} : { bgcolor: 'surface.muted' },
                  }}
                >
                  {m === 'amount' ? '$ Amount' : '% Percent'}
                </Box>
              );
            })}
          </Box>
          <TextField
            label={presetDraft.mode === 'percent' ? 'Value (%)' : 'Value ($)'}
            type="number"
            size="small"
            value={presetDraft.value}
            onChange={(e) => setPresetDraft({ ...presetDraft, value: e.target.value })}
            inputProps={{
              min: presetDraft.mode === 'percent' ? 0.5 : 0.01,
              max: presetDraft.mode === 'percent' ? 100 : undefined,
              step: presetDraft.mode === 'percent' ? 0.5 : 0.01,
            }}
            sx={{ width: presetDraft.mode === 'percent' ? 130 : 130 }}
          />
          <Button
            size="small"
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={addOrUpdatePreset}
            disabled={presets.length >= 8 && editingPreset === null}
            sx={{
              borderColor: color,
              color,
              '&:hover': { borderColor: color, bgcolor: `${color}11` },
            }}
          >
            {editingPreset !== null ? 'Update preset' : 'Add preset'}
          </Button>
        </Paper>

        {/* Save bar */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          {capDirty && (
            <Button size="small" color="warning" onClick={() => { setCapInput((Number(policy.max_discount_pct ?? 0) * 100).toFixed(2)); setPresets(policy.presets ?? []); setCapDirty(false); }}>
              Discard
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!capDirty || savingDiscount}
            onClick={saveDiscounts}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}
          >
            {savingDiscount ? 'Saving…' : 'Save discounts'}
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: `${SHAPE.button}px` }}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DATABASE WORKSPACE
// ─────────────────────────────────────────────────────────────────────
function DatabaseWorkspace({ color }: { color: string }) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbDraft, setDbDraft] = useState<string>('');
  const [dbDirty, setDbDirty] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Settings.get()
      .then((s) => {
        setSettings(s);
        setDbDraft(s.database_url);
        setDbDirty(false);
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const saveDatabaseUrl = async () => {
    setWorking('save-url');
    try {
      const next = await Settings.setDatabase(dbDraft);
      setSettings(next);
      setDbDraft(next.database_url);
      setDbDirty(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Invalid database URL');
    } finally {
      setWorking(null);
    }
  };

  if (loading && !settings) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!settings) {
    return (
      <Box sx={{ flex: 1, p: 3 }}>
        <Alert severity="error">{error ?? 'Could not load settings.'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3, pb: 0 }}>
      <ColumnHeader title="DATABASE" color={color} />

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={settings.db_kind}
            color={settings.db_kind === 'sqlite' ? 'info' : 'warning'}
            sx={{ borderRadius: `${SHAPE.chip}px`, fontWeight: 700, textTransform: 'uppercase' }}
          />
          <Chip
            size="small"
            icon={settings.db_file_exists ? <CheckCircleIcon /> : <WarningIcon />}
            label={settings.db_file_exists ? 'file ready' : 'file missing'}
            color={settings.db_file_exists ? 'success' : 'error'}
            variant="outlined"
            sx={{ borderRadius: `${SHAPE.chip}px`, fontWeight: 700 }}
          />
        </Box>

        <TextField
          fullWidth
          size="small"
          value={dbDraft}
          onChange={(e) => { setDbDraft(e.target.value); setDbDirty(true); }}
          placeholder="sqlite:///path/to/file.db"
          sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: `${SHAPE.button}px`, fontFamily: 'monospace' } }}
        />

        <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
          {dbDirty && (
            <Button size="small" color="warning" onClick={() => { setDbDraft(settings.database_url); setDbDirty(false); }}>
              Discard
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!dbDirty || working === 'save-url'}
            onClick={saveDatabaseUrl}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}
          >
            {working === 'save-url' ? 'Saving…' : 'Save URL'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DATABASE OPERATIONS WORKSPACE
// ─────────────────────────────────────────────────────────────────────
function DbOpsWorkspace({ color }: { color: string }) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Settings.get()
      .then(setSettings)
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const reloadEngine = async () => {
    setWorking('reload');
    setError(null);
    try {
      const next = await Settings.reloadDatabase();
      setSettings(next);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Reload failed');
    } finally {
      setWorking(null);
    }
  };

  const resetDb = async () => {
    if (!confirm('DELETE all data and re-seed?')) return;
    setWorking('reset');
    setError(null);
    try {
      const next = await Settings.resetDatabase();
      setSettings(next);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Reset failed');
    } finally {
      setWorking(null);
    }
  };

  const restoreDefaults = async () => {
    if (!confirm('Forget saved settings?')) return;
    setWorking('restore');
    setError(null);
    try {
      const next = await Settings.restoreDefaults();
      setSettings(next);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Restore failed');
    } finally {
      setWorking(null);
    }
  };

  const downloadExport = () => {
    const token = localStorage.getItem('brewpos_token');
    if (!token) return;
    fetch(Settings.exportDatabaseUrl(), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `brewpos-${stamp}.db`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(`Export failed: ${e?.message ?? e}`));
  };

  const triggerImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,application/octet-stream';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (!confirm(`Replace database with "${f.name}"?`)) return;
      setWorking('import');
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1] ?? '';
        Settings.importDatabase(b64)
          .then((next) => setSettings(next))
          .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Import failed'))
          .finally(() => setWorking(null));
      };
      reader.readAsDataURL(f);
    };
    input.click();
  };

  if (loading && !settings) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3, pt: 0 }}>
      <ColumnHeader title="DATABASE OPERATIONS" color={color} />

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={4}>
          <OpTile color="#2b6cff" icon={<RefreshIcon />} label="Reload engine" hint="Re-bind to saved URL" busy={working === 'reload'} onClick={reloadEngine} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <OpTile color="#d99317" icon={<WarningIcon />} label="Reset & seed" hint="Clear all data" busy={working === 'reset'} onClick={resetDb} confirm />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <OpTile color="#5b6472" icon={<RestoreIcon />} label="Restore defaults" hint="Forget saved settings" busy={working === 'restore'} onClick={restoreDefaults} confirm />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <OpTile color="#0c8a7a" icon={<DownloadIcon />} label="Export .db" hint="Download backup" onClick={downloadExport} disabled={settings?.db_kind !== 'sqlite'} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <OpTile color="#6b46d3" icon={<UploadIcon />} label="Import .db" hint="Restore backup" onClick={triggerImport} busy={working === 'import'} confirm disabled={settings?.db_kind !== 'sqlite'} />
        </Grid>
      </Grid>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// OpTile — reusable operation button
// ─────────────────────────────────────────────────────────────────────
function OpTile({
  color, icon, label, hint, busy, onClick, confirm, disabled,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  busy?: boolean;
  onClick: () => void;
  confirm?: boolean;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (confirm && !confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    onClick();
  };

  return (
    <Paper sx={{ p: 1.5, borderRadius: `${SHAPE.card}px`, border: '1px solid', borderColor: confirming ? color : 'border.default', opacity: disabled ? 0.5 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box sx={{ color }}>{icon}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</Typography>
        {busy && <CircularProgress size={16} sx={{ ml: 'auto' }} />}
      </Box>
      <Typography variant="caption" color="text.secondary">{hint}</Typography>
      <Button
        size="small"
        variant={confirming ? 'contained' : 'outlined'}
        onClick={handleClick}
        disabled={disabled || busy}
        sx={{ mt: 1, borderRadius: `${SHAPE.button}px`, minHeight: 32, fontWeight: 700, fontSize: '0.75rem', width: '100%', color: confirming ? 'common.white' : color, borderColor: color, bgcolor: confirming ? color : 'transparent' }}
      >
        {confirming ? 'Click to confirm' : 'Run'}
    </Button>
  </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PRINTER WORKSPACE — admin form for thermal-printer config
//
// Layout: two columns inside the workspace Paper.
//   LEFT  — scrollable form (mode, network/usb, paper, header/footer
//           line editors, auto_print toggles, dry_run)
//   RIGHT — sticky "Test Print" card with the last PrintResult so the
//           admin can immediately confirm a config change actually fires
//
// All fields are local-edits until Save; dirty flag drives the Save
// button so admins can't accidentally PUT a no-op.
// ─────────────────────────────────────────────────────────────────────
function PrinterWorkspace({ color }: { color: string }) {
  const [cfg, setCfg] = useState<PrinterConfig | null>(null);
  const [draft, setDraft] = useState<PrinterConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [lastTest, setLastTest] = useState<PrintResult | null>(null);

  useEffect(() => {
    Printer.get()
      .then((c) => { setCfg(c); setDraft(c); })
      .catch((e: any) => setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load printer config'))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !draft) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
     </Box>
    );
  }

  const dirty = JSON.stringify(cfg) !== JSON.stringify(draft);

  const update = (patch: Partial<PrinterConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updatePaper = (patch: Partial<PrinterConfig['paper']>) =>
    setDraft((d) => (d ? { ...d, paper: { ...d.paper, ...patch } } : d));
  const updateAutoPrint = (patch: Partial<PrinterConfig['auto_print']>) =>
    setDraft((d) => (d ? { ...d, auto_print: { ...d.auto_print, ...patch } } : d));
  const updateNetwork = (patch: Partial<PrinterConfig['network']>) =>
    setDraft((d) => (d ? { ...d, network: { ...d.network, ...patch } } : d));
  const updateUsb = (patch: Partial<PrinterConfig['usb']>) =>
    setDraft((d) => (d ? { ...d, usb: { ...d.usb, ...patch } } : d));

  const setHeaderLine = (i: number, v: string) => {
    const next = [...draft.paper.header_lines];
    next[i] = v;
    updatePaper({ header_lines: next });
  };
  const addHeaderLine = () => {
    if (draft.paper.header_lines.length >= 5) return;
    updatePaper({ header_lines: [...draft.paper.header_lines, ''] });
  };
  const removeHeaderLine = (i: number) => {
    updatePaper({ header_lines: draft.paper.header_lines.filter((_, idx) => idx !== i) });
  };
  const setFooterLine = (i: number, v: string) => {
    const next = [...draft.paper.footer_lines];
    next[i] = v;
    updatePaper({ footer_lines: next });
  };
  const addFooterLine = () => {
    if (draft.paper.footer_lines.length >= 5) return;
    updatePaper({ footer_lines: [...draft.paper.footer_lines, ''] });
  };
  const removeFooterLine = (i: number) => {
    updatePaper({ footer_lines: draft.paper.footer_lines.filter((_, idx) => idx !== i) });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await Printer.update(draft);
      setCfg(saved);
      setDraft(saved);
      setToast({ msg: 'Printer settings saved', severity: 'success' });
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Save failed';
      setToast({ msg: typeof detail === 'string' ? detail : JSON.stringify(detail), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (cfg) setDraft(cfg);
  };

  const testPrint = async () => {
    setTesting(true);
    try {
      // If there are unsaved edits, push them first so Test Print reflects
      // what the admin sees on screen.
      if (dirty) {
        const saved = await Printer.update(draft);
        setCfg(saved);
        setDraft(saved);
      }
      const res = await Printer.test();
      setLastTest(res);
      setToast({
        msg: res.ok
          ? `Test print fired · ${res.bytes_written} bytes · ${res.elapsed_ms} ms`
          : `Test print failed · ${res.error ?? 'unknown error'}`,
        severity: res.ok ? 'success' : 'error',
      });
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Test print request failed';
      setToast({ msg: typeof detail === 'string' ? detail : JSON.stringify(detail), severity: 'error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* ── LEFT: scrollable form ───────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: `${SHAPE.card}px` }}>
            {error}
         </Alert>
        )}

        {/* MODE */}
        <Section title="Mode" color={color}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {([
              { v: 'dummy', label: 'Dummy', icon: <PrintOutlinedIcon />, hint: 'Throw away · for dev' },
              { v: 'network', label: 'Network', icon: <RouterIcon />, hint: 'IP:port over LAN' },
              { v: 'usb', label: 'USB', icon: <UsbIcon />, hint: 'Direct-attached' },
            ] as const).map((opt) => {
              const selected = draft.mode === opt.v;
              return (
                <Box
                  key={opt.v}
                  role="button"
                  tabIndex={0}
                  onClick={() => update({ mode: opt.v })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') update({ mode: opt.v }); }}
                  sx={{
                    flex: '1 1 160px',
                    minHeight: 64,
                    p: 1.5,
                    borderRadius: `${SHAPE.card}px`,
                    border: '2px solid',
                    borderColor: selected ? color : 'border.default',
                    bgcolor: selected ? `${color}10` : 'surface.paper',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    transition: 'border-color 0.1s, background-color 0.1s',
                    '&:hover': { bgcolor: selected ? `${color}18` : 'surface.muted' },
                    '&:focus-visible': { outline: `2px solid ${color}`, outlineOffset: 2 },
                  }}
                >
                  <Box sx={{ color: selected ? color : 'text.secondary', display: 'flex' }}>{opt.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, color: selected ? color : 'text.primary' }}>{opt.label}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{opt.hint}</Typography>
                 </Box>
               </Box>
              );
            })}
         </Box>
       </Section>

        {/* NETWORK target (only when mode=network) */}
        {draft.mode === 'network' && (
          <Section title="Network target" color={color}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" label="Host" placeholder="192.168.1.50"
                  value={draft.network.host}
                  onChange={(e) => updateNetwork({ host: e.target.value })}
                  InputProps={{ startAdornment: <InputAdornment position="start"><NetworkCheckIcon sx={{ fontSize: 18 }} /></InputAdornment> }}
                />
             </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth size="small" label="Port" type="number"
                  value={draft.network.port}
                  onChange={(e) => updateNetwork({ port: parseInt(e.target.value || '0', 10) || 0 })}
                />
             </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth size="small" label="Timeout (s)" type="number"
                  value={draft.network.timeout_sec}
                  onChange={(e) => updateNetwork({ timeout_sec: parseFloat(e.target.value || '0') || 0 })}
                />
             </Grid>
           </Grid>
         </Section>
        )}

        {/* USB target (only when mode=usb) */}
        {draft.mode === 'usb' && (
          <Section title="USB device" color={color}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth size="small" label="Vendor ID (hex)" placeholder="0x04b8"
                  value={draft.usb.vendor_id}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/^0x/i, ''), 16);
                    updateUsb({ vendor_id: isNaN(n) ? 0 : n });
                  }}
                />
             </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth size="small" label="Product ID (hex)" placeholder="0x0202"
                  value={draft.usb.product_id}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/^0x/i, ''), 16);
                    updateUsb({ product_id: isNaN(n) ? 0 : n });
                  }}
                />
             </Grid>
           </Grid>
         </Section>
        )}

        {/* PAPER */}
        <Section title="Paper" color={color}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {([58, 80] as const).map((w) => {
              const selected = draft.paper.width_mm === w;
              return (
                <Box
                  key={w}
                  role="button"
                  tabIndex={0}
                  onClick={() => updatePaper({ width_mm: w })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') updatePaper({ width_mm: w }); }}
                  sx={{
                    flex: 1, minHeight: 48,
                    p: 1.25, borderRadius: `${SHAPE.button}px`,
                    border: '2px solid',
                    borderColor: selected ? color : 'border.default',
                    bgcolor: selected ? `${color}10` : 'surface.paper',
                    cursor: 'pointer', fontWeight: 700,
                    textAlign: 'center',
                    color: selected ? color : 'text.primary',
                    '&:focus-visible': { outline: `2px solid ${color}`, outlineOffset: 2 },
                  }}
                >
                  {w} mm
               </Box>
              );
            })}
         </Box>

          {/* Header lines */}
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
            HEADER LINES (max 5)
         </Typography>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {draft.paper.header_lines.map((line, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth size="small" placeholder={`Line ${i + 1}`}
                  value={line}
                  onChange={(e) => setHeaderLine(i, e.target.value)}
                />
                <Button
                  size="small" color="error" variant="outlined"
                  onClick={() => removeHeaderLine(i)}
                  sx={{ minWidth: 44, borderRadius: `${SHAPE.button}px` }}
                >
                  <DeleteOutlineIcon fontSize="small" />
               </Button>
             </Box>
            ))}
            <Button
              size="small" variant="outlined" startIcon={<AddIcon />}
              onClick={addHeaderLine}
              disabled={draft.paper.header_lines.length >= 5}
              sx={{ alignSelf: 'flex-start', borderRadius: `${SHAPE.button}px`, borderColor: color, color }}
            >
              Add header line
           </Button>
         </Stack>

          {/* Footer lines */}
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
            FOOTER LINES (max 5)
         </Typography>
          <Stack spacing={1} sx={{ mb: 1.5 }}>
            {draft.paper.footer_lines.map((line, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth size="small" placeholder={`Line ${i + 1}`}
                  value={line}
                  onChange={(e) => setFooterLine(i, e.target.value)}
                />
                <Button
                  size="small" color="error" variant="outlined"
                  onClick={() => removeFooterLine(i)}
                  sx={{ minWidth: 44, borderRadius: `${SHAPE.button}px` }}
                >
                  <DeleteOutlineIcon fontSize="small" />
               </Button>
             </Box>
            ))}
            <Button
              size="small" variant="outlined" startIcon={<AddIcon />}
              onClick={addFooterLine}
              disabled={draft.paper.footer_lines.length >= 5}
              sx={{ alignSelf: 'flex-start', borderRadius: `${SHAPE.button}px`, borderColor: color, color }}
            >
              Add footer line
           </Button>
         </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={draft.paper.cut_paper}
                onChange={(e) => updatePaper({ cut_paper: e.target.checked })}
                color="primary"
              />
            }
            label={<Typography sx={{ fontWeight: 600 }}>Auto-cut paper at end (GS V 0</Typography>}
          />
       </Section>

        {/* AUTO-PRINT */}
        <Section title="Automatic printing" color={color}>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={draft.auto_print.on_send_to_kitchen}
                  onChange={(e) => updateAutoPrint({ on_send_to_kitchen: e.target.checked })}
                  color="primary"
                />
              }
              label={<Typography sx={{ fontWeight: 600 }}>Print kitchen ticket on checkout</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.auto_print.on_payment}
                  onChange={(e) => updateAutoPrint({ on_payment: e.target.checked })}
                  color="primary"
                />
              }
              label={<Typography sx={{ fontWeight: 600 }}>Print customer receipt on payment</Typography>}
            />
         </Stack>
       </Section>

        {/* DRY-RUN */}
        <Section title="Diagnostics" color={color}>
          <FormControlLabel
            control={
              <Switch
                checked={draft.dry_run}
                onChange={(e) => update({ dry_run: e.target.checked })}
                color="warning"
              />
            }
            label={
              <Box>
                <Typography sx={{ fontWeight: 700 }}>Dry-run mode</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Build bytes but don't send to the printer. Logs each ticket as `[dry-run]`.
               </Typography>
             </Box>
            }
          />
       </Section>

        {/* Save / Reset */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 1 }}>
          <Button
            variant="outlined"
            onClick={reset}
            disabled={!dirty || saving}
            sx={{ borderRadius: `${SHAPE.button}px`, fontWeight: 700 }}
          >
            Discard changes
         </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={!dirty || saving}
            sx={{
              bgcolor: color, borderRadius: `${SHAPE.button}px`, fontWeight: 700,
              '&:hover': { bgcolor: color, filter: 'brightness(0.92)' },
            }}
          >
            {saving ? 'Saving…' : 'Save settings'}
         </Button>
       </Box>
     </Box>

      <Divider orientation="vertical" flexItem />

      {/* ── RIGHT: Test Print card (sticky) ─────────────────────────── */}
      <Box
        sx={{
          width: 340, minWidth: 280, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid', borderColor: 'border.default',
          bgcolor: 'surface.paper',
        }}
      >
        <ColumnHeader title="TEST PRINT" color={color} />
        <Box sx={{ flex: 1, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Fires a tiny test ticket through the configured sender and returns the
            raw <code>PrintResult</code>. Use this to verify reachability before a
            real checkout — the backend always replies with bytes_written even in
            dummy / dry_run modes.
         </Typography>

          <Button
            variant="contained"
            size="large"
            startIcon={testing ? <CircularProgress size={16} sx={{ color: 'common.white' }} /> : <PrintIcon />}
            onClick={testPrint}
            disabled={testing || saving}
            sx={{
              bgcolor: color, fontWeight: 800,
              borderRadius: `${SHAPE.button}px`, minHeight: 56,
              '&:hover': { bgcolor: color, filter: 'brightness(0.92)' },
            }}
          >
            {testing ? 'Printing…' : 'Run Test Print'}
         </Button>

          {lastTest && (
            <Paper sx={{ p: 2, borderRadius: `${SHAPE.card}px`, border: '1px solid', borderColor: lastTest.ok ? 'success.main' : 'error.main' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {lastTest.ok
                  ? <CheckCircleIcon sx={{ color: 'success.main' }} />
                  : <WarningIcon sx={{ color: 'error.main' }} />}
                <Typography sx={{ fontWeight: 800, color: lastTest.ok ? 'success.main' : 'error.main' }}>
                  {lastTest.ok ? 'Last print OK' : 'Last print FAILED'}
               </Typography>
             </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 0.5, columnGap: 1.5, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                <Typography sx={{ color: 'text.secondary' }}>mode</Typography><Typography>{lastTest.mode}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>dry_run</Typography><Typography>{String(lastTest.dry_run)}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>bytes</Typography><Typography>{lastTest.bytes_written}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>elapsed</Typography><Typography>{lastTest.elapsed_ms} ms</Typography>
                {lastTest.error && (<><Typography sx={{ color: 'error.main' }}>error</Typography><Typography sx={{ color: 'error.main', wordBreak: 'break-word' }}>{lastTest.error}</Typography></>)}
             </Box>
           </Paper>
          )}
       </Box>
     </Box>

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: `${SHAPE.button}px` }}
          >
            {toast.msg}
         </Alert>
        ) : undefined}
      </Snackbar>
   </Box>
  );
}

// ── Section — small labelled card wrapper for the printer form ────────
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <Paper
      sx={{
        p: 2, borderRadius: `${SHAPE.card}px`,
        border: '1px solid', borderColor: 'border.default',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 4, height: 16, bgcolor: color, borderRadius: '2px' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
     </Box>
      {children}
   </Paper>
  );
}

