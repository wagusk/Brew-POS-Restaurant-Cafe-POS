import { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Button, Chip,
  Dialog, DialogTitle, DialogContent, TextField,
  Switch, FormControlLabel, Stack, Divider, InputAdornment,
  Alert, CircularProgress,
} from '@mui/material';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import BarChartIcon from '@mui/icons-material/BarChart';
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
import { Admin, Settings, type SettingsPayload } from '../lib/api';
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
type MainKey = 'products' | 'tables' | 'tax' | 'database' | 'dbops';

const MAIN_COLOR: Record<MainKey, string> = {
  products: '#2b6cff',
  tables: '#0c8a7a',
  tax: '#e07b1a',
  database: '#5b6472',
  dbops: '#5b6472',
};

interface MainItem {
  key: MainKey;
  label: string;
  icon: React.ReactNode;
}

const MAIN_ITEMS: MainItem[] = [
  { key: 'products', label: 'Products', icon: <RestaurantMenuIcon /> },
  { key: 'tables', label: 'Tables', icon: <TableRestaurantIcon /> },
  { key: 'tax', label: 'Tax', icon: <PercentIcon /> },
  { key: 'database', label: 'Database', icon: <StorageIcon /> },
  { key: 'dbops', label: 'Database Ops', icon: <RefreshIcon /> },
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
  active, color, label, sublabel, onClick, accent, leading,
}: {
  active: boolean;
  color: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  accent?: boolean;
  leading?: React.ReactNode;
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
      {active && <ChevronRightIcon sx={{ fontSize: 18, color }} />}
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
  const [main, setMain] = useState<MainKey>('products');

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
        {main === 'products' && (
          <ProductsNestedWorkspace color={color} />
        )}
        {main === 'tables' && (
          <TablesWorkspace color={color} />
        )}
        {main === 'tax' && (
          <TaxWorkspace color={color} />
        )}
        {main === 'database' && (
          <DatabaseWorkspace color={color} />
        )}
        {main === 'dbops' && (
          <DbOpsWorkspace color={color} />
        )}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PRODUCTS NESTED WORKSPACE — 4 columns deep
// Products > Categories > Menu Items > Item Settings
// ─────────────────────────────────────────────────────────────────────
function ProductsNestedWorkspace({ color }: { color: string }) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);

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

  const saveCategory = async (payload: { name: string; color: string; icon?: string; sort?: number }) => {
    const created = await Admin.createCategory(payload);
    reloadCategories();
    setSelectedCategoryId((created as AdminCategory).id);
    setCreatingCategory(false);
  };

  const saveProduct = async (payload: { name: string; price: number; category_id: number; active?: boolean }) => {
    const created = await Admin.createProduct(payload);
    reloadProducts();
    setSelectedProductId((created as AdminProduct).id);
    setCreatingProduct(false);
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
              sublabel={c.kind ?? 'kitchen'}
              onClick={() => setSelectedCategoryId(c.id)}
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
          ) : products.map((p) => (
            <ListItemButton
              key={p.id}
              active={selectedProductId === p.id}
              color={selectedCategory?.color ?? '#2b6cff'}
              label={p.name}
              sublabel={`$${p.price.toFixed(2)}`}
              onClick={() => setSelectedProductId(p.id)}
            />
          ))}
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
            color={color}
          />
        ) : (
          <ColumnEmpty message="Select a product to edit" />
        )}
      </Paper>

      {/* New Category Dialog */}
      {creatingCategory && (
        <CategoryCreateDialog
          onSave={saveCategory}
          onClose={() => setCreatingCategory(false)}
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
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Category Create Dialog
// ─────────────────────────────────────────────────────────────────────
function CategoryCreateDialog({
  onSave,
  onClose,
}: {
  onSave: (p: { name: string; color: string; icon?: string; sort?: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0c8a7a');

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New Category</DialogTitle>
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
            label="Color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            fullWidth
            size="small"
          />
        </Stack>
      </DialogContent>
      <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSave({ name, color })}
          disabled={!name.trim()}
          sx={{ bgcolor: '#0c8a7a', '&:hover': { bgcolor: '#0c8a7a' } }}
        >
          Create
        </Button>
      </Box>
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
  color,
}: {
  product: AdminProduct;
  category: AdminCategory | null;
  onSave: () => void;
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

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
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
function TaxWorkspace({ color }: { color: string }) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxDraft, setTaxDraft] = useState<number>(0.10);
  const [taxDirty, setTaxDirty] = useState(false);
  const [savingTax, setSavingTax] = useState(false);

  const reload = () => {
    setLoading(true);
    Settings.get()
      .then((s) => {
        setSettings(s);
        setTaxDraft(s.tax_rate);
        setTaxDirty(false);
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const saveTax = async () => {
    setSavingTax(true);
    try {
      const next = await Settings.setTax(taxDraft);
      setSettings(next);
      setTaxDraft(next.tax_rate);
      setTaxDirty(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to update tax');
    } finally {
      setSavingTax(false);
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
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <ColumnHeader title="TAX" color={color} />

      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color, mt: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '2.5rem', lineHeight: 1, color: 'text.primary', mb: 0.5 }}>
          {(taxDraft * 100).toFixed(2)}%
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Applied to every new order at checkout.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          {[0, 5, 8, 10, 12.5, 15].map((pct) => (
            <Chip
              key={pct}
              size="small"
              label={`${pct}%`}
              clickable
              onClick={() => { setTaxDraft(pct / 100); setTaxDirty(true); }}
              sx={{ borderRadius: `${SHAPE.chip}px`, fontWeight: 700 }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          {taxDirty && (
            <Button size="small" color="warning" onClick={() => { setTaxDraft(settings.tax_rate); setTaxDirty(false); }}>
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
      </Paper>
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
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
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
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
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
