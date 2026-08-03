import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, IconButton, Alert, Snackbar,
} from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Orders } from '../lib/api';
import { add, remove, setQty, clear, setTable, seedFromExisting } from '../store/cartSlice';
import { ws } from '../lib/ws';
import type { Order, Table } from '../types';

const SHAPE = {
  tile: 6,
  button: 4,
  chip: 4,
  dialog: 8,
};

type TableStatus = 'empty' | 'openbill';

export default function WaiterPage() {
  const dispatch = useAppDispatch();
  const { tables, products, categories } = useAppSelector((s) => s.menu);
  const cart = useAppSelector((s) => s.cart);
  const [open, setOpen] = useState<Table | null>(null);
  const [confirm, setConfirm] = useState<Table | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [productCat, setProductCat] = useState<number | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const reload = () => {
    Orders.list().then(setActiveOrders).catch(() => {});
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

  // The single open bill for a table. With the 1-bill-per-table rule every
  // table can have at most one of these — null when the table is empty.
  const tableOrder = (tableId: number) =>
    activeOrders.find(
      (o) =>
        o.table_id === tableId &&
        !['paid', 'void', 'cancelled'].includes(o.status),
    );

  // Status is intentionally collapsed to two values per the user's request:
  // "empty" (no open bill) or "openbill" (active bill on the table).
  const tableStatus = (tableId: number): TableStatus =>
    tableOrder(tableId) ? 'openbill' : 'empty';

  // Already-on-table summary (line items grouped across all active orders
  // on the table). Returns [{ name, qty, price }] sorted by name.
  const tableOrderSummary = (tableId: number) => {
    const list = activeOrders.filter(
      (o) =>
        o.table_id === tableId &&
        !['paid', 'void', 'cancelled'].includes(o.status),
    );
    const m = new Map<string, { name: string; qty: number; price: number }>();
    for (const o of list) {
      for (const it of o.items) {
        if (it.status === 'cancelled' || it.status === 'served') continue;
        const k = it.name;
        const prev = m.get(k);
        if (prev) prev.qty += it.qty;
        else m.set(k, { name: it.name, qty: it.qty, price: it.price });
      }
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleTileClick = (t: Table) => {
    const status = tableStatus(t.id);
    if (status === 'empty') {
      setOpen(t);
      dispatch(setTable(t.id));
    } else {
      // OpenBill: clicking opens a read-only confirmation sheet; the user
      // confirms before they're shown the menu input again, mirroring the
      // payment-dialog pattern.
      setConfirm(t);
    }
  };

  // Re-open the existing order for editing after the waiter confirms.
  // The existing bill is seeded into the cart so the waiter can see what's
  // already on the table while adding more items. Existing items are
  // marked `fromExisting` and rendered read-only.
  const proceedFromOpenBill = (t: Table) => {
    const existing = tableOrder(t.id);
    if (existing) {
      const seedItems = existing.items
        .filter((it) => it.status !== 'cancelled')
        .map((it) => {
          const product = products.find((p) => p.id === it.product_id);
          if (!product) return null;
          return {
            product,
            qty: it.qty,
            modifiers: it.modifiers,
            notes: it.notes ?? '',
            existingItemId: it.id,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      dispatch(
        seedFromExisting({
          orderId: existing.id,
          items: seedItems,
        }),
      );
    }
    setConfirm(null);
    setOpen(t);
    dispatch(setTable(t.id));
  };

  const send = async () => {
    if (!open || cart.items.length === 0) return;
    // Filter out the read-only existing items — only send the newly added
    // lines to the server.
    const newItems = cart.items.filter((i) => !i.fromExisting);
    if (newItems.length === 0) {
      setSnack('Add at least one new item before sending.');
      return;
    }
    try {
      if (cart.appendingToOrderId != null) {
        await Orders.appendItems(cart.appendingToOrderId, {
          items: newItems.map((i) => ({
            product_id: i.product.id,
            qty: i.qty,
            modifiers: i.modifiers.map((m) => m.id),
            notes: i.notes,
          })),
        });
      } else {
        await Orders.checkout({
          table_id: open.id,
          type: 'dine_in',
          customer_name: '',
          notes: 'From waiter terminal',
          items: newItems.map((i) => ({
            product_id: i.product.id,
            qty: i.qty,
            modifiers: i.modifiers.map((m) => m.id),
            notes: i.notes,
          })),
          payment_method: 'cash',
          tendered: 0,
        });
      }
      dispatch(clear());
      dispatch(setTable(null));
      setOpen(null);
      reload();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail?.toString?.() ??
        (typeof e?.response?.data?.detail === 'string'
          ? e.response.data.detail
          : null) ??
        e?.message ??
        'Failed to send the order';
      setSnack(detail);
    }
  };

  const visible = products.filter((p) => !productCat || p.category_id === productCat);
  // In append-mode, the bottom "total" reflects ONLY the new items that
  // will be POSTed to /api/orders/{id}/items. Existing items on the bill
  // are read-only — they should not influence the new subtotal the cashier
  // ultimately sees.
  const total = cart.items
    .filter((i) => !i.fromExisting)
    .reduce((s, i) => s + (i.product.price + i.modifiers.reduce((sm, m) => sm + m.price_delta, 0)) * i.qty, 0);
  // Existing-bill subtotal (read-only items already on the table).
  // Used to compute the grand "Total bill amount" shown in the footer
  // when the waiter is appending to an open bill.
  const existingTotal = cart.items
    .filter((i) => i.fromExisting)
    .reduce((s, i) => s + (i.product.price + i.modifiers.reduce((sm, m) => sm + m.price_delta, 0)) * i.qty, 0);

  const tileColor = (status: TableStatus) =>
    status === 'openbill'
      ? { bg: 'role.waiter', fg: '#ffffff' }
      : { bg: 'surface.paper', fg: 'role.waiter' };

  return (
    <Box sx={{ flex: 1, p: 3, overflow: 'auto', bgcolor: 'surface.page' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 1.5,
            bgcolor: 'role.waiter', color: 'common.white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <TableRestaurantIcon sx={{ fontSize: 20 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Floor Plan
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip size="small" variant="outlined" label={`${tables.length} tables`} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 2,
        }}
      >
        {tables.map((t) => {
          const status = tableStatus(t.id);
          const existing = tableOrder(t.id);
          const summary = tableOrderSummary(t.id);
          const colors = tileColor(status);
          return (
            <Paper
              key={t.id}
              onClick={() => handleTileClick(t)}
              sx={{
                p: 2,
                cursor: 'pointer',
                borderRadius: `${SHAPE.tile}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                minHeight: 168,
                bgcolor: colors.bg,
                color: colors.fg,
                border: '2px solid',
                borderColor: status === 'openbill' ? colors.bg : 'border.default',
                transition: 'transform 0.12s',
                '&:hover': { transform: 'translateY(-2px)' },
                '&:active': { transform: 'scale(0.99)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 40, height: 40, borderRadius: `${SHAPE.button}px`,
                    bgcolor: status === 'openbill' ? '#ffffff22' : 'role.waiter',
                    color: status === 'openbill' ? '#ffffff' : '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <TableRestaurantIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                    {t.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ opacity: status === 'openbill' ? 0.92 : 0.74 }}
                  >
                    {t.seats} seats ·{' '}
                    {status === 'openbill'
                      ? `Bill #${existing!.number}`
                      : 'Kosong'}
                  </Typography>
                </Box>
                <Chip
                  label={status === 'openbill' ? 'OpenBill' : 'Empty'}
                  size="small"
                  sx={{
                    bgcolor: status === 'openbill' ? '#ffffff22' : 'rgba(0,0,0,0.04)',
                    color: status === 'openbill' ? '#ffffff' : 'text.primary',
                    border: 'none',
                    fontWeight: 700,
                  }}
                />
              </Box>

              <Box
                sx={{
                  borderTop: '1px solid',
                  borderColor: status === 'openbill' ? '#ffffff33' : 'border.soft',
                  pt: 1,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {summary.length === 0 ? (
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      opacity: status === 'openbill' ? 0.92 : 0.74,
                    }}
                  >
                    {status === 'openbill'
                      ? 'No items yet on this bill.'
                      : 'Tap to start a new order.'}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
                    <HistoryIcon
                      sx={{
                        fontSize: 14,
                        mt: 0.25,
                        color: status === 'openbill' ? '#ffffff' : 'text.secondary',
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        color: status === 'openbill' ? '#ffffff' : 'text.secondary',
                      }}
                    >
                      ALREADY ON TABLE
                    </Typography>
                  </Box>
                )}
                {summary.slice(0, 4).map((s) => (
                  <Box
                    key={s.name}
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', lineHeight: 1.25 }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        pr: 1,
                        color: status === 'openbill' ? '#ffffff' : 'text.primary',
                      }}
                    >
                      {s.qty}× {s.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: status === 'openbill' ? '#ffffff' : 'text.secondary',
                      }}
                    >
                      ${(s.price * s.qty).toFixed(2)}
                    </Typography>
                  </Box>
                ))}
                {summary.length > 4 && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: status === 'openbill' ? '#ffffff' : 'text.secondary',
                    }}
                  >
                    +{summary.length - 4} more line(s)
                  </Typography>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* ─── OpenBill confirmation sheet (no popup-dialog feel) ─────────── */}
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirm?.name} · OpenBill #
          {confirm ? tableOrder(confirm.id)?.number : ''}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            This table already has an open bill. Continue to add more items to
            the same bill?
          </Typography>
          {confirm && tableOrderSummary(confirm.id).length > 0 && (
            <Paper
              variant="outlined"
              sx={{
                p: 1.25,
                bgcolor: 'surface.muted',
                borderRadius: `${SHAPE.button}px`,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {tableOrderSummary(confirm.id).map((s) => (
                <Box
                  key={s.name}
                  sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {s.qty}× {s.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${(s.price * s.qty).toFixed(2)}
                  </Typography>
                </Box>
              ))}
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1.5 }}>
          <Button
            onClick={() => setConfirm(null)}
            color="warning"
            size="large"
            sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 56, flex: 1, fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => confirm && proceedFromOpenBill(confirm)}
            variant="contained"
            color="primary"
            size="large"
            sx={{
              borderRadius: `${SHAPE.button}px`,
              minHeight: 56,
              flex: 1,
              fontWeight: 700,
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Menu input modal (90% screen, 3-column 30/20/50 layout) ─── */}
      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        PaperProps={{
          sx: {
            borderRadius: `${SHAPE.dialog}px`,
            width: '90vw',
            maxWidth: '90vw',
            height: '85vh',
            maxHeight: '85vh',
            m: 0,
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 1,
          }}
        >
          {open?.name} — Take Order
       </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', gap: 0, p: 0, overflow: 'hidden' }}>
          {/* ─── Column 1 (30%) — Order / Cart panel ─────────────────── */}
          <Box
            sx={{
              width: '30%',
              minWidth: 280,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'surface.elevated',
              borderRight: '1px solid',
              borderColor: 'border.default',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {cart.appendingToOrderId != null ? `Bill #${cart.appendingToOrderId}` : 'Items'}
           </Typography>
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
              {/* ── Existing on Table ──────────────────────────────────── */}
              {cart.appendingToOrderId != null && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800, letterSpacing: 0.5,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                      }}
                    >
                      Existing on Table
                   </Typography>
                    <Chip
                      label={`${cart.items.filter((i) => i.fromExisting).length}`}
                      size="small"
                      sx={{ height: 18, fontSize: '0.7rem', fontWeight: 700, borderRadius: `${SHAPE.chip}px` }}
                    />
                 </Box>
                  {cart.items.filter((i) => i.fromExisting).length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      (no active items)
                   </Typography>
                  )}
                  {cart.items.filter((i) => i.fromExisting).map((i) => (
                    <Paper
                      key={i.uid}
                      variant="outlined"
                      sx={{
                        p: 1, mb: 1, borderRadius: `${SHAPE.button}px`,
                        bgcolor: 'surface.muted',
                        borderColor: 'border.soft',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {i.product.name}
                         </Typography>
                          <Chip
                            label="ON BILL"
                            size="small"
                            sx={{
                              height: 16, fontSize: '0.62rem', fontWeight: 800,
                              bgcolor: 'role.waiter', color: 'common.white',
                              border: 'none', borderRadius: `${SHAPE.chip}px`,
                              letterSpacing: 0.4,
                            }}
                          />
                       </Box>
                     </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{ minWidth: 24, textAlign: 'center', fontWeight: 700, ml: 0.5 }}
                        >
                          {i.qty}×
                       </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          Amount
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          ${((i.product.price + i.modifiers.reduce((s, m) => s + m.price_delta, 0)) * i.qty).toFixed(2)}
                       </Typography>
                     </Box>
                   </Paper>
                  ))}
                  <Divider sx={{ my: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800, letterSpacing: 0.5,
                        color: 'role.waiter',
                        textTransform: 'uppercase',
                        px: 1,
                      }}
                    >
                      New items to send
                   </Typography>
                 </Divider>
                </>
              )}

              {/* ── New items (or whole cart if not appending) ─────────── */}
              {(() => {
                const newItems = cart.items.filter((i) => !i.fromExisting);
                if (cart.appendingToOrderId == null && cart.items.length === 0) {
                  return (
                    <Typography variant="body2" color="text.secondary">
                      No items yet
                   </Typography>
                  );
                }
                if (cart.appendingToOrderId != null && newItems.length === 0) {
                  return (
                    <Typography variant="body2" color="text.secondary">
                      Tap products on the right to add.
                   </Typography>
                  );
                }
                return newItems.map((i) => (
                  <Paper key={i.uid} variant="outlined" sx={{ p: 1, mb: 1, borderRadius: `${SHAPE.button}px` }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {i.product.name}
                     </Typography>
                      <IconButton size="small" color="error" onClick={() => dispatch(remove(i.uid))}>
                        <DeleteIcon fontSize="small" />
                     </IconButton>
                   </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => dispatch(setQty({ uid: i.uid, qty: i.qty - 1 }))}>
                        <RemoveIcon fontSize="small" />
                     </IconButton>
                      <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>
                        {i.qty}
                     </Typography>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => dispatch(setQty({ uid: i.uid, qty: i.qty + 1 }))}
                      >
                        <AddIcon fontSize="small" />
                     </IconButton>
                      <Box sx={{ flex: 1 }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        Amount
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        ${((i.product.price + i.modifiers.reduce((s, m) => s + m.price_delta, 0)) * i.qty).toFixed(2)}
                     </Typography>
                   </Box>
                 </Paper>
                ));
              })()}
           </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {cart.appendingToOrderId != null ? 'New items total' : 'Total'}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>${total.toFixed(2)}</Typography>
              </Box>
              {cart.appendingToOrderId != null && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 800, color: 'role.waiter' }}>
                    Total bill amount
                  </Typography>
                  <Typography sx={{ fontWeight: 800, color: 'role.waiter' }}>
                    ${(existingTotal + total).toFixed(2)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* ─── Column 2 (20%) — Category tiles ────────────────────── */}
          <Box
            sx={{
              width: '20%',
              minWidth: 180,
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              borderRight: '1px solid',
              borderColor: 'border.default',
              bgcolor: 'surface.muted',
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            <Typography
              variant="overline"
              sx={{ fontWeight: 800, letterSpacing: 0.5, color: 'text.secondary', pl: 0.5 }}
            >
              Categories
           </Typography>
            <Paper
              onClick={() => setProductCat(null)}
              sx={{
                p: 1.25,
                cursor: 'pointer',
                borderRadius: `${SHAPE.tile}px`,
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: productCat == null ? 'role.waiter' : 'surface.paper',
                color: productCat == null ? '#ffffff' : 'text.primary',
                border: '2px solid',
                borderColor: productCat == null ? 'role.waiter' : 'border.default',
                transition: 'transform 0.12s, box-shadow 0.12s',
                '&:hover': { transform: 'translateY(-1px)' },
                '&:active': { transform: 'scale(0.98)' },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                All
             </Typography>
           </Paper>
            {categories.map((c) => {
              const active = productCat === c.id;
              return (
                <Paper
                  key={c.id}
                  onClick={() => setProductCat(c.id)}
                  sx={{
                    p: 1.25,
                    cursor: 'pointer',
                    borderRadius: `${SHAPE.tile}px`,
                    minHeight: 64,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: active ? c.color : 'surface.paper',
                    color: active ? '#ffffff' : c.color,
                    border: '2px solid',
                    borderColor: active ? c.color : 'border.default',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    },
                    '&:active': { transform: 'scale(0.98)' },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 800, textAlign: 'center', lineHeight: 1.15 }}
                  >
                    {c.name}
                 </Typography>
               </Paper>
              );
            })}
         </Box>

          {/* ─── Column 3 (50%) — Product tiles ─────────────────────── */}
          <Box
            sx={{
              width: '50%',
              minWidth: 360,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                p: 2.5,
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 1.25,
                }}
              >
              {visible.map((p) => {
                const catColor = categories.find((c) => c.id === p.category_id)?.color || '#2b6cff';
                const onTable = open
                  ? tableOrderSummary(open.id).find((s) => s.name === p.name)
                  : undefined;
                return (
                  <Paper
                    key={p.id}
                    onClick={() => dispatch(add({ product: p }))}
                    sx={{
                      p: 1.75,
                      cursor: 'pointer',
                      borderRadius: `${SHAPE.tile}px`,
                      minHeight: 96,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      bgcolor: catColor,
                      color: '#ffffff',
                      border: '2px solid',
                      borderColor: catColor,
                      transition: 'transform 0.12s, box-shadow 0.12s',
                      position: 'relative',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
                      },
                      '&:active': { transform: 'scale(0.98)' },
                    }}
                  >
                    {onTable && (
                      <Box
                        sx={{
                          position: 'absolute', top: 6, right: 6,
                          bgcolor: 'rgba(0,0,0,0.55)', color: '#fff',
                          borderRadius: `${SHAPE.chip}px`,
                          px: 0.75, py: 0.25,
                          fontSize: '0.7rem', fontWeight: 700,
                        }}
                      >
                        {onTable.qty}× already
                     </Box>
                    )}
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, lineHeight: 1.15, fontSize: '1.1rem', color: '#ffffff' }}
                    >
                      {p.name}
                   </Typography>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, color: '#ffffff', opacity: 0.95, mt: 1 }}
                    >
                      ${p.price.toFixed(2)}
                   </Typography>
                 </Paper>
                 );
                 })}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1.5 }}>
          <Button
            onClick={() => { setOpen(null); dispatch(clear()); dispatch(setTable(null)); }}
            color="warning"
            size="large"
            sx={{
              borderRadius: `${SHAPE.button}px`,
              minHeight: 56,
              flex: 1,
              fontWeight: 700,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={send}
            variant="contained"
            color="primary"
            size="large"
            disabled={
              cart.items.length === 0 ||
              cart.items.filter((i) => !i.fromExisting).length === 0
            }
            sx={{
              borderRadius: `${SHAPE.button}px`,
              minHeight: 56,
              flex: 1,
              fontWeight: 700,
            }}
          >
            {cart.appendingToOrderId != null
              ? `Append to Bill #${cart.appendingToOrderId}`
              : 'Send to Kitchen'}
          </Button>
        </DialogActions>
      </Dialog>

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
