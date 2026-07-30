import { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Alert, Snackbar,
} from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import BackspaceIcon from '@mui/icons-material/Backspace';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import { useAppSelector } from '../store/hooks';
import { Orders } from '../lib/api';
import { ws } from '../lib/ws';
import type { Order, Table } from '../types';

const SHAPE = {
  card: 6,
  button: 4,
  chip: 4,
  dialog: 8,
  tile: 6,
};

type PaymentMethod = 'cash' | 'card' | 'mobile';

const METHOD_TOKENS: Record<PaymentMethod, { color: string; label: string; icon: React.ReactNode }> = {
  cash: { color: '#1f9d55', label: 'Cash', icon: <LocalAtmIcon /> },
  card: { color: '#2b6cff', label: 'Card', icon: <CreditCardIcon /> },
  mobile: { color: '#0c8a7a', label: 'Mobile', icon: <PhoneIphoneIcon /> },
};

const isLiveBill = (b: Order) => !['paid', 'void', 'cancelled'].includes(b.status);

export default function CashierPage() {
  const { tables } = useAppSelector((s) => s.menu);
  const [bills, setBills] = useState<Order[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  // `paying` → payment dialog open with this bill
  const [paying, setPaying] = useState<Order | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = () => {
    Orders.list().then(setBills).catch(() => {});
  };

  useEffect(() => {
    reload();
    const off = ws.on((event) => {
      if (
        event === 'order_created' ||
        event === 'order_updated' ||
        event === 'order_cancelled' ||
        event === 'order_item_cancelled'
      ) reload();
    });
    return () => { off(); };
  }, []);

  // All unpaid/active bills across every table.
  const liveBills = useMemo(
    () => bills.filter(isLiveBill),
    [bills],
  );

  // Index live bills by table id so the floor plan can flag each tile.
  const liveBillByTable = useMemo(() => {
    const m = new Map<number, Order>();
    for (const b of liveBills) {
      if (b.table_id == null) continue;
      if (m.has(b.table_id)) {
        const existing = m.get(b.table_id)!;
        // Prefer the most progressed bill on the table.
        const liveOrder = ['open', 'accepted', 'preparing', 'ready', 'served', 'paid'];
        if (liveOrder.indexOf(b.status) > liveOrder.indexOf(existing.status)) {
          m.set(b.table_id, b);
        }
      } else {
        m.set(b.table_id, b);
      }
    }
    return m;
  }, [liveBills]);

  const tablesSorted = useMemo(
    () => [...tables].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [tables],
  );

  // The permanent bill view always shows the most-progressed live bill
  // for the selected table. When no table is selected, the panel is empty.
  const selectedBill = useMemo(() => {
    if (selectedTableId == null) return null;
    const candidates = liveBills.filter((b) => b.table_id === selectedTableId);
    if (!candidates.length) return null;
    const liveOrder = ['open', 'accepted', 'preparing', 'ready', 'served', 'paid'];
    return candidates.reduce((best, cur) => (liveOrder.indexOf(cur.status) > liveOrder.indexOf(best.status) ? cur : best));
  }, [liveBills, selectedTableId]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'surface.page' }}>
      {/* HEADER */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'border.default',
          bgcolor: 'surface.paper',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 1.5,
            bgcolor: 'role.cashier', color: 'common.white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <PointOfSaleIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Cashier
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {liveBills.length} open bill{liveBills.length === 1 ? '' : 's'} · $
            {liveBills.reduce((s, b) => s + b.total, 0).toFixed(2)} due
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {selectedTableId != null && (
          <Chip
            label={`Filtered: ${tables.find((t: Table) => t.id === selectedTableId)?.name ?? `Table ${selectedTableId}`}`}
            onDelete={() => setSelectedTableId(null)}
            color="primary"
            variant="filled"
            sx={{ fontWeight: 700, borderRadius: `${SHAPE.chip}px` }}
          />
        )}
      </Box>

      {/* 2-COLUMN BODY: floor plan (left, 70%) + bill list (right, 30%) */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* LEFT — Table grid (70% of viewport) */}
        <Box
          sx={{
            width: { xs: '100%', md: '70%' },
            flexShrink: 0,
            borderRight: { md: '1px solid' },
            borderColor: 'border.default',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'surface.paper',
          }}
        >
          <Box
            sx={{
              px: 2, py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'border.default',
              display: 'flex', alignItems: 'center', gap: 1,
            }}
          >
            <HomeWorkIcon sx={{ fontSize: 18, color: 'role.cashier' }} />
            <Typography sx={{ fontWeight: 800, letterSpacing: 0.5, fontSize: '0.85rem', color: 'text.primary' }}>
              FLOOR PLAN
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              label={`${tablesSorted.length} tables`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </Box>
          <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 1.25,
              }}
            >
              {tablesSorted.map((t) => {
                const live = liveBillByTable.get(t.id);
                const isOpenBill = !!live;
                const isSelected = selectedTableId === t.id;
                const billCount = liveBills.filter((b) => b.table_id === t.id).length;
                return (
                  <Paper
                    key={t.id}
                    onClick={() => setSelectedTableId((cur) => (cur === t.id ? null : t.id))}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderRadius: `${SHAPE.tile}px`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 0.5,
                      minHeight: 96,
                      bgcolor: isOpenBill ? 'role.cashier' : 'surface.paper',
                      color: isOpenBill ? 'common.white' : 'text.primary',
                      border: '2px solid',
                      borderColor: isSelected
                        ? (isOpenBill ? 'common.white' : 'role.cashier')
                        : 'border.default',
                      transition: 'transform 0.12s, border-color 0.12s',
                      '&:hover': { transform: 'translateY(-2px)' },
                      '&:active': { transform: 'scale(0.97)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' }}>
                      <Box
                        sx={{
                          width: 32, height: 32, borderRadius: `${SHAPE.button}px`,
                          bgcolor: isOpenBill ? '#ffffff22' : 'role.cashier',
                          color: 'common.white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <TableRestaurantIcon sx={{ fontSize: 18 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.05 }}>
                          {t.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 600, opacity: isOpenBill ? 0.92 : 0.7 }}
                        >
                          {isOpenBill
                            ? `${live!.status.toUpperCase()} · $${live!.total.toFixed(2)}`
                            : `${t.seats} seats · Kosong`}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      size="small"
                      label={isOpenBill ? `OpenBill · #${live!.number}` : 'Kosong'}
                      sx={{
                        bgcolor: isOpenBill ? '#ffffff22' : 'rgba(0,0,0,0.05)',
                        color: isOpenBill ? 'common.white' : 'text.primary',
                        border: 'none',
                        fontWeight: 700,
                      }}
                    />
                    {isOpenBill && billCount > 1 && (
                      <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
                        +{billCount - 1} older bill{billCount - 1 === 1 ? '' : 's'}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* RIGHT — Permanent bill view (30% width, always visible)
             Click a table → its bill appears here. The Pay button stays
             pinned below the scrollable item list so the cashier can
             close the bill in one tap. */}
        <Box
          sx={{
            width: '30%',
            minWidth: 320,
            flexShrink: 0,
            borderLeft: { md: '1px solid' },
            borderColor: 'border.default',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'surface.paper',
          }}
        >
          <Box
            sx={{
              px: 2, py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'border.default',
              display: 'flex', alignItems: 'center', gap: 1,
            }}
          >
            <Typography sx={{ fontWeight: 800, letterSpacing: 0.5, fontSize: '0.85rem', color: 'text.primary' }}>
              {selectedTableId == null ? 'NO TABLE SELECTED' : 'CURRENT BILL'}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {selectedTableId != null && (
              <Chip
                size="small"
                variant="outlined"
                label={tables.find((t: Table) => t.id === selectedTableId)?.name ?? `Table ${selectedTableId}`}
                sx={{ fontWeight: 700 }}
              />
            )}
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {!selectedBill ? (
              <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
                <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {selectedTableId == null
                      ? 'Pick a table on the left to see its bill.'
                      : 'This table has no open bill right now.'}
                  </Typography>
                  <Typography variant="caption">
                    Tap an OpenBill tile to open its bill here.
                  </Typography>
                </Box>
              </Box>
            ) : (
              <BillPanel bill={selectedBill} tableName={tables.find((t: Table) => t.id === selectedBill.table_id)?.name} />
            )}
          </Box>
          {/* Pay button — sticky below the bill panel so the cashier can
              close the current bill in one tap. Same blue as the cashier
              accent, full width of the 30% column. */}
          {selectedBill && (
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'border.default', bgcolor: 'surface.paper' }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<CheckCircleIcon />}
                onClick={() => setPaying(selectedBill)}
                disabled={selectedBill.status === 'paid' || selectedBill.status === 'cancelled'}
                sx={{
                  bgcolor: 'role.cashier',
                  borderRadius: `${SHAPE.button}px`,
                  minHeight: 56,
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'role.cashier', filter: 'brightness(0.92)' },
                }}
              >
                {selectedBill.status === 'paid'
                  ? 'Paid'
                  : `Pay Bill $${selectedBill.total.toFixed(2)}`}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.75, fontWeight: 600 }}>
                Method, tendered & change appear in the popup.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ─── Payment dialog (popup with big Confirm/Cancel buttons) ─── */}
      <PaymentDialog
        bill={paying}
        open={!!paying}
        submitting={submitting}
        onCancel={() => { if (!submitting) setPaying(null); }}
        onConfirm={async (method, tendered) => {
          if (!paying) return;
          setSubmitting(true);
          try {
            await Orders.close(paying.id, { payment_method: method, tendered });
            setPaying(null);
            reload();
          } catch (e: any) {
            const detail =
              (Array.isArray(e?.response?.data?.detail)
                ? e.response.data.detail.map((d: any) => d?.msg).join('; ')
                : e?.response?.data?.detail) ??
              e?.message ??
              'Failed to close the bill';
            setSnack(typeof detail === 'string' ? detail : JSON.stringify(detail));
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setSnack(null)}
          sx={{ borderRadius: `${SHAPE.button}px` }}
        >
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Permanent bill panel — the right column of the cashier. Shows the
// selected table's bill with a sticky Pay button below.
function BillPanel({ bill, tableName }: { bill: Order; tableName?: string }) {
  const accent =
    bill.status === 'served' || bill.status === 'ready' ? '#2b6cff' : 'role.cashier';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 44, height: 44, borderRadius: `${SHAPE.button}px`,
            bgcolor: accent, color: 'common.white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>#{bill.number}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            Bill #{bill.number}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {tableName ? `${tableName} · ` : ''}{bill.status.toUpperCase()}
          </Typography>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {bill.items.map((it) => (
          <Box
            key={it.id}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 1,
              py: 0.5,
              opacity: it.status === 'served' ? 0.65 : 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: it.status === 'cancelled' ? 400 : 600,
                  textDecoration: it.status === 'cancelled' ? 'line-through' : 'none',
                  color: it.status === 'cancelled' ? 'text.disabled' : 'text.primary',
                  lineHeight: 1.2,
                }}
              >
                {it.qty}× {it.name}
              </Typography>
              {it.modifiers.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  + {it.modifiers.map((m) => m.name).join(', ')}
                </Typography>
              )}
              {it.status === 'cancelled' && (
                <Typography variant="caption" sx={{ color: 'error.main', display: 'block', fontWeight: 700 }}>
                  CANCELLED — not billable
                </Typography>
              )}
            </Box>
            <Typography
              sx={{
                fontWeight: it.status === 'cancelled' ? 400 : 700,
                fontFamily: 'monospace',
                color: it.status === 'cancelled' ? 'text.disabled' : 'text.primary',
              }}
            >
              ${(it.price * it.qty).toFixed(2)}
            </Typography>
          </Box>
        ))}
      </Box>
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 700 }}>Total</Typography>
        <Typography sx={{ fontWeight: 800, color: accent, fontSize: '1.4rem', fontFamily: 'monospace' }}>
          ${bill.total.toFixed(2)}
        </Typography>
      </Box>
    </Box>
  );
}

