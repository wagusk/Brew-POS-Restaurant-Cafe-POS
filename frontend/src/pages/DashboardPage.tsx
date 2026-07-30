import { Box, Button, Paper, Typography } from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { hasPermission, type Permission } from '../lib/permissions';

const pages: Array<{ label: string; description: string; path: string; permission: Permission; color: string; icon: typeof DashboardIcon }> = [
  { label: 'Cashier', description: 'Bills and payments', path: '/cashier', permission: 'cashier.view', color: '#2b6cff', icon: PointOfSaleIcon },
  { label: 'Waiter', description: 'Tables and ordering', path: '/waiter', permission: 'waiter.view', color: '#0c8a7a', icon: RestaurantIcon },
  { label: 'Kitchen', description: 'Kitchen display', path: '/kitchen', permission: 'kitchen.view', color: '#d58b00', icon: SoupKitchenIcon },
  { label: 'Bar', description: 'Drinks display', path: '/bar', permission: 'bar.view', color: '#0e9ec7', icon: LocalBarIcon },
  { label: 'Admin', description: 'Management and settings', path: '/admin', permission: 'admin.view', color: '#6b46d3', icon: AdminPanelSettingsIcon },
];

export default function DashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const nav = useNavigate();
  const available = pages.filter((page) => hasPermission(user, page.permission));

  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <DashboardIcon sx={{ fontSize: 34, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>Welcome, {user?.name}</Typography>
          <Typography color="text.secondary">Choose a workspace you are permitted to use.</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
        {available.map((page) => {
          const Icon = page.icon;
          return (
            <Paper key={page.path} sx={{ p: 2, borderRadius: '6px', borderTop: `6px solid ${page.color}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 48, height: 48, bgcolor: page.color, color: 'white', display: 'grid', placeItems: 'center', borderRadius: '4px' }}>
                  <Icon />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{page.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{page.description}</Typography>
                </Box>
              </Box>
              <Button fullWidth variant="contained" onClick={() => nav(page.path)} sx={{ bgcolor: page.color, minHeight: 48, borderRadius: '4px', '&:hover': { bgcolor: page.color, filter: 'brightness(.9)' } }}>
                Open {page.label}
              </Button>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}
