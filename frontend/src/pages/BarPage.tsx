import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField,
  Alert, Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import CancelIcon from '@mui/icons-material/Cancel';
import BlockIcon from '@mui/icons-material/Block';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import VerifiedIcon from '@mui/icons-material/Verified';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { Orders } from '../lib/api';
import { ws } from '../lib/ws';
import type { Order, OrderItem } from '../types';

// Bar display palette — matches kitchen display for unified look
const BAR_COLOR = 'role.kitchen';          // primary station accent (theme amber)
const BAR_ACCENT = 'surface.muted';        // soft tint for empty/header bars

// ── Predefined reject reasons — each becomes a big square touch tile ──
// Common bar scenarios; bartender can also type a free-form reason.
interface ReasonTile {
  label: string;
  color: string;        // primary fill when selected
  colorSoft: string;    // tint for unselected hover / soft background
  icon: React.ReactNode;
}

const REJECT_REASONS: ReasonTile[] = [
  { label: 'Sold out',          color: '#d8453c', colorSoft: '#fbe9e8', icon: <InventoryIcon /> },
  { label: 'Out of ingredients',color: '#d99317', colorSoft: '#fcf3df', icon: <RestaurantMenuIcon /> },
  { label: 'Wrong order',       color: '#6b46d3', colorSoft: '#ebe5f9', icon: <ReportProblemIcon /> },
  { label: 'Customer cancelled',color: '#5b6472', colorSoft: '#eef1f5', icon: <PersonOffIcon /> },
  { label: 'Quality issue',     color: '#0c8a7a', colorSoft: '#e3f3f0', icon: <VerifiedIcon /> },
];

// ── Target of a reject action ────────────────────────────────────────
type RejectTarget =
  | { kind: 'order'; order: Order }
  | { kind: 'item'; order: Order; item: OrderItem };

// Unified 8px rounded corners across cards, buttons, chips — matches Shell
// menu bar and other pages.
const RADIUS = '12px';

