import { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Alert, Snackbar, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import BackspaceIcon from '@mui/icons-material/Backspace';
import AddCircleIcon from '@mui/icons-material/AddCircleOutline';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PercentIcon from '@mui/icons-material/Percent';
import { useAppSelector } from '../store/hooks';
import { Orders, Printer, Discount, resolvePresetDiscount, type DiscountPolicy, type DiscountPreset } from '../lib/api';
import { ws } from '../lib/ws';
import type { Order, Table } from '../types';

const SHAPE = {
  card: 12,
  button: 12,
  chip: 12,
  dialog: 12,
  tile: 12,
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
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // M25 — sticky Pay-bar reprint state. Separated from BillPanel's
  // internal reprint state so the sticky "Print" button and the header
  // IconButton can both run independently without disabling each other.
  const [reprintingBill, setReprintingBill] = useState(false);
  // M32 — "Open Bill" confirmation popup. `openingBill` holds the table
  // that was clicked when it has no open bill; `opening` tracks whether
  // the API call is in flight so the popup buttons can be disabled.
  const [openingBill, setOpeningBill] = useState<Table | null>(null);
  const [opening, setOpening] = useState(false);
  // M22 — Change Due popup. Opens after a successful cash close when
  // tendered > total, so the cashier can hand the change to the customer
  // and tap OK to acknowledge. Single OK button.
  const [changeDue, setChangeDue] = useState<{ amount: number; total: number; tendered: number } | null>(null);
  // M20 — Printer status chip. Polls /api/printer/status every 10s.
  const [printerStatus, setPrinterStatus] = useState<{ mode: string; dry_run: boolean } | null>(null);
  // M20 — Empty bill action dialog. Holds the pending action for the
  // confirmation popup ('cancel' | 'close' | null).
  const [emptyBillAction, setEmptyBillAction] = useState<'cancel' | 'close' | null>(null);

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

  // M20 — poll printer status every 10s for the header chip.
  useEffect(() => {
    let active = true;
    const poll = () => {
      Printer.status()
        .then((s) => { if (active) setPrinterStatus(s); })
        .catch(() => { if (active) setPrinterStatus(null); });
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { active = false; clearInterval(id); };
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
      {/* HEADER — compact top bar */}
      <Box
        sx={{
          px: 3, py: 1.5,
          borderBottom: '1px solid', borderColor: 'border.default',
          bgcolor: 'surface.paper',
          display: 'flex', alignItems: 'center', gap: 1.5,
          minHeight: 64,
        }}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: `${SHAPE.card}px`, bgcolor: 'role.cashier', color: 'common.white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PointOfSaleIcon sx={{ fontSize: 20 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>Cashier</Typography>
        <Typography variant="caption" color="text.secondary">
          {liveBills.length} open · ${liveBills.reduce((s, b) => s + b.total, 0).toFixed(2)} due
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          icon={<PrintOutlinedIcon sx={{ fontSize: 16 }} />}
          label={printerStatus ? `Printer: ${printerStatus.mode}${printerStatus.dry_run ? ' (dry)' : ''}` : 'Printer: checking…'}
          color={printerStatus && printerStatus.mode !== 'dummy' ? 'success' : 'default'}
          variant="outlined" size="small"
          sx={{ fontWeight: 700, borderRadius: `${SHAPE.chip}px` }}
        />
      </Box>

      {/* BODY — 2 columns: floor plan (left) + bill view (right) */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* LEFT — Floor plan grid */}
        <Box sx={{ width: { xs: '100%', md: '70%' }, flexShrink: 0, borderRight: { md: '1px solid' }, borderColor: 'border.default', display: 'flex', flexDirection: 'column', bgcolor: 'surface.paper' }}>
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'border.default', display: 'flex', alignItems: 'center', gap: 1 }}>
            <HomeWorkIcon sx={{ fontSize: 18, color: 'role.cashier' }} />
            <Typography sx={{ fontWeight: 800, letterSpacing: 0.5, fontSize: '0.85rem' }}>FLOOR PLAN</Typography>
          </Box>
          <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.25 }}>
              {tablesSorted.map((t) => {
                const live = liveBillByTable.get(t.id);
                const isOpenBill = !!live;
                const isSelected = selectedTableId === t.id;
                return (
                  <Paper
                    key={t.id}
                    onClick={() => { if (isOpenBill) setSelectedTableId((cur) => (cur === t.id ? null : t.id)); else setOpeningBill(t); }}
                    sx={{
                      p: 1.5, cursor: 'pointer',
                      borderRadius: `${SHAPE.card}px`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      minHeight: 96, gap: 0.5,
                      bgcolor: isOpenBill ? 'role.cashier' : 'surface.paper',
                      color: isOpenBill ? 'common.white' : 'text.primary',
                      border: '2px solid', borderColor: isSelected ? (isOpenBill ? 'common.white' : 'role.cashier') : 'border.default',
                      transition: 'transform 0.12s',
                      '&:hover': { transform: 'translateY(-2px)' },
                      '&:active': { transform: 'scale(0.97)' },
                    }}
                  >
                    <TableRestaurantIcon sx={{ fontSize: 24, opacity: isOpenBill ? 0.9 : 0.6 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.1 }}>{t.name}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', opacity: isOpenBill ? 0.95 : 0.7 }}>
                      {isOpenBill ? `$${live!.total.toFixed(2)}` : 'Empty'}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* RIGHT — Bill view */}
        <Box sx={{ width: '30%', minWidth: 320, flexShrink: 0, borderLeft: { md: '1px solid' }, borderColor: 'border.default', display: 'flex', flexDirection: 'column', bgcolor: 'surface.paper' }}>
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'border.default', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: 0.5, fontSize: '0.85rem' }}>
              {selectedTableId == null ? 'NO TABLE SELECTED' : 'CURRENT BILL'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {!selectedBill ? (
              <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {selectedTableId == null ? 'Pick a table on the left.' : 'No open bill.'}
                </Typography>
              </Box>
            ) : (
              <BillPanel bill={selectedBill} tableName={tables.find((t: Table) => t.id === selectedBill.table_id)?.name} onReprint={(msg, severity) => setSnack({ msg, severity })} />
            )}
          </Box>
        </Box>
      </Box>

      {/* BOTTOM ACTION BAR — full width, same height as header */}
      <Box
        sx={{
          px: 3, py: 1.5,
          borderTop: '1px solid', borderColor: 'border.default',
          bgcolor: 'surface.paper',
          display: 'flex', alignItems: 'center', gap: 1.5,
          minHeight: 64,
        }}
      >
        {selectedBill ? (
          <>
            {/* Bill total display */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.secondary' }}>TOTAL</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', fontFamily: 'monospace', color: 'role.cashier' }}>
                ${selectedBill.total.toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            {/* Action buttons */}
            {selectedBill.items.length === 0 && selectedBill.status === 'open' ? (
              <>
                <Button variant="contained" size="large" startIcon={<CancelIcon />} onClick={() => setEmptyBillAction('cancel')}
                  sx={{ bgcolor: '#d32f2f', borderRadius: `${SHAPE.card}px`, minHeight: 56, fontWeight: 800, fontSize: '1.05rem', boxShadow: 'none', '&:hover': { bgcolor: '#b71c1c' } }}>
                  Cancel
                </Button>
                <Button variant="contained" size="large" startIcon={<CheckCircleIcon />} onClick={() => setEmptyBillAction('close')}
                  sx={{ bgcolor: '#2e7d32', borderRadius: `${SHAPE.card}px`, minHeight: 56, fontWeight: 800, fontSize: '1.05rem', boxShadow: 'none', '&:hover': { bgcolor: '#1b5e20' } }}>
                  Close
                </Button>
              </>
            ) : (
              <>
                {selectedBill.status === 'paid' && (
                  <Button variant="contained" size="large" startIcon={reprintingBill ? <CircularProgress size={16} sx={{ color: 'common.white' }} /> : <PrintOutlinedIcon />}
                    onClick={async () => {
                      setReprintingBill(true);
                      try {
                        const res = await Orders.printReceipt(selectedBill.id);
                        setSnack({ msg: res.ok ? `Receipt reprinted · ${res.bytes_written} bytes` : `Receipt failed · ${res.error ?? 'unknown'}`, severity: res.ok ? 'success' : 'error' });
                      } catch (e: any) {
                        setSnack({ msg: e?.response?.data?.detail ?? e?.message ?? 'Reprint failed', severity: 'error' });
                      } finally { setReprintingBill(false); }
                    }}
                    disabled={reprintingBill}
                    sx={{ bgcolor: '#2b6cff', borderRadius: `${SHAPE.card}px`, minHeight: 56, fontWeight: 800, fontSize: '1rem', boxShadow: 'none', '&:hover': { bgcolor: '#2b6cff', filter: 'brightness(0.92)' } }}>
                    {reprintingBill ? 'Printing…' : 'Print'}
                  </Button>
                )}
                <Button variant="contained" size="large" startIcon={<CheckCircleIcon />} onClick={() => setPaying(selectedBill)}
                  disabled={selectedBill.status === 'paid' || selectedBill.status === 'cancelled'}
                  sx={{ bgcolor: '#2e7d32', borderRadius: `${SHAPE.card}px`, minHeight: 56, fontWeight: 800, fontSize: '1.05rem', boxShadow: 'none', '&:hover': { bgcolor: '#1b5e20' } }}>
                  {selectedBill.status === 'paid' ? 'Paid' : selectedBill.status === 'cancelled' ? 'Cancelled' : 'Pay Bill'}
                </Button>
              </>
            )}
          </>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary" sx={{ fontWeight: 600 }}>Select a table to see actions</Typography>
          </Box>
        )}
      </Box>

      {/* ─── M20 — Empty Bill Cancel/Close confirmation ─── */}
      <Dialog
        open={!!emptyBillAction}
        onClose={() => setEmptyBillAction(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px`, minWidth: 380 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pt: 3, pb: 1.5, fontSize: '1.5rem', textAlign: 'center' }}>
          {emptyBillAction === 'cancel' ? 'Cancel Bill?' : 'Close Bill?'}
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            Bill #{selectedBill?.number} will be deleted entirely — no record kept, table freed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setEmptyBillAction(null)}
            variant="contained"
            color="warning"
            size="large"
            sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 72, flex: 1, fontWeight: 700, fontSize: '1.1rem' }}
          >
            No
          </Button>
          <Button
            onClick={async () => {
              if (!selectedBill || !emptyBillAction) return;
              try {
                if (emptyBillAction === 'cancel') {
                  await Orders.cancel(selectedBill.id, { reason: 'cashier delete — empty bill' });
                } else {
                  await Orders.close(selectedBill.id, { payment_method: 'cash', tendered: 0 });
                }
                setSnack({ msg: `Bill #${selectedBill.number} deleted — no record kept`, severity: 'success' });
                setEmptyBillAction(null);
                reload();
              } catch (e: any) {
                const detail = e?.response?.data?.detail ?? e?.message ?? 'Failed';
                setSnack({ msg: typeof detail === 'string' ? detail : JSON.stringify(detail), severity: 'error' });
              }
            }}
            variant="contained"
            color={emptyBillAction === 'cancel' ? 'error' : 'success'}
            size="large"
            sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 72, flex: 1, fontWeight: 700, fontSize: '1.1rem' }}
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── M32 — Open Bill confirmation popup ─── */}
      <Dialog
        open={!!openingBill}
        onClose={() => { if (!opening) setOpeningBill(null); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px`, minWidth: 480 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pt: 3, pb: 1.5, fontSize: '1.5rem', textAlign: 'center' }}>
          Open New Bill?
        </DialogTitle>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setOpeningBill(null)}
            variant="contained"
            color="warning"
            size="large"
            disabled={opening}
            sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 72, flex: 1, fontWeight: 700, fontSize: '1.1rem' }}
          >
            No
          </Button>
          <Button
            onClick={async () => {
              if (!openingBill) return;
              setOpening(true);
              try {
                await Orders.openBill({
                  table_id: openingBill.id,
                  type: 'dine_in',
                  customer_name: '',
                  notes: 'Opened by cashier',
                });
                setOpeningBill(null);
                reload();
              } catch (e: any) {
                const detail = e?.response?.data?.detail ?? e?.message ?? 'Failed to open bill';
                setSnack({ msg: typeof detail === 'string' ? detail : JSON.stringify(detail), severity: 'error' });
              } finally {
                setOpening(false);
              }
            }}
            variant="contained"
            size="large"
            startIcon={opening ? <CircularProgress size={16} sx={{ color: 'common.white' }} /> : <AddCircleIcon />}
            disabled={opening}
            sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 72, flex: 1, fontWeight: 700, fontSize: '1.1rem' }}
          >
            {opening ? 'Opening…' : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Payment dialog (popup with big Confirm/Cancel buttons) ─── */}
      <PaymentDialog
        bill={paying}
        open={!!paying}
        submitting={submitting}
        onCancel={() => { if (!submitting) setPaying(null); }}
        onConfirm={async (method, tendered, appliedDiscount) => {
          if (!paying) return;
          setSubmitting(true);
          // Build payload — preset path takes priority over free-form.
          // Server-side `preset_label` resolves the dollar amount (and
          // applies percent presets against the bill subtotal) so the
          // cashier can't tamper with the cap.
          const payload: {
            payment_method: string;
            tendered: number;
            preset_label?: string;
            discount?: number;
            discount_reason?: string;
          } = { payment_method: method, tendered };
          if (appliedDiscount) {
            payload.preset_label = appliedDiscount.label;
            payload.discount_reason = appliedDiscount.label;
          }
          try {
            await Orders.close(paying.id, payload);
            // M22 — Show Change Due popup for cash payments where the
            // customer handed over more than the total. Card/mobile
            // payments are always exact, so they skip this popup.
            if (method === 'cash' && tendered > paying.total + 0.005) {
              setChangeDue({
                amount: +(tendered - paying.total).toFixed(2),
                total: paying.total,
                tendered,
              });
            }
            setPaying(null);
            reload();
          } catch (e: any) {
            const detail =
              (Array.isArray(e?.response?.data?.detail)
                ? e.response.data.detail.map((d: any) => d?.msg).join('; ')
                : e?.response?.data?.detail) ??
              e?.message ??
              'Failed to close the bill';
            setSnack({ msg: typeof detail === 'string' ? detail : JSON.stringify(detail), severity: 'error' });
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
           severity={snack?.severity ?? 'error'}
           variant="filled"
           onClose={() => setSnack(null)}
           sx={{ borderRadius: `${SHAPE.button}px` }}
         >
           {snack?.msg ?? ''}
       </Alert>
      </Snackbar>

       {/* ─── M22 — Change Due popup ───
           Shown after a successful cash close when tendered > total.
           Big green change amount, single OK button to acknowledge
           (cashier hands the change, then taps OK to dismiss). */}
       <Dialog
         open={!!changeDue}
         onClose={() => { /* OK button only — no backdrop dismiss */ }}
         maxWidth="xs"
         fullWidth
         PaperProps={{
           sx: {
             borderRadius: `${SHAPE.dialog}px`,
             borderTop: '6px solid',
             borderTopColor: 'success.main',
           },
         }}
       >
         <DialogTitle sx={{ textAlign: 'center', pt: 2.5, pb: 0.5 }}>
           <Typography
             variant="overline"
             sx={{
               display: 'block',
               color: 'success.main',
               fontWeight: 800,
               letterSpacing: 2,
             }}
           >
             Change Due
          </Typography>
           <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', fontWeight: 600, mt: 0.5 }}>
             Hand this to the customer
          </Typography>
        </DialogTitle>
         <DialogContent dividers sx={{ borderColor: 'success.main' }}>
           <Box sx={{ textAlign: 'center', py: 2 }}>
             <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '5rem', lineHeight: 1, color: 'success.main', letterSpacing: -2 }}>
               ${changeDue?.amount.toFixed(2) ?? '0.00'}
            </Typography>
             {changeDue && (
               <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontWeight: 600 }}>
                 Tendered ${changeDue.tendered.toFixed(2)} · Total ${changeDue.total.toFixed(2)}
              </Typography>
             )}
          </Box>
        </DialogContent>
         <DialogActions sx={{ p: 2 }}>
           <Button
             onClick={() => setChangeDue(null)}
             variant="contained"
             color="success"
             size="large"
             fullWidth
             sx={{
               borderRadius: `${SHAPE.button}px`,
               minHeight: 72,
               fontWeight: 800,
               fontSize: '1.2rem',
             }}
           >
             OK
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
  );
}

// Permanent bill panel — the right column of the cashier. Shows the
// selected table's bill with a sticky Pay button below.
function BillPanel({ bill, tableName, onReprint }: { bill: Order; tableName?: string; onReprint?: (msg: string, severity: 'success' | 'error') => void }) {
  const accent =
    bill.status === 'served' || bill.status === 'ready' ? '#2b6cff' : 'role.cashier';
  const [reprinting, setReprinting] = useState(false);
  const handleReprint = async () => {
    setReprinting(true);
    try {
      const res = await Orders.printReceipt(bill.id);
      onReprint?.(res.ok
        ? `Receipt reprinted · ${res.bytes_written} bytes`
        : `Receipt failed · ${res.error ?? 'unknown error'}`,
        res.ok ? 'success' : 'error');
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? 'Reprint request failed';
      onReprint?.(typeof detail === 'string' ? detail : JSON.stringify(detail), 'error');
    } finally {
      setReprinting(false);
    }
  };
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
        {/* Reprint receipt — only when bill is paid (backend guard) */}
        {bill.status === 'paid' && (
          <Tooltip title="Reprint customer receipt">
            <span>
              <IconButton
                size="small"
                color="primary"
                disabled={reprinting}
                onClick={handleReprint}
                sx={{
                  borderRadius: `${SHAPE.button}px`,
                  border: '1px solid', borderColor: 'primary.main',
                  bgcolor: 'primary.main', color: 'common.white',
                  '&:hover': { bgcolor: 'primary.main', filter: 'brightness(0.92)' },
                }}
              >
                {reprinting ? <CircularProgress size={16} sx={{ color: 'common.white' }} /> : <PrintOutlinedIcon fontSize="small" />}
             </IconButton>
           </span>
         </Tooltip>
        )}
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
      {bill.discount > 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>${bill.subtotal.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Discount{bill.discount_reason ? ` · ${bill.discount_reason}` : ''}</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#e07b1a', fontWeight: 700 }}>
              −${bill.discount.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Tax</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>${bill.tax.toFixed(2)}</Typography>
          </Box>
        </Box>
      )}
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
  onConfirm: (method: PaymentMethod, tendered: number, appliedDiscount: { label: string; amount: number } | null) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('0');
  const [error, setError] = useState<string | null>(null);
  // M21.1 — load admin-configured discount policy on open so the
  // preset row renders live values. `appliedPreset` is the cashier's
  // currently-selected preset; null means no discount applied. We
  // commit the *preset label*, not the dollar amount, so the server
  // resolves percent presets against the persisted subtotal.
  const [policy, setPolicy] = useState<DiscountPolicy | null>(null);
  const [appliedPreset, setAppliedPreset] = useState<{ label: string; amount: number } | null>(null);
  // M22 — short-payment confirm popup. Opens when cashier taps the
  // "Short" display (tendered < total). The Confirm button in the
  // dialog stays disabled while short, so the cashier MUST tap Short
  // → OK before Pay becomes available. Tracks the short amount at the
  // moment the popup opened so a numpad edit between pop and OK
  // doesn't drift.
  const [shortOpen, setShortOpen] = useState(false);
  const [shortSnapshot, setShortSnapshot] = useState<{ tendered: number; total: number } | null>(null);
  const [shortAcknowledged, setShortAcknowledged] = useState(false);

  useEffect(() => {
    if (open && bill) {
      setTendered('0');
      setMethod('cash');
      setError(null);
      setAppliedPreset(null);
      setShortOpen(false);
      setShortSnapshot(null);
      setShortAcknowledged(false);
      Discount.get().then(setPolicy).catch(() => setPolicy(null));
    }
  }, [open, bill?.id]);

  if (!bill) {
    return (
      <Dialog open={open} onClose={onCancel} PaperProps={{ sx: { borderRadius: `${SHAPE.dialog}px` } }}>
        <DialogContent />
      </Dialog>
    );
  }

  // Live recompute using subtotal - discount + tax. Mirrors the
  // backend `close_order` formula. Tax rate is derived from the
  // current `bill.tax` snapshot (it's the tax the order currently
  // carries, computed against subtotal at order/submit time).
  const subtotal = bill.subtotal ?? 0;
  const presets = policy?.presets ?? [];
  const taxRate = subtotal > 0 && bill.tax != null
    ? (bill.tax / subtotal)
    : 0.10;
  const discountAmount = appliedPreset?.amount ?? 0;
  const taxable = Math.max(0, subtotal - discountAmount);
  const tax = +(taxable * taxRate).toFixed(2);
  // total recomputed = taxable + tax (when discount applied) or
  // original total when no discount.
  const recomputedTotal = +(taxable + tax).toFixed(2);

  const tenderedNum = parseFloat(tendered) || 0;
  const isCash = method === 'cash';
  const change = isCash ? tenderedNum - recomputedTotal : 0;
  const isShort = isCash && tenderedNum < recomputedTotal - 0.005;
  // M22 — Confirm Pay is gated on: not short, OR the cashier has tapped
  // Short → OK in the confirm popup. `canPay` carries the standard
  // "enough tendered" check; `payEnabled` adds the acknowledgment gate.
  const canPay = !isCash || tenderedNum >= recomputedTotal - 0.005;
  const payEnabled = canPay && (!isShort || shortAcknowledged);

  const openShortConfirm = () => {
    if (!isShort) return;
    setShortSnapshot({ tendered: tenderedNum, total: recomputedTotal });
    setShortOpen(true);
  };
  const acceptShort = () => {
    setShortOpen(false);
    setShortAcknowledged(true);
  };

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
  // "Exact" fills the tendered input with the recomputed total
  // (which already accounts for the applied discount).
  const exact = () => setTendered(recomputedTotal.toFixed(2));
  const addQuick = (n: number) => setTendered((cur) => {
    const next = (parseFloat(cur === '0' ? '0' : cur) || 0) + n;
    return next.toFixed(2);
  });

  // Tap preset → resolve live dollar amount, toggle re-tap clears.
  const tapPreset = (p: DiscountPreset) => {
    const amount = resolvePresetDiscount(p, subtotal);
    if (appliedPreset?.label === p.label) {
      setAppliedPreset(null);
      return;
    }
    setAppliedPreset({ label: p.label, amount });
  };

  const handleConfirm = () => {
    if (!canPay) {
      setError('Tendered is less than total.');
      return;
    }
    setError(null);
    onConfirm(method, isCash ? tenderedNum : recomputedTotal, appliedPreset);
  };

  return (
    <>
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
      {/* ─── Header: centered title with BIG Payment Due amount ─── */}
      <DialogTitle
        sx={{
          textAlign: 'center',
          pb: 1.5,
          pt: 2,
          bgcolor: 'surface.muted',
          borderBottom: '1px solid',
          borderColor: 'border.default',
        }}
      >
        <Typography
          variant="overline"
          sx={{ display: 'block', color: 'text.secondary', letterSpacing: 1.5, fontWeight: 700 }}
        >
          Pay Bill #{bill.number}
          {bill.items.length ? ` · ${bill.items.length} item${bill.items.length === 1 ? '' : 's'}` : ''}
       </Typography>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: { xs: '2.8rem', sm: '3.6rem' },
            lineHeight: 1.05,
            color: 'role.cashier',
            mt: 0.5,
            letterSpacing: -1,
          }}
        >
          ${recomputedTotal.toFixed(2)}
       </Typography>
        <Typography
          variant="overline"
          sx={{
            display: 'block',
            color: 'role.cashier',
            fontWeight: 800,
            letterSpacing: 2,
            mt: 0.5,
          }}
        >
          PAYMENT DUE
       </Typography>
     </DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr 1fr' },
            gap: 1.5,
            alignItems: 'stretch',
          }}
        >
          {/* ─── Column 1: Discount ─── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.5 }}>
              Discount
            </Typography>
            {presets.length === 0 ? (
              <Paper
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: `${SHAPE.card}px`,
                  border: '1px dashed',
                  borderColor: 'border.default',
                  bgcolor: 'surface.muted',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No presets configured.
                </Typography>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: 1,
                  alignContent: 'start',
                }}
              >
                {presets.map((p, idx) => {
                  const liveAmount = resolvePresetDiscount(p, subtotal);
                  const isSel = appliedPreset?.label === p.label;
                  const isPercent = (p.mode ?? 'amount') === 'percent';
                  return (
                    <Box
                      key={`${p.label}-${idx}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => tapPreset(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapPreset(p); }
                      }}
                      sx={{
                        borderRadius: `${SHAPE.button}px`,
                        border: '2px solid',
                        borderColor: isSel ? '#e07b1a' : 'border.default',
                        bgcolor: isSel ? 'rgba(224, 123, 26, 0.10)' : 'surface.paper',
                        p: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.25,
                        minHeight: 72,
                        transition: 'all 0.12s',
                        '&:hover': { borderColor: '#e07b1a' },
                        '&:active': { transform: 'scale(0.97)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocalOfferIcon sx={{ fontSize: 14, color: isSel ? '#e07b1a' : 'text.secondary' }} />
                        <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.primary', textAlign: 'center', lineHeight: 1.1 }}>
                          {p.label}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#e07b1a' }}>
                        −${liveAmount.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        {isPercent ? `${Number(p.value ?? 0).toFixed(p.value === Math.floor(p.value) ? 0 : 1)}% off subtotal` : 'fixed off'}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
            {appliedPreset && (
              <Paper
                sx={{
                  p: 1.25,
                  mt: 1.5,
                  borderRadius: `${SHAPE.button}px`,
                  bgcolor: 'rgba(224, 123, 26, 0.08)',
                  border: '1px solid #e07b1a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <PercentIcon sx={{ color: '#e07b1a', fontSize: 18 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                    {appliedPreset.label} applied
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    ${subtotal.toFixed(2)} − ${appliedPreset.amount.toFixed(2)} = ${recomputedTotal.toFixed(2)}
                  </Typography>
                </Box>
                <Button size="small" color="warning" onClick={() => setAppliedPreset(null)} sx={{ minHeight: 32 }}>
                  Clear
                </Button>
              </Paper>
            )}
          </Box>

          {/* ─── Column 2: Tendered + Numpad ─── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.5 }}>
              Tendered
            </Typography>
            {isCash ? (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
                  <DisplayCard
                    label="Tendered"
                    value={`$${tenderedNum.toFixed(2)}`}
                    color="text.primary"
                    bg="surface.muted"
                    border="border.default"
                  />
                  {/* M22 — Short / Change. When tendered >= total this is
                      a green Change display. When short, it becomes a
                      red tappable button that opens the Short-confirm
                      popup. Once the cashier taps Short → OK, the badge
                      switches to a muted "Short acknowledged" state so
                      Pay becomes enabled. */}
                  {change >= 0 ? (
                    <DisplayCard
                      label="Change"
                      value={`$${change.toFixed(2)}`}
                      color="#1f9d55"
                      bg="#e8f6ee"
                      border="#1f9d55"
                      highlight={tenderedNum > 0}
                    />
                  ) : (
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={openShortConfirm}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openShortConfirm(); }
                      }}
                      sx={{
                        border: '1px solid',
                        borderColor: shortAcknowledged ? '#b0680e' : '#d8453c',
                        borderRadius: `${SHAPE.card}px`,
                        p: 1.5,
                        bgcolor: shortAcknowledged ? 'rgba(176, 104, 14, 0.10)' : '#fbe9e8',
                        textAlign: 'center',
                        minHeight: 80,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.12s, box-shadow 0.12s',
                        transform: shortAcknowledged ? 'none' : 'scale(1.02)',
                        '&:hover': { boxShadow: '0 0 0 3px rgba(216, 69, 60, 0.25)' },
                        '&:active': { transform: 'scale(0.97)' },
                      }}
                    >
                      <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.4, fontWeight: 700, letterSpacing: 0.5, color: shortAcknowledged ? '#b0680e' : '#d8453c' }}>
                        {shortAcknowledged ? 'Short acknowledged' : 'Short (tap)'}
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 700, fontFamily: 'monospace', fontSize: '1.4rem', lineHeight: 1.2, mt: 0.5,
                          color: shortAcknowledged ? '#b0680e' : '#d8453c',
                        }}
                      >
                        −${Math.abs(change).toFixed(2)}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Button size="small" variant="outlined" onClick={exact} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40, fontWeight: 600 }}>
                    Exact ${recomputedTotal.toFixed(2)}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => addQuick(5)} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>+$5</Button>
                  <Button size="small" variant="outlined" onClick={() => addQuick(10)} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>+$10</Button>
                  <Button size="small" variant="outlined" onClick={() => addQuick(20)} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>+$20</Button>
                  <Button size="small" variant="outlined" color="warning" onClick={clearAll} sx={{ borderRadius: `${SHAPE.button}px`, minHeight: 40 }}>Clear</Button>
                </Box>
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
                {error && (
                  <Alert severity="error" sx={{ borderRadius: `${SHAPE.button}px`, mt: 1.5 }}>
                    {error}
                  </Alert>
                )}
              </>
            ) : (
              <Paper
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: `${SHAPE.card}px`,
                  border: '1px solid',
                  borderColor: METHOD_TOKENS[method].color,
                  bgcolor: `${METHOD_TOKENS[method].color}14`,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  minHeight: 280,
                }}
              >
                <Box
                  sx={{
                    width: 56, height: 56, borderRadius: `${SHAPE.button}px`,
                    bgcolor: METHOD_TOKENS[method].color, color: 'common.white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    '& .MuiSvgIcon-root': { fontSize: 32 },
                  }}
                >
                  {METHOD_TOKENS[method].icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: METHOD_TOKENS[method].color }}>
                  Charge ${recomputedTotal.toFixed(2)} via {METHOD_TOKENS[method].label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {appliedPreset
                    ? `Subtotal $${subtotal.toFixed(2)} − ${appliedPreset.label} $${appliedPreset.amount.toFixed(2)} = $${taxable.toFixed(2)} taxable · Tax $${tax.toFixed(2)}`
                    : `Tap Confirm to charge the customer's ${METHOD_TOKENS[method].label.toLowerCase()}.`}
                </Typography>
              </Paper>
            )}
          </Box>

          {/* ─── Column 3: Method ─── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: 0.5 }}>
              Method
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 1,
                alignContent: 'start',
                flex: 1,
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
                      p: 1.5,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.75,
                      minHeight: 96,
                      transition: 'all 0.12s',
                      '&:hover': { borderColor: m.color },
                      '&:active': { transform: 'scale(0.97)' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 40, height: 40, borderRadius: `${SHAPE.button}px`,
                        bgcolor: m.color, color: 'common.white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        '& .MuiSvgIcon-root': { fontSize: 24 },
                      }}
                    >
                      {m.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {m.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            {isShort && !shortAcknowledged && (
              <Alert
                severity="warning"
                icon={<CancelIcon fontSize="inherit" />}
                sx={{ mt: 1.5, borderRadius: `${SHAPE.button}px`, fontWeight: 600 }}
              >
                Short by ${Math.abs(change).toFixed(2)} — tap the red Short badge to acknowledge.
              </Alert>
            )}
          </Box>
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
          disabled={!payEnabled || submitting}
          sx={{
            borderRadius: `${SHAPE.button}px`,
            minHeight: 72,
            flex: 1,
            fontWeight: 800,
            fontSize: '1.05rem',
          }}
        >
          {submitting ? 'Processing…' : `Confirm Pay $${recomputedTotal.toFixed(2)}`}
        </Button>
      </DialogActions>
    </Dialog>

    {/* ─── M22 — Short payment confirm popup ───
        Independent <Dialog> layered on top of the payment dialog.
        Single OK button. Tapping OK marks the short as acknowledged
        so the Confirm Pay button becomes enabled. Tapping the
        backdrop or hitting Esc just closes the popup WITHOUT
        acknowledging (cashier can re-tap the Short badge to re-open). */}
    <Dialog
      open={shortOpen}
      onClose={() => setShortOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${SHAPE.dialog}px`,
          borderTop: '6px solid',
          borderTopColor: '#d8453c',
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, color: '#d8453c' }}>
        Short Payment
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', letterSpacing: 1, fontWeight: 700 }}>
            Tendered
          </Typography>
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '2.2rem', color: 'text.primary' }}>
            ${(shortSnapshot?.tendered ?? tenderedNum).toFixed(2)}
          </Typography>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', letterSpacing: 1, fontWeight: 700, mt: 2 }}>
            Total Due
          </Typography>
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '2.2rem', color: 'role.cashier' }}>
            ${(shortSnapshot?.total ?? recomputedTotal).toFixed(2)}
          </Typography>
          <Typography
            sx={{
              mt: 2,
              fontWeight: 800,
              fontFamily: 'monospace',
              fontSize: '1.4rem',
              color: '#d8453c',
            }}
          >
            Short by ${Math.abs((shortSnapshot?.total ?? recomputedTotal) - (shortSnapshot?.tendered ?? tenderedNum)).toFixed(2)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Customer paid less than the bill total. Tap OK to record the short payment and close the bill.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={acceptShort}
          variant="contained"
          color="error"
          size="large"
          fullWidth
          sx={{
            borderRadius: `${SHAPE.button}px`,
            minHeight: 64,
            fontWeight: 800,
            fontSize: '1.1rem',
          }}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
    </>
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
