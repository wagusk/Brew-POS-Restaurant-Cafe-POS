import { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Grid, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Switch, FormControlLabel, Stack, Divider, Tooltip, InputAdornment,
  Slider, Alert, CircularProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Snackbar,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import BarChartIcon from '@mui/icons-material/BarChart';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StorageIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import PercentIcon from '@mui/icons-material/Percent';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Admin, Orders, Settings, Reports, Discount, type SettingsPayload, type DiscountPreset, type DiscountPolicy } from '../lib/api';
import { ws } from '../lib/ws';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMenu } from '../store/menuSlice';
import type { AdminCategory, AdminProduct, AdminTable, AdminUser } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────
// SHARP THEME OVERRIDES — admin uses tighter radii (4-8px) than the
// rest of the app. We do this locally so the rest of the system keeps
// the 12px baseline and admin reads as a "control panel" workspace.
// ─────────────────────────────────────────────────────────────────────
const SHAPE = {
  card: 6,        // tighter card corners
  button: 4,      // crisp button corners
  chip: 4,        // squared chip
  iconBtn: 4,     // squared icon button
  dialog: 8,      // sharp dialog corners
};

// ── Main menu color codes ────────────────────────────────────────────
// Each main-menu entry owns one color. The color carries through the
// column-1 icon, the column-2 selected item, the column-3 accent bar,
// and the dialog Save button.
type MainKey = 'stats' | 'reports' | 'users' | 'products' | 'tables' | 'taxdiscounts';

const MAIN_COLOR: Record<MainKey, string> = {
  stats: '#6b46d3',
  reports: '#6b46d3',
  users: '#6b46d3',
  products: '#e07b1a',
  tables: '#0c8a7a',
  taxdiscounts: '#d63031',
};

interface MainItem {
  key: MainKey;
  label: string;
  icon: React.ReactNode;
}

const MAIN_ITEMS: MainItem[] = [
  { key: 'stats', label: 'Stats', icon: <BarChartIcon /> },
  { key: 'reports', label: 'Reports', icon: <BarChartIcon /> },
  { key: 'users', label: 'Users', icon: <PeopleIcon /> },
  { key: 'products', label: 'Products', icon: <RestaurantMenuIcon /> },
  { key: 'tables', label: 'Tables', icon: <TableRestaurantIcon /> },
  { key: 'taxdiscounts', label: 'Tax & Discounts', icon: <PercentIcon /> },
];

// ── Role filter for Users tab ────────────────────────────────────────
// Mirrors the cashier menu's "category chip filter" — picks the
// secondary dimension (role) and lists users in it.
type RoleKey = 'all' | 'admin' | 'master' | 'cashier' | 'waiter' | 'kitchen';

