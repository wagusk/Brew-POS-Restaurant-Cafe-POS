import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  RadioGroup, FormControlLabel, Radio, Chip, TextField, Divider,
} from '@mui/material';
import type { Product, ModifierOption } from '../types';

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdd: (modifiers: ModifierOption[], notes: string) => void;
}

export default function ModifierModal({ product, open, onClose, onAdd }: Props) {
  const [selected, setSelected] = useState<Record<number, ModifierOption[]>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && product) {
      const seed: Record<number, ModifierOption[]> = {};
      product.modifier_groups.forEach((g) => {
        if (g.required) seed[g.id] = [];
      });
      setSelected(seed);
      setNotes('');
    }
  }, [open, product]);

  if (!product) return null;

  const canAdd = product.modifier_groups
    .filter((g) => g.required)
    .every((g) => (selected[g.id] || []).length > 0);

  const finish = () => {
    const all: ModifierOption[] = [];
    Object.values(selected).forEach((arr) => arr.forEach((m) => all.push(m)));
    onAdd(all, notes);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>{product.name}</DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'border.default' }}>
        {product.modifier_groups.length === 0 && (
          <Typography color="text.secondary">No modifiers. Add to cart?</Typography>
        )}
        {product.modifier_groups.map((g) => (
          <Box key={g.id} sx={{ mb: 2.5 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              {g.name}
              {g.required && (
                <Chip
                  label="required"
                  size="small"
                  color="warning"
                  sx={{ ml: 1, height: 20 }}
                />
              )}
            </Typography>
            {g.multi ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {g.options.map((o) => {
                  const arr = selected[g.id] || [];
                  const on = arr.some((x) => x.id === o.id);
                  return (
                    <Chip
                      key={o.id}
                      label={`${o.name}${o.price_delta ? ` (+$${o.price_delta.toFixed(2)})` : ''}`}
                      onClick={() => {
                        const cur = selected[g.id] || [];
                        setSelected({
                          ...selected,
                          [g.id]: on ? cur.filter((x) => x.id !== o.id) : [...cur, o],
                        });
                      }}
                      color={on ? 'primary' : 'default'}
                      variant={on ? 'filled' : 'outlined'}
                      sx={{ minHeight: 40, fontSize: '0.9rem' }}
                    />
                  );
                })}
              </Box>
            ) : (
              <RadioGroup
                value={(selected[g.id] && selected[g.id][0]?.id) ?? ''}
                onChange={(_, v) => {
                  const opt = g.options.find((o) => String(o.id) === v);
                  if (opt) setSelected({ ...selected, [g.id]: [opt] });
                }}
              >
                {g.options.map((o) => (
                  <FormControlLabel
                    key={o.id}
                    value={o.id}
                    label={`${o.name}${o.price_delta ? ` (+$${o.price_delta.toFixed(2)})` : ''}`}
                    control={<Radio size="small" />}
                    sx={{
                      minHeight: 44,
                      m: 0,
                      border: '1px solid',
                      borderColor: 'border.default',
                      borderRadius: 1.5,
                      px: 1.5,
                      mb: 0.75,
                      '&:hover': { borderColor: 'role.cashier' },
                    }}
                  />
                ))}
              </RadioGroup>
            )}
          </Box>
        ))}
        <Divider sx={{ my: 1.5 }} />
        <TextField
          fullWidth
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} size="large" color="warning" sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          onClick={finish}
          size="large"
          variant="contained"
          color="primary"
          disabled={!canAdd}
          sx={{ borderRadius: 2, minWidth: 140 }}
        >
          Add to cart
        </Button>
      </DialogActions>
    </Dialog>
  );
}
