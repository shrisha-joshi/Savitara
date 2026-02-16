/**
 * Gamification Dashboard Component
 * Shows coins, points, vouchers, loyalty tier, referrals
 */
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  LinearProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import StarsIcon from '@mui/icons-material/Stars';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import api from '../services/api';
import './GamificationDashboard.css';

const GamificationDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [vouchers, setVouchers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGamificationData();
  }, []);

  const fetchGamificationData = async () => {
    try {
      setLoading(true);

      // Fetch overview
      const overviewRes = await api.get('/stats/overview');
      setOverview(overviewRes.data.data || overviewRes.data);

      // Fetch vouchers
      const vouchersRes = await api.get('/vouchers/my');
      setVouchers(vouchersRes.data.vouchers || vouchersRes.data.data || []);

      // Fetch available coupons
      const couponsRes = await api.get('/coupons/available');
      setCoupons(couponsRes.data.coupons || couponsRes.data.data || []);

      // Fetch coin transactions
      const transactionsRes = await api.get('/coins/transactions?limit=20');
      setTransactions(transactionsRes.data.transactions || transactionsRes.data.data || []);

      // Fetch milestones
      const milestonesRes = await api.get('/milestones/my');
      setMilestones(milestonesRes.data.milestones || milestonesRes.data.data || []);

    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    if (overview?.referral?.code) {
      navigator.clipboard.writeText(overview.referral.link);
      // Show success toast
      alert('Referral link copied!');
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      'bronze': '#CD7F32',
      'silver': '#C0C0C0',
      'gold': '#FFD700',
      'platinum': '#E5E4E2',
      'rising_star': '#4CAF50',
      'established': '#2196F3',
      'master': '#9C27B0',
      'guru': '#FF9800'
    };
    return colors[tier] || '#757575';
  };

  if (loading) {
    return (
      <Box className="gamification-loading">
        <LinearProgress />
        <Typography>Loading your rewards...</Typography>
      </Box>
    );
  }

  return (
    <Box className="gamification-dashboard">
      <Typography variant="h4" className="dashboard-title">
        🎮 Rewards & Benefits
      </Typography>

      {/* Overview Cards */}
      <Grid container spacing={3} className="overview-cards">
        {/* Coins Card */}
        <Grid item xs={12} md={3}>
          <Card className="reward-card coins-card">
            <CardContent>
              <Box className="card-header">
                <MonetizationOnIcon className="card-icon" />
                <Typography variant="h6">Savitara Coins</Typography>
              </Box>
              <Typography variant="h3" className="card-value">
                {overview?.coins?.balance || 0}
              </Typography>
              <Typography variant="body2" className="card-subtext">
                ≈ ₹{(overview?.coins?.balance * 0.1).toFixed(2)}
              </Typography>
              <Typography variant="caption" className="card-earned">
                Total Earned: {overview?.coins?.total_earned || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Points & Tier Card */}
        <Grid item xs={12} md={3}>
          <Card className="reward-card loyalty-card">
            <CardContent>
              <Box className="card-header">
                <StarsIcon className="card-icon" />
                <Typography variant="h6">Loyalty Points</Typography>
              </Box>
              <Typography variant="h3" className="card-value">
                {overview?.loyalty?.points || 0}
              </Typography>
              <Chip
                label={overview?.loyalty?.tier.toUpperCase()}
                size="small"
                style={{ 
                  background: getTierColor(overview?.loyalty?.tier),
                  color: 'white',
                  fontWeight: 'bold'
                }}
              />
              <Typography variant="caption" className="card-benefit">
                {overview?.loyalty?.discount}% Discount on all bookings
              </Typography>
              {overview?.loyalty?.next_tier && (
                <Box className="progress-section">
                  <Typography variant="caption">
                    {overview.loyalty.points_to_next} points to {overview.loyalty.next_tier}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(overview.loyalty.points / (overview.loyalty.points + overview.loyalty.points_to_next)) * 100}
                    className="tier-progress"
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Vouchers Card */}
        <Grid item xs={12} md={3}>
          <Card className="reward-card vouchers-card">
            <CardContent>
              <Box className="card-header">
                <CardGiftcardIcon className="card-icon" />
                <Typography variant="h6">My Vouchers</Typography>
              </Box>
              <Typography variant="h3" className="card-value">
                {overview?.vouchers?.active || 0}
              </Typography>
              <Typography variant="body2" className="card-subtext">
                Active vouchers ready to use
              </Typography>
              <Button
                size="small"
                variant="outlined"
                className="view-btn"
                onClick={() => setActiveTab(1)}
              >
                View All
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Referrals Card */}
        <Grid item xs={12} md={3}>
          <Card className="reward-card referral-card">
            <CardContent>
              <Box className="card-header">
                <ShareIcon className="card-icon" />
                <Typography variant="h6">Refer & Earn</Typography>
              </Box>
              <Typography variant="body1" className="referral-code">
                {overview?.referral?.code}
              </Typography>
              <Button
                size="small"
                variant="contained"
                className="share-btn"
                startIcon={<ContentCopyIcon />}
                onClick={copyReferralCode}
              >
                Copy Link
              </Button>
              <Typography variant="caption" className="referral-reward">
                Earn 500 coins per referral!
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Section */}
      <Box className="tabs-section">
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Coin History" />
          <Tab label="My Vouchers" />
          <Tab label="Available Coupons" />
          <Tab label="Milestones" />
        </Tabs>

        {/* Tab 0: Coin History */}
        {activeTab === 0 && (
          <Box className="tab-content">
            <Typography variant="h6" className="section-title">
              Recent Transactions
            </Typography>
            <List className="transactions-list">
              {transactions.map((txn, index) => (
                <ListItem key={index} className="transaction-item">
                  <ListItemIcon>
                    {txn.amount > 0 ? (
                      <MonetizationOnIcon className="earn-icon" />
                    ) : (
                      <MonetizationOnIcon className="spend-icon" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={txn.description}
                    secondary={new Date(txn.created_at).toLocaleDateString()}
                  />
                  <Typography
                    className={txn.amount > 0 ? 'amount-positive' : 'amount-negative'}
                  >
                    {txn.amount > 0 ? '+' : ''}{txn.amount}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Tab 1: My Vouchers */}
        {activeTab === 1 && (
          <Box className="tab-content">
            <Typography variant="h6" className="section-title">
              Active Vouchers
            </Typography>
            <Grid container spacing={2}>
              {vouchers.map((voucher, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card className="voucher-card">
                    <CardContent>
                      <Box className="voucher-header">
                        <LocalOfferIcon className="voucher-icon" />
                        <Chip label={voucher.code} className="voucher-code" />
                      </Box>
                      <Typography variant="h6">{voucher.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {voucher.description}
                      </Typography>
                      <Box className="voucher-details">
                        <Typography variant="subtitle2" className="discount-value">
                          {voucher.discount_type === 'percentage' ? `${voucher.discount_value}% OFF` : `₹${voucher.discount_value} OFF`}
                        </Typography>
                        <Typography variant="caption">
                          Valid until: {new Date(voucher.expires_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Tab 2: Available Coupons */}
        {activeTab === 2 && (
          <Box className="tab-content">
            <Typography variant="h6" className="section-title">
              Coupon Codes You Can Use
            </Typography>
            <Grid container spacing={2}>
              {coupons.map((coupon, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card className="coupon-card">
                    <CardContent>
                      <Chip label={coupon.code} className="coupon-code" />
                      <Typography variant="h6">{coupon.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {coupon.description}
                      </Typography>
                      <Box className="coupon-details">
                        <Typography variant="subtitle2" className="discount-value">
                          {coupon.discount_type === 'percentage' ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} OFF`}
                        </Typography>
                        {coupon.min_booking_amount > 0 && (
                          <Typography variant="caption">
                            Min. booking: ₹{coupon.min_booking_amount}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        className="apply-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(coupon.code);
                          alert('Coupon code copied!');
                        }}
                      >
                        Copy Code
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Tab 3: Milestones */}
        {activeTab === 3 && (
          <Box className="tab-content">
            <Typography variant="h6" className="section-title">
              Your Achievements
            </Typography>
            <List className="milestones-list">
              {milestones.map((milestone, index) => (
                <ListItem key={index} className="milestone-item">
                  <ListItemIcon>
                    <EmojiEventsIcon className="trophy-icon" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${milestone.milestone_type.toUpperCase()}: ${milestone.milestone_count}`}
                    secondary={`Achieved on ${new Date(milestone.achieved_at).toLocaleDateString()}`}
                  />
                  <Box className="milestone-rewards">
                    {milestone.rewards.map((reward, idx) => (
                      <Chip
                        key={idx}
                        label={`${reward.amount} ${reward.type}`}
                        size="small"
                        className="reward-chip"
                      />
                    ))}
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default GamificationDashboard;