const ROLE_LIST: { key: RoleKey; label: string; color: string }[] = [
  { key: 'all',     label: 'All',     color: '#5b6472' },
  { key: 'admin',   label: 'Admin',   color: '#6b46d3' },
  { key: 'master',  label: 'Master',  color: '#d63031' },
  { key: 'cashier', label: 'Cashier', color: '#2b6cff' },
  { key: 'waiter',  label: 'Waiter',  color: '#0c8a7a' },
  { key: 'kitchen', label: 'Kitchen', color: '#e07b1a' },
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
// Reusable: ListItemButton (sharp rectangular tile used in every column)
// ─────────────────────────────────────────────────────────────────────
function ListItemButton({
  active, color, label, sublabel, onClick, accent, leading,
}: {
  active: boolean;
  color: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  accent?: boolean;   // show left accent stripe
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
export default function AdminPage() {
  const [main, setMain] = useState<MainKey>('stats');
  const [stats, setStats] = useState({ today_orders: 0, today_revenue: 0, open_tickets: 0, avg_ticket: 0 });

  const reloadStats = () => {
    Orders.stats().then(setStats).catch(() => {});
  };

  useEffect(() => {
    reloadStats();
    const off = ws.on(() => reloadStats());
    return () => { off(); };
  }, []);

  const color = MAIN_COLOR[main];

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'surface.page' }}>
      {/* TOP STRIP — bigger than before, shows the role color */}
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
          <PeopleIcon />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Admin
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {MAIN_ITEMS.find((m) => m.key === main)?.label} workspace
          </Typography>
        </Box>
      </Box>

      {/* CASCADING COLUMNS — depending on `main`, the number of visible
          columns changes (1 to 4). Each column is 25% width when shown. */}
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
        {main === 'stats' && (
          <StatsWorkspace color={color} stats={stats} />
        )}
        {main === 'reports' && (
          <ReportsWorkspace color={color} />
        )}
        {main === 'users' && (
          <UsersWorkspace color={color} />
        )}
        {/* M25 — Products / Tables / Tax & Discounts moved here from Settings. */}
        {main === 'products' && (
          <ProductsWorkspace color={MAIN_COLOR.products} />
        )}
        {main === 'tables' && (
          <TablesWorkspace color={MAIN_COLOR.tables} />
        )}
        {main === 'taxdiscounts' && (
          <TaxDiscountsWorkspace color={MAIN_COLOR.taxdiscounts} />
        )}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STATS WORKSPACE — 1 column (no sub-menu needed)
// ─────────────────────────────────────────────────────────────────────
function StatsWorkspace({ color, stats }: { color: string; stats: any }) {
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
      <ColumnHeader title="TODAY" color={color} />
      <Box sx={{ p: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Orders" value={stats.today_orders} icon={<ReceiptIcon />} color={MAIN_COLOR.users} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Revenue" value={`$${stats.today_revenue.toFixed(2)}`} icon={<AttachMoneyIcon />} color={MAIN_COLOR.products} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Open Tickets" value={stats.open_tickets} icon={<HourglassEmptyIcon />} color="#e07b1a" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Avg. Ticket" value={`$${stats.avg_ticket.toFixed(2)}`} icon={<RestaurantIcon />} color={MAIN_COLOR.stats} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: any; icon: React.ReactNode; color: string }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: `${SHAPE.card}px`,
        borderTop: '4px solid',
        borderTopColor: color,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color }}>
        {icon}
        <Typography variant="overline" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h3" sx={{ fontWeight: 700, mt: 1, lineHeight: 1 }}>
        {value}
      </Typography>
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────
// REPORTS WORKSPACE — sales, items, payments, bills with pie charts
// ─────────────────────────────────────────────────────────────────────
type ReportPeriod = 'day' | 'week' | 'month' | 'all' | 'custom';
type ReportStatus = 'all' | 'paid' | 'cancelled' | 'open' | 'accepted' | 'preparing' | 'ready' | 'served';
type ReportTab = 'sales' | 'items' | 'payments' | 'bills';

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'sales', label: 'Sales Summary' },
  { key: 'items', label: 'Item Sales' },
  { key: 'payments', label: 'Payment Methods' },
  { key: 'bills', label: 'Bill History' },
];

function ReportsWorkspace({ color }: { color: string }) {
  const [period, setPeriod] = useState<ReportPeriod>('all');
  const [tab, setTab] = useState<ReportTab>('sales');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [billStatus, setBillStatus] = useState<ReportStatus>('all');
  const [loading, setLoading] = useState(false);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [categorySales, setCategorySales] = useState<any[]>([]);
  const [itemSales, setItemSales] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [billHistory, setBillHistory] = useState<any[]>([]);

  const loadReports = async () => {
    setLoading(true);
    try {
      // Build params based on period
      const startDate = period === 'custom' ? customStart : undefined;
      const endDate = period === 'custom' ? customEnd : undefined;

      const [sales, categories, items, payments, bills] = await Promise.all([
        Reports.salesSummary(period, startDate, endDate),
        Reports.salesByCategory(period, startDate, endDate),
        Reports.itemSales(period, startDate, endDate),
        Reports.paymentMethods(period, startDate, endDate),
        Reports.billHistory(period, startDate, endDate, tab === 'bills' && billStatus !== 'all' ? billStatus : undefined),
      ]);
      setSalesSummary(sales);
      setCategorySales(categories);
      setItemSales(items);
      setPaymentMethods(payments);
      setBillHistory(bills);
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load on period/date/billStatus change (immediate calculation)
  useEffect(() => {
    if (period === 'custom') {
      // For custom, require both dates
      if (customStart && customEnd) {
        loadReports();
      }
    } else {
      loadReports();
    }
  }, [period, customStart, customEnd, billStatus, tab]);

  // Color palette for pie charts
  const COLORS = ['#6b46d3', '#2b6cff', '#0c8a7a', '#e07b1a', '#d63031', '#00b894', '#fd79a8', '#6c5ce7'];

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  // Helper to get period label for display
  const getPeriodLabel = () => {
    if (period === 'all') return 'All time';
    if (period === 'custom' && customStart && customEnd) {
      return `${customStart} to ${customEnd}`;
    }
    const today = new Date();
    if (period === 'day') return today.toLocaleDateString();
    if (period === 'week') {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    if (period === 'month') {
      return `${today.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    }
    return 'Today';
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* COLUMN 1: Report Type Selector */}
      <Paper
        square
        sx={{
          width: '25%',
          minWidth: 220,
          maxWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderLeft: 'none', borderBottom: 'none',
          borderRadius: 0,
        }}
      >
        <ColumnHeader title="REPORTS" color={color} count={REPORT_TABS.length} />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {REPORT_TABS.map((t) => (
            <ListItemButton
              key={t.key}
              active={tab === t.key}
              color={color}
              label={t.label}
              onClick={() => setTab(t.key)}
              accent={tab === t.key}
            />
          ))}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 2: Report View */}
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Filter Bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'border.default', bgcolor: 'surface.paper' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <CalendarTodayIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Filter:</Typography>
            
            {/* Quick Period Buttons */}
            {(['day', 'week', 'month', 'all'] as ReportPeriod[]).map((p) => (
              <Chip
                key={p}
                label={p === 'all' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
                onClick={() => {
                  setPeriod(p);
                  setCustomStart('');
                  setCustomEnd('');
                }}
                color={period === p ? 'primary' : 'default'}
                sx={{ fontWeight: 600 }}
              />
            ))}
            
            {/* Custom Date Range */}
            <Chip
              label="Custom"
              onClick={() => setPeriod('custom')}
              color={period === 'custom' ? 'primary' : 'default'}
              sx={{ fontWeight: 600 }}
            />
            
            {/* Custom Date Inputs */}
            {period === 'custom' && (
              <>
                <TextField
                  type="date"
                  size="small"
                  label="From"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  sx={{ width: 150 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  type="date"
                  size="small"
                  label="To"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  sx={{ width: 150 }}
                  InputLabelProps={{ shrink: true }}
                />
              </>
            )}
            
            <Box sx={{ flex: 1 }} />
            
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {getPeriodLabel()}
            </Typography>
            
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadReports}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Report Content */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {tab === 'sales' && salesSummary && (
                <Box>
                  {/* Summary Cards */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, borderTop: `4px solid ${color}` }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Revenue</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{formatCurrency(salesSummary.total_revenue)}</Typography>
                    </Paper>
                  </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, borderTop: `4px solid ${color}` }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Orders</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{salesSummary.total_orders}</Typography>
                     </Paper>
                   </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, borderTop: `4px solid ${color}` }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Items Sold</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{salesSummary.total_items_sold ?? 0}</Typography>
                     </Paper>
                   </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, borderTop: `4px solid ${color}` }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Avg Order</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{formatCurrency(salesSummary.avg_order_value)}</Typography>
                    </Paper>
                  </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper sx={{ p: 2, borderTop: `4px solid #00b894` }}>
                        <Typography variant="overline" sx={{ color: 'text.secondary' }}>Profit (Est.)</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#00b894' }}>{formatCurrency(salesSummary.profit)}</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                  {/* Category Sales Pie Chart */}
                  {categorySales.length > 0 && (
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Sales by Category</Typography>
                      <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categorySales}
                              dataKey="revenue"
                              nameKey="category_name"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            >
                              {categorySales.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.category_color || COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  )}
                </Box>
              )}

              {tab === 'items' && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Top Selling Items</Typography>
                  <Box sx={{ height: 300, mb: 2 }}>
                    {itemSales.length > 0 && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={itemSales.slice(0, 8)}
                            dataKey="revenue"
                            nameKey="product_name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          >
                            {itemSales.slice(0, 8).map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.category_color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                  {/* Table */}
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itemSales.slice(0, 20).map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>
                              <Chip size="small" label={item.category_name} sx={{ bgcolor: item.category_color, color: '#fff', height: 24 }} />
                            </TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">{formatCurrency(item.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {tab === 'payments' && (
                <Box>
                  {/* Payment Methods Pie Chart */}
                  {paymentMethods.length > 0 && (
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Payment Methods</Typography>
                      <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={paymentMethods}
                              dataKey="amount"
                              nameKey="method"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            >
                              {paymentMethods.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  )}

                  {/* Payment Summary Table */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Payment Details</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Transactions</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>% of Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paymentMethods.map((pm: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{pm.method}</TableCell>
                              <TableCell align="right">{pm.count}</TableCell>
                              <TableCell align="right">{formatCurrency(pm.amount)}</TableCell>
                              <TableCell align="right">{pm.percentage}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>
              )}

              {tab === 'bills' && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Bill History</Typography>
                  <TableContainer sx={{ maxHeight: 500 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Table/Customer</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {billHistory.map((bill: any) => (
                          <TableRow key={bill.order_id}>
                            <TableCell>#{bill.order_number}</TableCell>
                            <TableCell>
                              <Typography variant="body2">{bill.table_name || '-'}</Typography>
                              <Typography variant="caption" color="text.secondary">{bill.customer_name || '-'}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                size="small" 
                                label={bill.status} 
                                color={bill.status === 'paid' ? 'success' : bill.status === 'open' ? 'warning' : 'default'}
                              />
                            </TableCell>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{bill.payment_method || '-'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(bill.total)}</TableCell>
                            <TableCell>{new Date(bill.created_at).toLocaleTimeString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function CategoryDialog({ open, initial, onClose, onSave }: {
  open: boolean;
  initial?: AdminCategory;
  onClose: () => void;
  onSave: (p: { name: string; color: string; kind: 'kitchen' | 'bar' | 'both'; icon?: string; sort?: number }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#e07b1a');
  const [kind, setKind] = useState<'kitchen' | 'bar' | 'both'>('kitchen');
  const [sort, setSort] = useState(0);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setColor(initial?.color ?? '#e07b1a');
      setKind((initial?.kind as 'kitchen' | 'bar' | 'both') ?? 'kitchen');
      setSort(initial?.sort ?? 0);
    }
  }, [open, initial]);

  const validColor = /^#[0-9a-fA-F]{6}$/.test(color);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{initial ? 'Edit Category' : 'Add Category'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" autoFocus />
          <TextField
            select
            label="Station"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'kitchen' | 'bar' | 'both')}
            fullWidth
            size="small"
            helperText="Which prep station handles orders in this category."
          >
            <MenuItem value="kitchen">Kitchen</MenuItem>
            <MenuItem value="bar">Bar</MenuItem>
            <MenuItem value="both">Both</MenuItem>
        </TextField>
          <TextField label="Sort order" type="number" value={sort} onChange={(e) => setSort(parseInt(e.target.value) || 0)} fullWidth size="small" />
          <Box>
            <Typography variant="caption" color="text.secondary">Color</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 48, height: 48, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}
              />
              <TextField value={color} onChange={(e) => setColor(e.target.value)} size="small" sx={{ flex: 1 }} placeholder="#rrggbb" />
              <Box sx={{ width: 48, height: 48, borderRadius: `${SHAPE.button}px`, bgcolor: color, border: '1px solid', borderColor: 'border.default' }} />
           </Stack>
            <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" useFlexGap>
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b'].map((sw) => (
                <Box
                  key={sw}
                  onClick={() => setColor(sw)}
                  sx={{
                    width: 28, height: 28, borderRadius: `${SHAPE.chip}px`, bgcolor: sw, cursor: 'pointer',
                    border: '2px solid', borderColor: color === sw ? 'text.primary' : 'transparent',
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
          onClick={() => name && validColor && onSave({ name, color, kind, sort })}
          variant="contained"
          disabled={!name || !validColor}
          sx={{
            bgcolor: MAIN_COLOR.products,
            '&:hover': { bgcolor: '#0a4cdb' },
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

function CategoryDeleteConfirm({
  category, productCount, onCancel, onConfirm,
}: {
  category: AdminCategory | null;
  productCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={!!category}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}
    >
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeleteIcon sx={{ color: '#d8453c' }} />
        Delete category?
   </DialogTitle>
      <DialogContent dividers>
        {category && (
          <Stack spacing={2}>
            <Typography>
              Are you sure you want to delete
              <Box component="span" sx={{ fontWeight: 700, mx: 0.5 }}>
                {category.name}
            </Box>
              ? This action cannot be undone.
         </Typography>
            {productCount > 0 && (
              <Alert severity="warning" sx={{ borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {productCount} product{productCount === 1 ? '' : 's'} still use this category.
             </Typography>
                <Typography variant="caption">
                  Move them to another category first, then come back to delete this one.
             </Typography>
           </Alert>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 1, bgcolor: 'surface.muted' }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: category.color, flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{category.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{category.color}</Typography>
             </Box>
         </Box>
       </Stack>
        )}
   </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onCancel} sx={{ borderRadius: `${SHAPE.button}px`, fontWeight: 700 }}>
          Cancel
     </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={productCount > 0}
          sx={{
            bgcolor: '#d8453c',
            '&:hover': { bgcolor: '#b7332b' },
            borderRadius: `${SHAPE.button}px`,
            fontWeight: 700,
          }}
        >
          {productCount > 0 ? 'Cannot delete' : 'Delete'}
     </Button>
   </DialogActions>
 </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PRODUCTS WORKSPACE — 3 cascading columns:
//   col2: filter (all / by category)
//   col3: product list
//   col4: detail
// ─────────────────────────────────────────────────────────────────────
function ProductsWorkspace({ color }: { color: string }) {
  const dispatch = useAppDispatch();
  const menuState = useAppSelector((s) => s.menu);
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [filterCat, setFilterCat] = useState<number | 'all'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  // Category CRUD — col2 also manages categories, not just filters them.
  const [editingCat, setEditingCat] = useState<AdminCategory | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<AdminCategory | null>(null);
  const [catError, setCatError] = useState<string | null>(null);

  const reload = () => {
    Admin.listProducts().then(setItems).catch(() => {});
    Admin.listCategories().then(setCats).catch(() => {});
    import('../lib/api').then(({ Menu }) =>
      Menu.full().then((d) => dispatch(setMenu({
        categories: d.categories as any,
        products: d.products as any,
        tables: menuState.tables,
      }))).catch(() => {})
    );
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (filterCat !== 'all' && p.category_id !== filterCat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filterCat, search]);

  const selected = items.find((p) => p.id === selectedId) ?? null;
  const selCat = selected ? cats.find((c) => c.id === selected.category_id) : null;
  const catColor = (id: number) => cats.find((c) => c.id === id)?.color || '#999';

  const save = async (p: { name: string; description: string; price: number; category_id: number; active: boolean; cost: number }) => {
    if (editing) {
      await Admin.updateProduct(editing.id, p);
    } else {
      const created = await Admin.createProduct(p) as AdminProduct;
      setSelectedId(created.id);
    }
    setEditing(null);
    setCreating(false);
    reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await Admin.deleteProduct(id);
    setSelectedId(null);
    reload();
  };

  const toggleActive = async (p: AdminProduct) => {
    await Admin.updateProduct(p.id, { active: !p.active });
    reload();
  };

  // ── Category CRUD ────────────────────────────────────────────────────
  // A category with products still attached can't be deleted server-side,
  // so the button is disabled (with a tooltip) when count > 0.
  const saveCat = async (p: { name: string; color: string; icon?: string; sort?: number; kind?: 'kitchen' | 'bar' | 'both' }) => {
    if (editingCat) {
      await Admin.updateCategory(editingCat.id, p);
    } else {
      await Admin.createCategory(p);
    }
    setEditingCat(null);
    setCreatingCat(false);
    reload();
  };

  const removeCat = async (id: number) => {
    const cat = cats.find((c) => c.id === id);
    if (!cat) return;
    const count = items.filter((p) => p.category_id === id).length;
    if (count > 0) {
      // Block silently — surface in the confirm dialog itself.
      setConfirmDeleteCat(cat);
      return;
    }
    setConfirmDeleteCat(cat);
  };

  const confirmRemoveCat = async () => {
    if (!confirmDeleteCat) return;
    const id = confirmDeleteCat.id;
    try {
      await Admin.deleteCategory(id);
      if (filterCat === id) setFilterCat('all');
      setConfirmDeleteCat(null);
      reload();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to delete category.';
      setCatError(typeof msg === 'string' ? msg : 'Failed to delete category.');
      setConfirmDeleteCat(null);
    }
  };

  return (
    <>
      {/* COLUMN 2 — category filter (acts like cashier's category chips) */}
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
          color={color}
          count={cats.length}
          action={
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreatingCat(true)}
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
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <ListItemButton
            active={filterCat === 'all'}
            color={color}
            label="All products"
            sublabel={`${items.length} total`}
            onClick={() => { setFilterCat('all'); setSelectedId(null); }}
            accent={filterCat === 'all'}
            leading={<TuneIcon />}
          />
          {cats.map((c) => {
            const count = items.filter((p) => p.category_id === c.id).length;
            const isActive = filterCat === c.id;
            return (
              <CategoryRow
                key={c.id}
                category={c}
                productCount={count}
                active={isActive}
                onSelect={() => { setFilterCat(c.id); setSelectedId(null); }}
                onEdit={() => setEditingCat(c)}
                onDelete={() => removeCat(c.id)}
                iconBtnShape={SHAPE.iconBtn}
              />
            );
          })}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 3 — product list */}
      <Paper
        square
        sx={{
          width: '25%',
          minWidth: 220,
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderBottom: 'none',
          borderRadius: 0,
        }}
      >
        <ColumnHeader
          title={filterCat === 'all' ? 'ALL PRODUCTS' : (cats.find((c) => c.id === filterCat)?.name.toUpperCase() ?? 'PRODUCTS')}
          color={filterCat === 'all' ? color : catColor(filterCat as number)}
          count={filtered.length}
          action={
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
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
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <ColumnEmpty message="No products in this filter" />
          ) : filtered.map((p) => (
            <ListItemButton
              key={p.id}
              active={selectedId === p.id}
              color={catColor(p.category_id)}
              label={p.name}
              sublabel={`$${p.price.toFixed(2)} · ${p.active ? 'active' : 'hidden'}`}
              onClick={() => setSelectedId(p.id)}
              accent={selectedId === p.id}
              leading={<RestaurantMenuIcon />}
            />
          ))}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 4 — detail */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ColumnHeader
          title="DETAIL"
          color={color}
          action={selected && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => setEditing(selected)}
                  sx={{
                    bgcolor: 'rgba(43, 108, 255, 0.12)', color: '#2b6cff',
                    borderRadius: `${SHAPE.iconBtn}px`,
                    '&:hover': { bgcolor: 'rgba(43, 108, 255, 0.22)' },
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => remove(selected.id)}
                  sx={{
                    bgcolor: 'rgba(216, 69, 60, 0.12)', color: '#d8453c',
                    borderRadius: `${SHAPE.iconBtn}px`,
                    '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.22)' },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        />
        {!selected ? (
          <ColumnEmpty message="No product selected" />
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            <DetailRow label="Name" value={selected.name} />
            <DetailRow label="Description" value={selected.description || '—'} />
            <DetailRow label="Price" value={`$${selected.price.toFixed(2)}`} />
            <DetailRow label="Cost" value={`$${Number(selected.cost ?? 0).toFixed(2)}${selected.cost > 0 ? '' : ' (not set)'}`} />
            <DetailRow label="Category" value={selCat?.name ?? `Cat ${selected.category_id}`} swatch={selCat?.color} />
            <DetailRow label="Status" value={selected.active ? 'Active' : 'Hidden'} />
            <DetailRow label="ID" value={`#${selected.id}`} />
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                variant={selected.active ? 'outlined' : 'contained'}
                color={selected.active ? 'warning' : 'success'}
                onClick={() => toggleActive(selected)}
                sx={{ borderRadius: `${SHAPE.button}px`, fontWeight: 700 }}
              >
                {selected.active ? 'Hide from menu' : 'Make active'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <ProductDialog
        open={creating || !!editing}
        initial={editing ?? undefined}
        categories={cats}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={save}
      />

      <CategoryDialog
        open={creatingCat || !!editingCat}
        initial={editingCat ?? undefined}
        onClose={() => { setCreatingCat(false); setEditingCat(null); }}
        onSave={saveCat}
      />

      <CategoryDeleteConfirm
        category={confirmDeleteCat}
        productCount={confirmDeleteCat ? items.filter((p) => p.category_id === confirmDeleteCat.id).length : 0}
        onCancel={() => setConfirmDeleteCat(null)}
        onConfirm={confirmRemoveCat}
      />

      <Snackbar
        open={!!catError}
        autoHideDuration={4500}
        onClose={() => setCatError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setCatError(null)} sx={{ borderRadius: 1 }}>
          {catError}
       </Alert>
     </Snackbar>
    </>
  );
}

function ProductDialog({ open, initial, categories, onClose, onSave }: {
  open: boolean;
  initial?: AdminProduct;
  categories: AdminCategory[];
  onClose: () => void;
  onSave: (p: { name: string; description: string; price: number; category_id: number; active: boolean; cost: number }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [cost, setCost] = useState('0');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setPrice(String(initial?.price ?? 0));
      setCost(String(initial?.cost ?? 0));
      setCategoryId(initial?.category_id ?? (categories[0]?.id ?? ''));
      setActive(initial?.active ?? true);
    }
  }, [open, initial, categories]);

  const submit = () => {
    if (!name || categoryId === '') return;
    onSave({
      name,
      description,
      price: parseFloat(price) || 0,
      cost: Math.max(0, parseFloat(cost) || 0),
      category_id: Number(categoryId),
      active,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{initial ? 'Edit Product' : 'Add Product'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" autoFocus />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth size="small" multiline rows={2} />
          <TextField label="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} fullWidth size="small" InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }} />
          <TextField
            label="Cost (per unit)"
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            fullWidth
            size="small"
            helperText="Used to compute profit in reports. Leave 0 if unknown."
            InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField select label="Category" value={categoryId} onChange={(e) => setCategoryId(parseInt(e.target.value))} fullWidth size="small">
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                <Box sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', bgcolor: c.color, mr: 1 }} />
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Active in menu" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="warning">Cancel</Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={!name || categoryId === ''}
          sx={{
            bgcolor: MAIN_COLOR.products,
            '&:hover': { bgcolor: '#0a4cdb' },
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
// TABLES WORKSPACE — col2 list + col3 detail
// ─────────────────────────────────────────────────────────────────────
function TablesWorkspace({ color }: { color: string }) {
  const dispatch = useAppDispatch();
  const menuState = useAppSelector((s) => s.menu);
  const [items, setItems] = useState<AdminTable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminTable | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const reload = () => {
    Admin.listTables().then((ts) => {
      setItems(ts);
      if (selectedId == null && ts.length) setSelectedId(ts[0].id);
    }).catch(() => {});
    import('../lib/api').then(({ Menu }) =>
      Menu.full().then((d) => dispatch(setMenu({
        categories: menuState.categories,
        products: menuState.products,
        tables: d.tables as any,
      }))).catch(() => {})
    );
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => t.name.toLowerCase().includes(q));
  }, [items, search]);

  const selected = items.find((t) => t.id === selectedId) ?? null;

  const save = async (p: { name: string; seats: number; active: boolean }) => {
    if (editing) {
      await Admin.updateTable(editing.id, p);
    } else {
      const created = await Admin.createTable(p) as AdminTable;
      setSelectedId(created.id);
    }
    setEditing(null);
    setCreating(false);
    reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this table?')) return;
    await Admin.deleteTable(id);
    setSelectedId(null);
    reload();
  };

  return (
    <>
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
              startIcon={<AddIcon />}
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
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
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
              sublabel={`${t.seats} seats${!t.active ? ' · inactive' : ''}`}
              onClick={() => setSelectedId(t.id)}
              accent={selectedId === t.id}
              leading={<TableRestaurantIcon />}
            />
          ))}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ColumnHeader
          title="DETAIL"
          color={color}
          action={selected && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => setEditing(selected)}
                  sx={{
                    bgcolor: 'rgba(43, 108, 255, 0.12)', color: '#2b6cff',
                    borderRadius: `${SHAPE.iconBtn}px`,
                    '&:hover': { bgcolor: 'rgba(43, 108, 255, 0.22)' },
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => remove(selected.id)}
                  sx={{
                    bgcolor: 'rgba(216, 69, 60, 0.12)', color: '#d8453c',
                    borderRadius: `${SHAPE.iconBtn}px`,
                    '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.22)' },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        />
        {!selected ? (
          <ColumnEmpty message="No table selected" />
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            <DetailRow label="Name" value={selected.name} />
            <DetailRow label="Seats" value={String(selected.seats)} />
            <DetailRow label="Status" value={selected.active ? 'Active' : 'Inactive'} />
            <DetailRow label="ID" value={`#${selected.id}`} />
          </Box>
        )}
      </Box>

      <TableDialog
        open={creating || !!editing}
        initial={editing ?? undefined}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={save}
      />
    </>
  );
}

function CategoryRow({
  category, productCount, active, onSelect, onEdit, onDelete, iconBtnShape,
}: {
  category: AdminCategory;
  productCount: number;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  iconBtnShape: number;
}) {
  const [hovered, setHovered] = useState(false);
  const canDelete = productCount === 0;
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
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
        bgcolor: active ? `${category.color}14` : 'transparent',
        borderLeft: '3px solid',
        borderLeftColor: active ? category.color : 'transparent',
        transition: 'background-color 0.1s',
        '&:hover': { bgcolor: active ? `${category.color}1f` : 'surface.muted' },
        '&:focus-visible': { outline: `2px solid ${category.color}`, outlineOffset: -2 },
      }}
    >
      <Box
        sx={{
          width: 32, height: 32,
          borderRadius: `${iconBtnShape}px`,
          bgcolor: active ? category.color : 'surface.muted',
          color: active ? '#fff' : category.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontWeight: 700, fontSize: '0.95rem',
        }}
      >
        {category.name.charAt(0).toUpperCase()}
    </Box>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Typography sx={{ fontWeight: active ? 700 : 600, lineHeight: 1.2, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {category.name}
      </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: active ? category.color : 'text.secondary', fontWeight: 600 }}>
          {productCount} product{productCount === 1 ? '' : 's'}
      </Typography>
    </Box>
      {(hovered || active) && (
        <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit category">
            <IconButton
              size="small"
              onClick={onEdit}
              sx={{
                bgcolor: 'rgba(43, 108, 255, 0.12)', color: '#2b6cff',
                borderRadius: `${iconBtnShape}px`,
                '&:hover': { bgcolor: 'rgba(43, 108, 255, 0.22)' },
              }}
            >
              <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
          <Tooltip title={canDelete ? 'Delete category' : `Move ${productCount} product${productCount === 1 ? '' : 's'} to another category first`}>
            <span>
              <IconButton
                size="small"
                disabled={!canDelete}
                onClick={onDelete}
                sx={{
                  bgcolor: 'rgba(216, 69, 60, 0.12)', color: '#d8453c',
                  borderRadius: `${iconBtnShape}px`,
                  '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.22)' },
                  '&.Mui-disabled': { opacity: 0.35 },
                }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      )}
  </Box>
  );
}

function TableDialog({ open, initial, onClose, onSave }: {
  open: boolean;
  initial?: AdminTable;
  onClose: () => void;
  onSave: (p: { name: string; seats: number; active: boolean }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [seats, setSeats] = useState(4);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSeats(initial?.seats ?? 4);
      setActive(initial?.active ?? true);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{initial ? 'Edit Table' : 'Add Table'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" autoFocus />
          <TextField label="Seats" type="number" value={seats} onChange={(e) => setSeats(parseInt(e.target.value) || 1)} fullWidth size="small" />
          <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Active" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="warning">Cancel</Button>
        <Button
          onClick={() => name && onSave({ name, seats, active })}
          variant="contained"
          disabled={!name}
          sx={{
            bgcolor: MAIN_COLOR.tables,
            '&:hover': { bgcolor: '#086a5d' },
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
// USERS WORKSPACE — 3 cascading columns:
//   col2: role filter (mirrors cashier's category filter)
//   col3: user list (filtered by role)
//   col4: detail
// ─────────────────────────────────────────────────────────────────────
function UsersWorkspace({ color }: { color: string }) {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [filterRole, setFilterRole] = useState<RoleKey>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const reload = () => Admin.listUsers().then(setItems).catch(() => {});
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((u) => {
      if (filterRole !== 'all' && u.role !== filterRole) return false;
      if (q && !u.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filterRole, search]);

  const selected = items.find((u) => u.id === selectedId) ?? null;
  const roleColor = (r: string) =>
    ROLE_LIST.find((x) => x.key === r)?.color || '#5b6472';

  const save = async (p: { name: string; pin: string; role: string; permissions: string[]; active: boolean }) => {
    if (editing) {
      await Admin.updateUser(editing.id, p);
    } else {
      const created = await Admin.createUser(p) as AdminUser;
      setSelectedId(created.id);
    }
    setEditing(null);
    setCreating(false);
    reload();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    try {
      await Admin.deleteUser(id);
      setSelectedId(null);
      reload();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Cannot delete');
    }
  };

  return (
    <>
      {/* COLUMN 2 — role filter (like cashier's category chips) */}
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
        <ColumnHeader title="ROLE FILTER" color={color} count={ROLE_LIST.length} />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {ROLE_LIST.map((r) => {
            const count = r.key === 'all' ? items.length : items.filter((u) => u.role === r.key).length;
            return (
              <ListItemButton
                key={r.key}
                active={filterRole === r.key}
                color={r.color}
                label={r.label}
                sublabel={`${count} user${count === 1 ? '' : 's'}`}
                onClick={() => { setFilterRole(r.key); setSelectedId(null); }}
                accent={filterRole === r.key}
                leading={<PeopleIcon />}
              />
            );
          })}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 3 — user list */}
      <Paper
        square
        sx={{
          width: '25%',
          minWidth: 220,
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none', borderBottom: 'none',
          borderRadius: 0,
        }}
      >
        <ColumnHeader
          title={filterRole === 'all' ? 'ALL USERS' : `${filterRole.toUpperCase()}S`}
          color={filterRole === 'all' ? color : roleColor(filterRole)}
          count={filtered.length}
          action={
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
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
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <ColumnEmpty message="No users in this filter" />
          ) : filtered.map((u) => (
            <ListItemButton
              key={u.id}
              active={selectedId === u.id}
              color={roleColor(u.role)}
              label={u.name}
              sublabel={`${u.role}${u.active ? '' : ' · inactive'}`}
              onClick={() => setSelectedId(u.id)}
              accent={selectedId === u.id}
              leading={<Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.name.charAt(0).toUpperCase()}</Typography>}
            />
          ))}
        </Box>
      </Paper>

      <Divider orientation="vertical" flexItem />

      {/* COLUMN 4 — detail */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ColumnHeader
          title="DETAIL"
          color={color}
          action={selected && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => setEditing(selected)}
                  sx={{
                    bgcolor: 'rgba(43, 108, 255, 0.12)', color: '#2b6cff',
                    borderRadius: `${SHAPE.iconBtn}px`,
                    '&:hover': { bgcolor: 'rgba(43, 108, 255, 0.22)' },
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => remove(selected.id)}
                  sx={{
                    bgcolor: 'rgba(216, 69, 60, 0.12)', color: '#d8453c',
                    borderRadius: `${SHAPE.iconBtn}px`,
                    '&:hover': { bgcolor: 'rgba(216, 69, 60, 0.22)' },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        />
        {!selected ? (
          <ColumnEmpty message="No user selected" />
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            <DetailRow label="Name" value={selected.name} />
            <DetailRow label="Role" value={selected.role} swatch={roleColor(selected.role)} />
            <DetailRow label="Status" value={selected.active ? 'Active' : 'Inactive'} />
            <DetailRow label="Page access" value={(selected.permissions ?? []).map((p) => p.replace('.view', '')).join(', ') || 'None'} />
            <DetailRow label="ID" value={`#${selected.id}`} />
          </Box>
        )}
      </Box>

      <UserDialog
        open={creating || !!editing}
        initial={editing ?? undefined}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={save}
      />
    </>
  );
}

function UserDialog({ open, initial, onClose, onSave }: {
  open: boolean;
  initial?: AdminUser;
  onClose: () => void;
  onSave: (p: { name: string; pin: string; role: string; permissions: string[]; active: boolean }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<string>('waiter');
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setPin('');
      setRole(initial?.role ?? 'waiter');
      setActive(initial?.active ?? true);
      setPermissions(initial?.permissions ?? []);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{initial ? 'Edit User' : 'Add User'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" autoFocus />
          <TextField label={initial ? 'New PIN (leave empty to keep)' : 'PIN (4–8 digits)'} value={pin} onChange={(e) => setPin(e.target.value)} fullWidth size="small" inputProps={{ inputMode: 'numeric' }} />
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)} fullWidth size="small">
            {ROLE_LIST.filter((r) => r.key !== 'all').map((r) => (
              <MenuItem key={r.key} value={r.key}>
                <Box sx={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', bgcolor: r.color, mr: 1 }} />
                {r.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" fontWeight={800}>PAGE ACCESS</Typography>
          {[
            ['dashboard.view', 'Dashboard'], ['cashier.view', 'Cashier'], ['waiter.view', 'Waiter'],
            ['kitchen.view', 'Kitchen'], ['bar.view', 'Bar'], ['menu.view', 'Menu'], ['admin.view', 'Admin'],
          ].map(([permission, label]) => (
            <FormControlLabel
              key={permission}
              control={<Switch checked={permissions.includes(permission)} onChange={(e) => setPermissions((current) => e.target.checked ? [...current, permission] : current.filter((item) => item !== permission))} />}
              label={label}
            />
          ))}
          <Typography variant="caption" fontWeight={800}>ADMIN PRIVILEGES</Typography>
          {[
            ['admin.reports', 'Reports'], ['admin.manage_menu', 'Manage Menu'], ['admin.manage_tables', 'Manage Tables'],
            ['admin.manage_users', 'Manage Users'], ['admin.manage_settings', 'Settings'],
          ].map(([permission, label]) => (
            <FormControlLabel
              key={permission}
              control={<Switch checked={permissions.includes(permission)} onChange={(e) => setPermissions((current) => e.target.checked ? [...current, permission] : current.filter((item) => item !== permission))} />}
              label={label}
            />
          ))}
          <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Active" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="warning">Cancel</Button>
        <Button
          onClick={() => name && (!initial || pin) && onSave({ name, pin: pin || (initial?.name ?? ''), role, permissions, active })}
          variant="contained"
          disabled={!name || (!initial && pin.length < 4)}
          sx={{
            bgcolor: MAIN_COLOR.users,
            '&:hover': { bgcolor: '#4f31b3' },
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
// DetailRow — a label/value pair with optional color swatch
// ─────────────────────────────────────────────────────────────────────
function DetailRow({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'border.soft',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary', textTransform: 'uppercase', minWidth: 110 }}>
        {label}
      </Typography>
      {swatch && (
        <Box
          sx={{
            width: 24, height: 24, borderRadius: `${SHAPE.chip}px`,
            bgcolor: swatch, border: '1px solid',
            borderColor: 'border.default', flexShrink: 0,
          }}
        />
      )}
      <Typography sx={{ fontWeight: 600, color: 'text.primary', flex: 1, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SETTINGS WORKSPACE — Tax rate + Database location + Backup/Restore
//
// One workspace; the body shows three cards stacked. Each card is a
// self-contained operation so admin can move tax / DB around without
// juggling modals. Sharp 4-8px radius throughout, like the rest of
// the admin workspace.
// ─────────────────────────────────────────────────────────────────────
function SettingsWorkspace({ color }: { color: string }) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxDraft, setTaxDraft] = useState<number>(0.10);
  const [taxDirty, setTaxDirty] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [dbDraft, setDbDraft] = useState<string>('');
  const [dbDirty, setDbDirty] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  // M15: station routing — keeps a local copy of categories so we can
  // patch the `kind` (kitchen | bar | both) without touching the rest of
  // the admin's product/category logic.
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [savingKind, setSavingKind] = useState<number | null>(null);

  const reload = () => {
    setLoading(true);
    Settings.get()
      .then((s) => {
        setSettings(s);
        setTaxDraft(s.tax_rate);
        setDbDraft(s.database_url);
        setTaxDirty(false);
        setDbDirty(false);
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
    // M15: station routing — fetch categories on mount so the card can
    // list them with kitchen/bar/both toggles.
    Admin.listCategories().then(setCats).catch(() => {});
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

  const reloadEngine = async () => {
    setWorking('reload');
    setError(null);
    try {
      const next = await Settings.reloadDatabase();
      setSettings(next);
      setDbDraft(next.database_url);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Reload failed');
    } finally {
      setWorking(null);
    }
  };

  const resetDb = async () => {
    if (!confirm('This will DELETE every order, category, product, table, and user, then re-seed. Continue?')) return;
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
    if (!confirm('Forget the saved tax rate and database URL, then point the app back at the bundled default SQLite? The current DB on disk is NOT touched.')) return;
    setWorking('restore');
    setError(null);
    try {
      const next = await Settings.restoreDefaults();
      setSettings(next);
      setTaxDraft(next.tax_rate);
      setDbDraft(next.database_url);
      setTaxDirty(false);
      setDbDirty(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Restore failed');
    } finally {
      setWorking(null);
    }
  };

  const downloadExport = () => {
    const token = localStorage.getItem('brewpos_token');
    if (!token) return;
    // Use fetch to handle the auth header + force a real download via blob.
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
      if (!confirm(`Replace the current database with "${f.name}"? The existing file is backed up to .bak first.`)) return;
      setWorking('import');
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1] ?? '';
        Settings.importDatabase(b64)
          .then((next) => {
            setSettings(next);
            setDbDraft(next.database_url);
          })
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

  if (!settings) {
    return (
      <Box sx={{ flex: 1, p: 3 }}>
        <Alert severity="error">{error ?? 'Could not load settings.'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 3, bgcolor: 'surface.page' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 1.5,
            bgcolor: color, color: 'common.white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <TuneIcon sx={{ fontSize: 20 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Settings
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* ── TAX CARD ─────────────────────────────────────────────── */}
        <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color, mb: 1.5 }}>
            <PercentIcon />
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1 }}>
              TAX
            </Typography>
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: '2.5rem', lineHeight: 1, color: 'text.primary', mb: 0.5 }}>
            {(taxDraft * 100).toFixed(2)}%
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Applied to every new order at checkout. Existing orders keep the rate they were created with.
          </Typography>

          <Slider
            value={Math.round(taxDraft * 1000) / 10}  // 0.1% precision
            min={0}
            max={25}
            step={0.5}
            onChange={(_, v) => { setTaxDraft((v as number) / 100); setTaxDirty(true); }}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
            sx={{ color, mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 56 }}>
              Set to:
            </Typography>
            {[0, 5, 8, 10, 12.5, 15].map((pct) => (
              <Chip
                key={pct}
                size="small"
                label={`${pct}%`}
                clickable
                onClick={() => { setTaxDraft(pct / 100); setTaxDirty(true); }}
                color={Math.abs(taxDraft * 100 - pct) < 0.01 ? 'primary' : 'default'}
                variant={Math.abs(taxDraft * 100 - pct) < 0.01 ? 'filled' : 'outlined'}
                sx={{ borderRadius: `${SHAPE.chip}px`, fontWeight: 700 }}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {taxDirty && (
              <Button size="small" color="warning" onClick={() => { setTaxDraft(settings.tax_rate); setTaxDirty(false); }} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40, fontWeight: 700 }}>
                Discard
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              disabled={!taxDirty || savingTax}
              onClick={saveTax}
              startIcon={<CheckCircleIcon />}
              sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40, fontWeight: 700, bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}
            >
              {savingTax ? 'Saving…' : 'Save tax'}
            </Button>
          </Box>
        </Paper>

        {/* ── DATABASE CARD ────────────────────────────────────────── */}
        <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color, mb: 1.5 }}>
            <StorageIcon />
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1 }}>
              DATABASE
            </Typography>
          </Box>

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
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {settings.product_count} products · {settings.user_count} users
            </Typography>
          </Box>

          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mt: 1.5, mb: 0.5, letterSpacing: 0.5 }}>
            CURRENT URL
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={dbDraft}
            onChange={(e) => { setDbDraft(e.target.value); setDbDirty(true); }}
            placeholder="sqlite:///path/to/file.db  ·  postgresql://user:pass@host/db"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${SHAPE.button}px`, fontFamily: 'monospace' } }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Default: <code>{settings.default_database_url}</code>
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {dbDirty && (
              <Button
                size="small"
                color="warning"
                onClick={() => { setDbDraft(settings.database_url); setDbDirty(false); }}
                sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40, fontWeight: 700 }}
              >
                Discard
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              disabled={!dbDirty || working === 'save-url'}
              onClick={saveDatabaseUrl}
              startIcon={<CheckCircleIcon />}
              sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40, fontWeight: 700, bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}
            >
              {working === 'save-url' ? 'Saving…' : 'Save URL'}
            </Button>
          </Box>
        </Paper>

        {/* ── STATION ROUTING CARD (M15) ────────────────────────── */}
        <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color, gridColumn: { xs: '1', md: '1 / -1' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color, mb: 1.5 }}>
            <LocalBarIcon />
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1 }}>
              STATION ROUTING
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Each category sends its items to a station. <strong>Kitchen</strong> sees the salmon-amber board;
            <strong> Bar</strong> sees the cyan drinks board. <strong>Both</strong> shows the item on both
            (use this for combo items half-managed by each station).
          </Typography>
          {cats.length === 0 ? (
            <Typography variant="caption" color="text.secondary">No categories loaded yet.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1 }}>
              {cats.map((c) => {
                const kind = c.kind ?? 'kitchen';
                const kColor = kind === 'bar' ? '#0e9ec7' : kind === 'both' ? '#6b46d3' : '#e07b1a';
                return (
                  <Box
                    key={c.id}
                    sx={{
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'border.default',
                      borderRadius: `${SHAPE.button}px`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color, flexShrink: 0, border: '1px solid', borderColor: 'border.default' }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</Typography>
                      <Chip
                        size="small"
                        label={kind}
                        icon={kind === 'bar' ? <LocalBarIcon sx={{ fontSize: 14 }} /> : kind === 'both' ? <RestaurantIcon sx={{ fontSize: 14 }} /> : <SoupKitchenIcon sx={{ fontSize: 14 }} />}
                        sx={{ bgcolor: kColor, color: 'common.white', fontWeight: 700, '& .MuiChip-icon': { color: 'common.white' } }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {([
                        ['kitchen', 'Kitchen', '#e07b1a'],
                        ['bar', 'Bar', '#0e9ec7'],
                        ['both', 'Both', '#6b46d3'],
                      ] as const).map(([k, label, c2]) => {
                        const active = kind === k;
                        return (
                          <Button
                            key={k}
                            size="small"
                            variant={active ? 'contained' : 'outlined'}
                            disabled={savingKind === c.id}
                            onClick={async () => {
                              if (active) return;
                              setSavingKind(c.id);
                              try {
                                const updated = await Admin.updateCategory(c.id, { kind: k });
                                setCats((cur) => cur.map((x) => (x.id === c.id ? { ...x, kind: updated.kind } : x)));
                                // Refresh the global menu so kitchen/bar displays see the new routing.
                                import('../lib/api').then(({ Menu }) =>
                                  Menu.full().then((d) => {
                                    // dispatch is in scope via closure when this card is rendered
                                    // — AdminPage already imported setMenu; for safety we just
                                    // trigger a small window.dispatch to no-op and rely on the
                                    // kitchen/bar pages' own WS reload.
                                    return d;
                                  }).catch(() => {})
                                );
                              } catch (e: any) {
                                setError(e?.response?.data?.detail ?? 'Failed to update station');
                              } finally {
                                setSavingKind(null);
                              }
                            }}
                            startIcon={k === 'bar' ? <LocalBarIcon sx={{ fontSize: 14 }} /> : k === 'both' ? <RestaurantIcon sx={{ fontSize: 14 }} /> : <SoupKitchenIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              flex: 1,
                              borderRadius: `${SHAPE.button}px`,
                              minHeight: 36,
                              fontWeight: 700,
                              color: active ? 'common.white' : c2,
                              borderColor: c2,
                              bgcolor: active ? c2 : 'transparent',
                              '&:hover': { bgcolor: active ? c2 : `${c2}1a`, borderColor: c2 },
                            }}
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>

        {/* ── OPERATIONS CARD ──────────────────────────────────────── */}
        <Paper sx={{ p: 2.5, borderRadius: `${SHAPE.card}px`, borderTop: '4px solid', borderTopColor: color, gridColumn: { xs: '1', md: '1 / -1' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color, mb: 1.5 }}>
            <RefreshIcon />
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1 }}>
              DATABASE OPERATIONS
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The database file is portable — copy <code>{settings.database_url}</code> to another machine, drop a
            SQLite file from any Brew-POS install into <em>backend/</em>, or switch between local &amp; networked
            databases on the fly. Each operation below takes effect immediately.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
            <OpTile
              color="#2b6cff"
              icon={<RefreshIcon />}
              label="Reload engine"
              hint="Re-bind to the saved URL — useful after editing the path by hand."
              busy={working === 'reload'}
              onClick={reloadEngine}
            />
            <OpTile
              color="#d99317"
              icon={<WarningIcon />}
              label="Reset & re-seed"
              hint="Drops every row and runs the seed again. Orders are lost."
              busy={working === 'reset'}
              onClick={resetDb}
              confirm
            />
            <OpTile
              color="#5b6472"
              icon={<RestoreIcon />}
              label="Restore defaults"
              hint="Forget the saved URL + tax; fall back to the env defaults."
              busy={working === 'restore'}
              onClick={restoreDefaults}
              confirm
            />
            <OpTile
              color="#0c8a7a"
              icon={<DownloadIcon />}
              label="Export .db"
              hint="Download the SQLite file as a portable backup."
              onClick={downloadExport}
              disabled={settings.db_kind !== 'sqlite'}
            />
            <OpTile
              color="#6b46d3"
              icon={<UploadIcon />}
              label="Import .db"
              hint="Replace the current file with another Brew-POS backup."
              onClick={triggerImport}
              busy={working === 'import'}
              confirm
              disabled={settings.db_kind !== 'sqlite'}
            />
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Tip: for a multi-terminal install, point every backend at the same network path
            (e.g. <code>postgresql://user:pass@nas.local/brewpos</code>) and reload after each change.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

// Square operation tile — used in the Database Operations card.
function OpTile({
  color, icon, label, hint, onClick, busy, confirm, disabled,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  busy?: boolean;
  confirm?: boolean;
  disabled?: boolean;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => { if (!busy && !disabled) onClick(); }}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy && !disabled) onClick(); }}
      sx={{
        borderRadius: `${SHAPE.tileSquare}px`,
        border: '2px solid',
        borderColor: disabled ? 'border.default' : color,
        bgcolor: disabled ? 'surface.muted' : `${color}0d`,
        p: 1.5,
        minHeight: 96,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        transition: 'transform 0.1s, border-color 0.1s, background-color 0.1s',
        '&:hover': !disabled ? {
          borderColor: color,
          bgcolor: `${color}1f`,
          transform: 'translateY(-1px)',
        } : undefined,
        '&:active': !disabled ? { transform: 'scale(0.98)' } : undefined,
        '&:focus-visible': !disabled ? { outline: `2px solid ${color}`, outlineOffset: 2 } : undefined,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: `${SHAPE.button}px`,
            bgcolor: color, color: 'common.white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.1, color: disabled ? 'text.disabled' : 'text.primary' }}>
            {label}
          </Typography>
          {confirm && (
            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
              requires confirmation
            </Typography>
          )}
        </Box>
        {busy && <CircularProgress size={16} sx={{ color }} />}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
        {hint}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TAX & DISCOUNTS WORKSPACE — M25 moved here from SettingsPage
// Tax rate + discount presets + require-reason switch, identical to the
// SettingsPage copy but now reachable from the Admin page main menu.
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
