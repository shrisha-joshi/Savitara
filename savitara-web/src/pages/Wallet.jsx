import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  AccountBalanceWallet,
  Add,
  Refresh,
  AccountBalance,
  CardGiftcard,
  MonetizationOn,
  CallMade,
  CallReceived,
  Undo
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder';

export default function Wallet() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Wallet data
  const [balance, setBalance] = useState({ main_balance: 0, bonus_balance: 0, total_balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [earnings, setEarnings] = useState(null);

  // Dialogs
  const [addMoneyDialog, setAddMoneyDialog] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);

  // Form states
  const [addAmount, setAddAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankDetails, setBankDetails] = useState({
    account_holder: '',
    account_number: '',
    ifsc_code: '',
    bank_name: ''
  });

  const fetchWalletData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch balance and transactions in parallel
      const [balanceRes, transactionsRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions?limit=50')
      ]);

      if (balanceRes.data.success) {
        setBalance(balanceRes.data.data);
      }

      if (transactionsRes.data.success) {
        setTransactions(transactionsRes.data.data.transactions || []);
      }

      // Fetch earnings if Acharya
      if (user?.role === 'acharya') {
        const earningsRes = await api.get('/wallet/earnings');
        if (earningsRes.data.success) {
          setEarnings(earningsRes.data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, [user?.role]); // Added dependencies

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById('razorpay-checkout')) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.id = 'razorpay-checkout';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleAddMoney = async () => {
    try {
      const amount = Number.parseFloat(addAmount);
      if (!amount || amount < 10) {
        setError('Minimum amount is ₹10');
        return;
      }

      setLoading(true);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError('Failed to load payment gateway');
        return;
      }

      // Create Razorpay order
      const orderRes = await api.post('/payments/initiate', {
        amount,
        currency: 'INR',
        receipt: `wallet_${Date.now()}`
      });

      if (!orderRes.data.success) {
        setError('Failed to create payment order');
        return;
      }

      const options = {
        key: RAZORPAY_KEY,
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'Savitara Wallet',
        description: 'Add money to wallet',
        order_id: orderRes.data.data.order_id,
        handler: async function (response) {
          try {
            // Add money to wallet
            const addMoneyRes = await api.post('/wallet/add-money', {
              amount,
              payment_id: response.razorpay_payment_id
            });

            if (addMoneyRes.data.success) {
              setSuccess(`₹${amount} added to wallet successfully!`);
              setAddMoneyDialog(false);
              setAddAmount('');
              fetchWalletData();
            }
          } catch (err) {
            console.error('Wallet update after payment failed:', err);
            setError('Payment completed but wallet update failed');
          }
        },
        prefill: {
          name: user?.full_name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#FF6B35'
        }
      };

      const rzp = new globalThis.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setError(response.error.description || 'Payment failed');
      });
      rzp.open();
    } catch (error) {
      console.error('Add money error:', error);
      setError(error.response?.data?.message || 'Failed to add money');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      const amount = Number.parseFloat(withdrawAmount);
      if (!amount || amount < 100) {
        setError('Minimum withdrawal amount is ₹100');
        return;
      }

      if (amount > balance.main_balance) {
        setError('Insufficient balance');
        return;
      }

      setLoading(true);

      const response = await api.post('/wallet/withdraw', {
        amount,
        ...bankDetails
      });

      if (response.data.success) {
        setSuccess('Withdrawal request submitted successfully!');
        setWithdrawDialog(false);
        setWithdrawAmount('');
        setBankDetails({
          account_holder: '',
          account_number: '',
          ifsc_code: '',
          bank_name: ''
        });
        fetchWalletData();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to request withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'credit':
      case 'earning':
      case 'referral':
      case 'bonus':
        return <CallReceived color="success" />;
      case 'debit':
      case 'payment':
      case 'withdrawal':
        return <CallMade color="error" />;
      case 'refund':
        return <Undo color="info" />;
      default:
        return <MonetizationOn />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'credit':
      case 'earning':
      case 'referral':
      case 'bonus':
        return 'success.main';
      case 'debit':
      case 'payment':
      case 'withdrawal':
        return 'error.main';
      case 'refund':
        return 'info.main';
      default:
        return 'text.primary';
    }
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return 'success';
    if (status === 'pending') return 'warning';
    return 'default';
  };

  if (loading && !balance) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              My Wallet
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {user?.role === 'acharya' ? 'Manage your earnings and withdrawals' : 'Manage your wallet and payments'}
            </Typography>
          </Box>
          <IconButton onClick={fetchWalletData} disabled={loading} aria-label="Refresh wallet balance">
            <Refresh />
          </IconButton>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {/* Balance Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Main Balance */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalanceWallet sx={{ fontSize: 40, mr: 1 }} />
                <Typography variant="h6" fontWeight={700}>Main Balance</Typography>
              </Box>
              <Typography variant="h3" fontWeight={800}>
                ₹{balance.main_balance?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                Available for withdrawal
              </Typography>
            </Paper>
          </Grid>

          {/* Bonus Balance */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: '#fff',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CardGiftcard sx={{ fontSize: 40, mr: 1 }} />
                <Typography variant="h6" fontWeight={700}>Bonus Balance</Typography>
              </Box>
              <Typography variant="h3" fontWeight={800}>
                ₹{balance.bonus_balance?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                Used first in payments
              </Typography>
            </Paper>
          </Grid>

          {/* Total Balance */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                color: '#000',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MonetizationOn sx={{ fontSize: 40, mr: 1 }} />
                <Typography variant="h6" fontWeight={700}>Total Balance</Typography>
              </Box>
              <Typography variant="h3" fontWeight={800}>
                ₹{balance.total_balance?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                Main + Bonus
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {user?.role === 'grihasta' && (
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => setAddMoneyDialog(true)}
              sx={{
                bgcolor: '#4caf50',
                '&:hover': { bgcolor: '#45a049' }
              }}
            >
              Add Money
            </Button>
          )}
          
          {user?.role === 'acharya' && (
            <Button
              variant="contained"
              size="large"
              startIcon={<AccountBalance />}
              onClick={() => setWithdrawDialog(true)}
              sx={{
                bgcolor: '#2196f3',
                '&:hover': { bgcolor: '#1976d2' }
              }}
            >
              Withdraw to Bank
            </Button>
          )}
        </Box>

        {/* Statistics (Acharya Only) */}
        {user?.role === 'acharya' && earnings && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Total Earned
                </Typography>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  ₹{earnings.total_earned?.toLocaleString() || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Total Withdrawn
                </Typography>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  ₹{earnings.total_withdrawn?.toLocaleString() || 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Available Balance
                </Typography>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  ₹{earnings.current_balance?.toLocaleString() || 0}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Transactions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Transaction History
          </Typography>

          {transactions.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No transactions yet
            </Alert>
          ) : (
            <TableContainer sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn._id || txn.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getTransactionIcon(txn.type)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {txn.description || txn.type}
                        </Typography>
                        {txn.reference_id && (
                          <Typography variant="caption" color="text.secondary">
                            Ref: {txn.reference_id}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(txn.created_at).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          color={getTransactionColor(txn.type)}
                        >
                          {['credit', 'earning', 'referral', 'bonus', 'refund'].includes(txn.type) ? '+' : '-'}
                          ₹{txn.amount?.toLocaleString() || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={txn.status || 'completed'}
                          size="small"
                          color={getStatusColor(txn.status)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* Add Money Dialog */}
        <Dialog open={addMoneyDialog} onClose={() => setAddMoneyDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Add Money to Wallet</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              type="number"
              label="Amount (₹)"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>
              }}
              helperText="Minimum ₹10"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddMoneyDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAddMoney}
              disabled={loading || !addAmount || Number.parseFloat(addAmount) < 10}
              startIcon={loading ? <CircularProgress size={16} /> : <Add />}
            >
              Proceed to Pay
            </Button>
          </DialogActions>
        </Dialog>

        {/* Withdraw Dialog */}
        <Dialog open={withdrawDialog} onClose={() => setWithdrawDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Withdraw to Bank Account</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              type="number"
              label="Amount (₹)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>
              }}
              helperText={`Minimum ₹100 | Available: ₹${balance.main_balance?.toLocaleString()}`}
              sx={{ mt: 2, mb: 2 }}
            />
            <TextField
              fullWidth
              label="Account Holder Name"
              value={bankDetails.account_holder}
              onChange={(e) => setBankDetails({ ...bankDetails, account_holder: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Account Number"
              value={bankDetails.account_number}
              onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="IFSC Code"
              value={bankDetails.ifsc_code}
              onChange={(e) => setBankDetails({ ...bankDetails, ifsc_code: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Bank Name"
              value={bankDetails.bank_name}
              onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWithdrawDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleWithdraw}
              disabled={
                loading ||
                !withdrawAmount ||
                Number.parseFloat(withdrawAmount) < 100 ||
                !bankDetails.account_holder ||
                !bankDetails.account_number ||
                !bankDetails.ifsc_code ||
                !bankDetails.bank_name
              }
              startIcon={loading ? <CircularProgress size={16} /> : <AccountBalance />}
            >
              Request Withdrawal
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}
