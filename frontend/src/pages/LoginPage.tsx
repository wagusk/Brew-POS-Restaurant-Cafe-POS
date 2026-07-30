import { useState } from 'react';
import { Box, Button, Typography, Paper, Alert } from '@mui/material';
import CoffeeIcon from '@mui/icons-material/Coffee';
import BackspaceIcon from '@mui/icons-material/Backspace';
import { Auth } from '../lib/api';
import { ROLE_DEFAULTS } from '../lib/permissions';
import { useAppDispatch } from '../store/hooks';
import { setAuth } from '../store/authSlice';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const nav = useNavigate();

  const tap = (n: string) => {
    setError(null);
    if (pin.length >= 6) return;
    setPin((p) => p + n);
  };

  const back = () => setPin((p) => p.slice(0, -1));

  const submit = async () => {
    if (pin.length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const r = await Auth.login(pin);
      const user = { ...r.user, permissions: r.user.permissions ?? ROLE_DEFAULTS[r.user.role] ?? [] };
      dispatch(setAuth({ token: r.access_token, user }));
      nav('/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Login failed');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Color-coded keypad tokens. Each tile is 1/3 of an even grid.
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'enter'];

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'surface.page',
        p: 2,
      }}
    >
      <Paper
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, alignSelf: 'center' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: 'role.cashier',
              color: 'common.white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CoffeeIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Brew-POS
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sign in to your terminal
            </Typography>
          </Box>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            width: '100%',
            py: 2,
            textAlign: 'center',
            letterSpacing: 8,
            fontSize: 28,
            fontWeight: 700,
            minHeight: 64,
            borderRadius: 2,
            borderColor: 'border.default',
            bgcolor: 'surface.muted',
            color: 'text.primary',
          }}
        >
          {pin ? '•'.repeat(pin.length) : '—'}
        </Paper>

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.5,
            width: '100%',
          }}
        >
          {keys.map((k) => {
            if (k === 'clear') {
              return (
                <Button
                  key={k}
                  size="large"
                  variant="outlined"
                  color="warning"
                  onClick={() => setPin('')}
                  sx={{
                    minHeight: 64,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 2,
                    borderColor: 'border.strong',
                  }}
                >
                  Clear
                </Button>
              );
            }
            if (k === 'enter') {
              return (
                <Button
                  key={k}
                  size="large"
                  variant="contained"
                  color="primary"
                  onClick={submit}
                  disabled={loading || pin.length < 3}
                  sx={{ minHeight: 64, fontSize: 16, fontWeight: 700, borderRadius: 2 }}
                >
                  Enter
                </Button>
              );
            }
            return (
              <Button
                key={k}
                size="large"
                variant="outlined"
                onClick={() => tap(k)}
                sx={{
                  minHeight: 64,
                  fontSize: 22,
                  fontWeight: 700,
                  borderRadius: 2,
                  bgcolor: 'surface.paper',
                  borderColor: 'border.strong',
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'surface.muted',
                    borderColor: 'role.cashier',
                  },
                }}
              >
                {k}
              </Button>
            );
          })}
        </Box>

        <Button
          size="medium"
          variant="text"
          color="inherit"
          startIcon={<BackspaceIcon />}
          onClick={back}
          sx={{ minHeight: 40, color: 'text.secondary', alignSelf: 'center' }}
        >
          Backspace
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Demo: admin 9999 · cashier 1111 · waiter 2222 · kitchen 3333
        </Typography>
      </Paper>
    </Box>
  );
}