export default function BarPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [rejecting, setRejecting] = useState<RejectTarget | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Toast that announces when an order disappears from the board.
  const [lastCancelled, setLastCancelled] = useState<{ number: number; reason: string } | null>(null);
  // M20 — reprint ticket state (one in-flight reprint at a time keeps the
  // UI simple; the bar rarely fires more than one reprint at once).
  const [reprintingId, setReprintingId] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const reload = () => {
    // station=bar returns orders that contain at least one bar item. We
    // also drop cancelled/paid orders so the bartender doesn't see a
    // tombstone of the kitchen's finished tickets.
    // Filter: keep orders that have at least one unserved bar item.
    Orders.list(undefined, 'bar').then((all) => {
      setOrders(all.filter((o) => o.items.some((i) => {
        const s = i.station ?? 'kitchen';
        return (s === 'bar' || s === 'both') && i.status !== 'served' && i.status !== 'cancelled';
      })));
    }).catch(() => {});
  };

  useEffect(() => {
    reload();
    const off = ws.on((event) => {
      if (
        event === 'order_created' ||
        event === 'order_updated' ||
        event === 'order_cancelled' ||
        event === 'order_item_cancelled'
      ) {
        reload();
      }
    });
    return () => { off(); };
  }, []);

  const openReject = (target: RejectTarget) => {
    setRejecting(target);
    setReason('Sold out');
    setError(null);
  };

  const closeReject = () => {
    if (submitting) return;
    setRejecting(null);
    setReason('');
    setError(null);
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    const trimmed = reason.trim() || 'sold out';
    setSubmitting(true);
    setError(null);
    try {
      const payload: { reason: string; item_id?: number } = { reason: trimmed };
      if (rejecting.kind === 'item') payload.item_id = rejecting.item.id;
      const cancelledOrder = await Orders.cancel(rejecting.order.id, payload);
      setLastCancelled({
        number: cancelledOrder.number,
        reason: trimmed,
      });
      setRejecting(null);
      setReason('');
      reload();
      // Auto-dismiss the toast after 5s.
      setTimeout(() => setLastCancelled(null), 5000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to cancel');
    } finally {
      setSubmitting(false);
    }
  };

  const bumpItem = async (orderId: number, itemId: number, itemStatus: string) => {
    await Orders.update(orderId, { item_id: itemId, item_status: itemStatus });
    reload();
  };

  const completeOrder = async (orderId: number, station: 'kitchen' | 'bar') => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const stationItems = order.items.filter((i) => (i.station ?? 'kitchen') === station || (i.station ?? 'kitchen') === 'both');
    for (const item of stationItems) {
      if (item.status !== 'served' && item.status !== 'cancelled') {
        await Orders.update(orderId, { item_id: item.id, item_status: 'served' });
      }
    }
    reload();
  };

  const reprint = async (orderId: number) => {
    setReprintingId(orderId);
    try {
      const res = await Orders.printTicket(orderId);
      setSnack({
        msg: res.ok
          ? `Ticket reprinted · ${res.bytes_written} bytes`
          : `Reprint failed · ${res.error ?? 'unknown error'}`,
        severity: res.ok ? 'success' : 'error',
      });
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Reprint request failed';
      setSnack({ msg: typeof detail === 'string' ? detail : JSON.stringify(detail), severity: 'error' });
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <Box sx={{ flex: 1, p: 3, overflow: 'auto', bgcolor: 'surface.page', position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: RADIUS,
            bgcolor: BAR_COLOR, color: 'common.white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <LocalBarIcon sx={{ fontSize: 20 }} />
       </Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Bar Display
       </Typography>
        <Chip
          size="small"
          variant="outlined"
          label="Drinks only"
          sx={{ ml: 1, borderColor: BAR_COLOR, color: BAR_COLOR, fontWeight: 700 }}
        />
        <Box sx={{ flex: 1 }} />
        <Chip
          size="small"
          variant="outlined"
          label={`${orders.length} active`}
        />
     </Box>

      {/* Cancellation toast — appears in the corner when an order vanishes */}
      {lastCancelled && (
        <Alert
          severity="warning"
          onClose={() => setLastCancelled(null)}
          icon={<BlockIcon />}
          sx={{
            position: 'fixed', top: 80, right: 24, zIndex: 20,
            borderRadius: RADIUS, fontWeight: 600, minWidth: 320,
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}
        >
          Order #{lastCancelled.number} cancelled — {lastCancelled.reason}
       </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 2,
        }}
      >
        {orders.length === 0 && (
          <Paper sx={{ p: 4, gridColumn: '1 / -1', textAlign: 'center', borderRadius: RADIUS }}>
            <Typography color="text.secondary">No active drink orders. Take a breath 🍹</Typography>
         </Paper>
        )}
        {orders.map((o) => {
          // The bar sees only items on its station. "both" items appear
          // here too so coffee+dessert combos light up both displays.
          // Bar-only lines are filtered out so the bartender only makes
          // drinks (kitchen handles the food). The order card itself is
          // kept visible so the bill as a whole stays grouped.
          const barItems = o.items.filter(
            (i: any) => {
              const s = i.station ?? 'kitchen';
              return s === 'bar' || s === 'both';
            },
          );
          const kitchenHidden = o.items.length - barItems.filter((i: any) => (i.station ?? 'kitchen') !== 'bar').length;
          const statusColor =
            o.status === 'ready' ? 'success.main' :
            o.status === 'preparing' ? 'warning.main' :
            'primary.main';
          return (
            <Paper
              key={o.id}
              sx={{
                p: 2,
                borderRadius: RADIUS,
                display: 'flex',
                flexDirection: 'column',
                borderTop: '4px solid',
                borderTopColor: statusColor,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  #{o.number}
               </Typography>
                <Chip
                  label={o.status}
                  size="small"
                  color={
                    o.status === 'ready' ? 'success' :
                    o.status === 'preparing' ? 'warning' :
                    'default'
                  }
                  variant={o.status === 'ready' || o.status === 'preparing' ? 'filled' : 'outlined'}
                />
             </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(o.created_at).toLocaleTimeString()} · {o.type}
                {o.table_id ? ` · table ${o.table_id}` : ''}
                {kitchenHidden > 0 ? ` · ${kitchenHidden} kitchen item(s) hidden` : ''}
             </Typography>

              {/* Reject whole order — sits just under the header so it's always one tap away.
                  Sized like Admin buttons (minHeight 44, 4px radius). */}
              <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                <Tooltip title="Reject this entire order (sold out, wrong order, etc.)">
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<BlockIcon />}
                    onClick={() => openReject({ kind: 'order', order: o })}
                    sx={{ borderRadius: RADIUS, minHeight: 44, minWidth: 180, fontWeight: 700 }}
                  >
                    Reject Order
                 </Button>
               </Tooltip>
             </Box>

              <Stack spacing={1} sx={{ mt: 1.5, flex: 1 }}>
                {barItems.length === 0 && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderRadius: RADIUS,
                      borderColor: 'border.default',
                      textAlign: 'center',
                      bgcolor: BAR_ACCENT,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      No drinks on this order — kitchen is handling the rest.
                   </Typography>
                 </Paper>
                )}
                {barItems.map((i) => (
                  <Paper
                    key={i.id}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderRadius: RADIUS,
                      borderColor:
                        i.status === 'ready' ? 'success.main' :
                        i.status === 'cancelled' ? 'error.main' :
                        BAR_COLOR,
                      opacity: i.status === 'served' ? 0.5 : 1,
                      // Show a subtle strikethrough on cancelled items so the
                      // line reads as "no longer billable" at a glance.
                      textDecoration: i.status === 'cancelled' ? 'line-through' : 'none',
                      // Subtle bar accent — 3px left stripe in the bar color so
                      // the bartender can scan a wall of tickets and instantly
                      // see which station they belong to.
                      borderLeft: '3px solid',
                      borderLeftColor: BAR_COLOR,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {i.qty}× {i.name}
                     </Typography>
                      <Chip
                        label={i.status}
                        size="small"
                        variant={i.status === 'cancelled' ? 'filled' : 'outlined'}
                        color={
                          i.status === 'cancelled' ? 'error' :
                          i.status === 'ready' ? 'success' :
                          i.status === 'preparing' ? 'warning' :
                          'default'
                        }
                      />
                   </Box>
                    {i.modifiers.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        + {i.modifiers.map((m) => m.name).join(', ')}
                     </Typography>
                    )}
                    {i.notes && (
                      <Typography variant="caption" sx={{ color: 'warning.main', display: 'block' }}>
                        "{i.notes}"
                     </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                      {i.status === 'new' && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => bumpItem(o.id, i.id, 'preparing')}
                            sx={{ borderRadius: RADIUS, minHeight: 40, fontWeight: 700 }}
                          >
                            Start
                         </Button>
                          <Tooltip title="Reject this item — sold out, wrong order, etc.">
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => openReject({ kind: 'item', order: o, item: i })}
                              sx={{ borderRadius: RADIUS, minHeight: 44, minWidth: 110, fontWeight: 700 }}
                            >
                              Reject
                           </Button>
                         </Tooltip>
                        </>
                      )}
                      {i.status === 'preparing' && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => bumpItem(o.id, i.id, 'ready')}
                            sx={{ borderRadius: RADIUS, minHeight: 40, fontWeight: 700 }}
                          >
                            Ready
                         </Button>
                          <Tooltip title="Reject this item — sold out mid-prep, quality issue, etc.">
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => openReject({ kind: 'item', order: o, item: i })}
                              sx={{ borderRadius: RADIUS, minHeight: 44, minWidth: 110, fontWeight: 700 }}
                            >
                              Reject
                           </Button>
                         </Tooltip>
                        </>
                      )}
                      {i.status === 'ready' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => bumpItem(o.id, i.id, 'served')}
                          sx={{ borderRadius: RADIUS, minHeight: 40, fontWeight: 700 }}
                        >
                          Served
                       </Button>
                      )}
                   </Box>
                 </Paper>
                ))}
             </Stack>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => completeOrder(o.id, 'bar')}
                  size="large"
                  startIcon={<CheckCircleIcon />}
                  sx={{
                    flex: 1.5,
                    borderRadius: RADIUS, minHeight: 52, fontWeight: 700,
                    bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.main', filter: 'brightness(0.92)' },
                  }}
                >
                  Mark All Served
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={reprintingId === o.id
                    ? <CircularProgress size={18} sx={{ color: 'common.white' }} />
                    : <PrintOutlinedIcon />}
                  disabled={reprintingId === o.id}
                  onClick={() => reprint(o.id)}
                  sx={{
                    flex: 1,
                    borderRadius: RADIUS, minHeight: 52, fontWeight: 700,
                    bgcolor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.main', filter: 'brightness(0.92)' },
                  }}
                >
                  {reprintingId === o.id ? 'Reprinting…' : 'Reprint'}
                </Button>
              </Box>
           </Paper>
          );
        })}
     </Box>

      {/* REJECTION DIALOG — confirms target + reason */}
      <Dialog
        open={!!rejecting}
        onClose={closeReject}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: RADIUS, borderTop: '4px solid', borderTopColor: 'error.main' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: RADIUS,
              bgcolor: 'error.main', color: 'common.white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <BlockIcon sx={{ fontSize: 18 }} />
         </Box>
          {rejecting?.kind === 'order' ? 'Reject Order' : 'Reject Item'}
       </DialogTitle>
        <DialogContent dividers>
          {rejecting && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {rejecting.kind === 'order' ? (
                  <>
                    You are about to <strong>{'cancel order #' + rejecting.order.number}</strong> —
                    all {rejecting.order.items.filter((i) => i.status !== 'served' && i.status !== 'cancelled').length}{' '}
                    item(s) will be removed from the kitchen and cashier queues.
                  </>
                ) : (
                  <>
                    You are about to <strong>{'cancel 1× ' + rejecting.item.name}</strong>{' '}from order #{rejecting.order.number}.
                    The remaining items keep being prepared.
                  </>
                )}
             </Typography>

              <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.5 }}>
                Reason — tap a tile
             </Typography>

              {/* Big square touch tiles for reject reasons. Each is the
                  size of a touch button (minHeight 72, 4px rounded) and
                  carries its own color code. */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 1,
                  mb: 1.5,
                }}
              >
                {REJECT_REASONS.map((r) => {
                  const selected = reason === r.label;
                  return (
                    <Box
                      key={r.label}
                      role="button"
                      tabIndex={0}
                      onClick={() => setReason(r.label)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setReason(r.label); }}
                      sx={{
                        borderRadius: RADIUS,
                        border: '2px solid',
                        borderColor: selected ? r.color : 'border.default',
                        bgcolor: selected ? r.color : r.colorSoft,
                        color: selected ? '#ffffff' : r.color,
                        p: 1.5,
                        minHeight: 72,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                        transition: 'transform 0.1s, border-color 0.1s, bgcolor 0.1s',
                        '&:hover': {
                          borderColor: r.color,
                          transform: 'translateY(-1px)',
                        },
                        '&:active': { transform: 'scale(0.97)' },
                        '&:focus-visible': { outline: `2px solid ${r.color}`, outlineOffset: 2 },
                      }}
                    >
                      <Box
                        sx={{
                          width: 28, height: 28, borderRadius: RADIUS,
                          bgcolor: selected ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.6)',
                          color: selected ? '#ffffff' : r.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          '& .MuiSvgIcon-root': { fontSize: 18 },
                        }}
                      >
                        {r.icon}
                     </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.15 }}>
                        {r.label}
                     </Typography>
                   </Box>
                  );
                })}
             </Box>

              <TextField
                fullWidth
                size="small"
                label="Or type a custom reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Out of oat milk"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: RADIUS } }}
              />

              {error && (
                <Alert severity="error" sx={{ mt: 1.5, borderRadius: RADIUS }}>
                  {error}
               </Alert>
              )}
           </Box>
          )}
       </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={closeReject} disabled={submitting} sx={{ borderRadius: RADIUS }}>
            Keep making drinks
         </Button>
          <Button
            onClick={confirmReject}
            variant="contained"
            color="error"
            disabled={submitting}
            startIcon={<CancelIcon />}
            sx={{ borderRadius: RADIUS, fontWeight: 700, minWidth: 140 }}
          >
            {submitting ? 'Cancelling…' : 'Reject'}
         </Button>
       </DialogActions>
     </Dialog>
   </Box>
  );
}