function PaymentDialog({
  bill, open, submitting, onCancel, onConfirm,
}: {
  bill: Order | null;
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (method: PaymentMethod, tendered: number) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTendered('0');
      setMethod('cash');
      setError(null);
    }
  }, [open, bill?.id]);

  if (!bill) {
    return (
      <Dialog open={open} onClose={onCancel} PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}>
        <DialogContent />
      </Dialog>
    );
  }

  const tenderedNum = parseFloat(tendered) || 0;
  const isCash = method === 'cash';
  const change = isCash ? tenderedNum - bill.total : 0;
  const canPay = !isCash || tenderedNum >= bill.total - 0.005;

  const tap = (key: string) => {
    setTendered((cur) => {
      if (key === '.') {
        if (cur.includes('.')) return cur;
        return cur === '0' ? '0.' : cur + '.';
      }
      if (cur === '0') return key;
      if (cur.includes('.')) {
        const [, dec] = cur.split('.');
        if (dec && dec.length >= 2) return cur;
      } else if (cur.length >= 7) {
        return cur;
      }
      return cur + key;
    });
  };
  const back = () => setTendered((cur) => (cur.length > 1 ? cur.slice(0, -1) : '0'));
  const clearAll = () => setTendered('0');
  const exact = () => setTendered(bill.total.toFixed(2));
  const addQuick = (n: number) => setTendered((cur) => {
    const next = (parseFloat(cur === '0' ? '0' : cur) || 0) + n;
    return next.toFixed(2);
  });

  const handleConfirm = () => {
    if (!canPay) {
      setError('Tendered is less than total.');
      return;
    }
    setError(null);
    onConfirm(method, isCash ? tenderedNum : bill.total);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${SHAPE.dialog}px`,
          borderTop: '6px solid',
          borderTopColor: 'role.cashier',
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>
        Pay Bill #{bill.number}
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
          ${bill.total.toFixed(2)} due · {bill.items.length} item{bill.items.length === 1 ? '' : 's'}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.5 }}>
              Method
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                mb: 2,
              }}
            >
              {(Object.keys(METHOD_TOKENS) as PaymentMethod[]).map((key) => {
                const m = METHOD_TOKENS[key];
                const selected = method === key;
                return (
                  <Box
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setMethod(key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMethod(key); }}
                    sx={{
                      borderRadius: `${SHAPE.button}px`,
                      border: '2px solid',
                      borderColor: selected ? m.color : 'border.default',
                      bgcolor: selected ? `${m.color}1f` : 'surface.paper',
                      p: 1.25,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      minHeight: 80,
                      transition: 'all 0.12s',
                      '&:hover': { borderColor: m.color },
                      '&:active': { transform: 'scale(0.97)' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 32, height: 32, borderRadius: `${SHAPE.button}px`,
                        bgcolor: m.color, color: 'common.white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        '& .MuiSvgIcon-root': { fontSize: 18 },
                      }}
                    >
                      {m.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {m.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {isCash && (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
                  <DisplayCard
                    label="Tendered"
                    value={`$${tenderedNum.toFixed(2)}`}
                    color="text.primary"
                    bg="surface.muted"
                    border="border.default"
                  />
                  <DisplayCard
                    label={change >= 0 ? 'Change' : 'Short'}
                    value={`$${Math.abs(change).toFixed(2)}`}
                    color={change >= 0 ? '#1f9d55' : '#d8453c'}
                    bg={change >= 0 ? '#e8f6ee' : '#fbe9e8'}
                    border={change >= 0 ? '#1f9d55' : '#d8453c'}
                    highlight={tenderedNum > 0}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Button size="small" variant="outlined" onClick={exact} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40, fontWeight: 600 }}>
                    Exact ${bill.total.toFixed(2)}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => addQuick(5)} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>+$5</Button>
                  <Button size="small" variant="outlined" onClick={() => addQuick(10)} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>+$10</Button>
                  <Button size="small" variant="outlined" onClick={() => addQuick(20)} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>+$20</Button>
                  <Button size="small" variant="outlined" color="warning" onClick={clearAll} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>Clear</Button>
                </Box>
                {error && (
                  <Alert severity="error" sx={{ borderRadius: `${SHAPE.button}px` }}>
                    {error}
                  </Alert>
                )}
              </>
            )}

            {!isCash && (
              <Paper
                sx={{
                  p: 2,
                  borderRadius: `${SHAPE.card}px`,
                  border: '1px solid',
                  borderColor: METHOD_TOKENS[method].color,
                  bgcolor: `${METHOD_TOKENS[method].color}14`,
                  textAlign: 'center',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: METHOD_TOKENS[method].color }}>
                  Charge ${bill.total.toFixed(2)} via {METHOD_TOKENS[method].label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Tap Confirm to charge the customer's {METHOD_TOKENS[method].label.toLowerCase()}.
                </Typography>
              </Paper>
            )}
          </Box>

          {isCash && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, alignContent: 'start' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((k) => {
                if (k === 'back') {
                  return (
                    <Button
                      key={k}
                      variant="outlined"
                      color="warning"
                      onClick={back}
                      sx={{
                        minHeight: 56, borderRadius: `${SHAPE.button}px`, fontWeight: 700,
                      }}
                    >
                      <BackspaceIcon />
                    </Button>
                  );
                }
                return (
                  <Button
                    key={k}
                    variant="outlined"
                    onClick={() => tap(k)}
                    sx={{
                      minHeight: 56, borderRadius: `${SHAPE.button}px`, fontWeight: 700, fontSize: 22,
                      bgcolor: 'surface.paper', borderColor: 'border.strong', color: 'text.primary',
                      '&:hover': { bgcolor: 'surface.muted', borderColor: 'role.cashier' },
                      '&:active': { transform: 'scale(0.96)' },
                    }}
                  >
                    {k}
                  </Button>
                );
              })}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1.5 }}>
        <Button
          onClick={onCancel}
          color="warning"
          size="large"
          startIcon={<CancelIcon />}
          disabled={submitting}
          sx={{
            borderRadius: `${SHAPE.button}px`,
            minHeight: 72,
            flex: 1,
            fontWeight: 800,
            fontSize: '1.05rem',
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="success"
          size="large"
          startIcon={<CheckCircleIcon />}
          disabled={!canPay || submitting}
          sx={{
            borderRadius: `${SHAPE.button}px`,
            minHeight: 72,
            flex: 1,
            fontWeight: 800,
            fontSize: '1.05rem',
          }}
        >
          {submitting ? 'Processing…' : `Confirm Pay $${bill.total.toFixed(2)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DisplayCard({
  label, value, color, bg, border, highlight,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
  border: string;
  highlight?: boolean;
}) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: border,
        borderRadius: `${SHAPE.card}px`,
        p: 1.5,
        bgcolor: bg,
        textAlign: 'center',
        minHeight: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        transition: 'transform 0.12s',
        transform: highlight ? 'scale(1.02)' : 'none',
      }}
    >
      <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.4, color, fontWeight: 700, letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 700, fontFamily: 'monospace', fontSize: '1.4rem', lineHeight: 1.2, color, mt: 0.5,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
