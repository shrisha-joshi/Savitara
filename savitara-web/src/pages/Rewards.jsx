import { useState, useEffect } from 'react'
import { 
  Container, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Grid, 
  Button,
  LinearProgress,
  Chip,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Tooltip,
  alpha
} from '@mui/material'
import { 
  MonetizationOn,
  Stars,
  CardGiftcard,
  LocalOffer,
  Share,
  TrendingUp,
  ContentCopy,
  CheckCircle,
  History,
  EmojiEvents,
  Redeem
} from '@mui/icons-material'
import api from '../services/api'
import Layout from '../components/Layout'

export default function Rewards() {
  const [activeTab, setActiveTab] = useState(0)
  
  // State
  const [coinBalance, setCoinBalance] = useState(0)
  const [pointBalance, setPointBalance] = useState(0)
  const [coinTransactions, setCoinTransactions] = useState([])
  const [pointTransactions, setPointTransactions] = useState([])
  const [coupons, setCoupons] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [referralStats, setReferralStats] = useState(null)
  const [loyaltyTier, setLoyaltyTier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState(null)

  useEffect(() => {
    fetchRewardsData()
  }, [])

  const fetchRewardsData = async () => {
    try {
      setLoading(true)
      const [coins, points, coinTxns, pointTxns, couponsData, vouchersData, referral, loyalty] = await Promise.all([
        api.get('/gamification/coins/balance'),
        api.get('/gamification/points/balance'),
        api.get('/gamification/coins/transactions'),
        api.get('/gamification/points/transactions'),
        api.get('/gamification/coupons'),
        api.get('/gamification/vouchers'),
        api.get('/gamification/referral/stats'),
        api.get('/gamification/loyalty/tier')
      ])

      setCoinBalance(coins.data.balance)
      setPointBalance(points.data.balance)
      setCoinTransactions(coinTxns.data.transactions || [])
      setPointTransactions(pointTxns.data.transactions || [])
      setCoupons(couponsData.data.coupons || [])
      setVouchers(vouchersData.data.vouchers || [])
      setReferralStats(referral.data)
      setLoyaltyTier(loyalty.data)
    } catch (error) {
      console.error('Failed to fetch rewards data:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(type)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const shareReferralCode = () => {
    const shareText = `Join Savitara and get 100 bonus coins! Use my referral code: ${referralStats?.referral_code}`
    const shareUrl = `https://savitara.com/register?ref=${referralStats?.referral_code}`
    
    if (navigator.share) {
      navigator.share({
        title: 'Join Savitara',
        text: shareText,
        url: shareUrl
      })
    } else {
      copyToClipboard(shareUrl, 'referral')
    }
  }

  const getTierColor = (tier) => {
    const colors = {
      'bronze': '#CD7F32',
      'silver': '#C0C0C0',
      'gold': '#FFD700',
      'platinum': '#E5E4E2'
    }
    return colors[tier?.toLowerCase()] || '#CD7F32'
  }

  const getTierProgress = () => {
    if (!loyaltyTier) return 0
    return (loyaltyTier.current_points / loyaltyTier.next_tier_points) * 100
  }

  if (loading) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <LinearProgress />
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        {/* Header */}
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography 
            variant="overline" 
            component="span"
            sx={{ 
              color: 'primary.main',
              fontWeight: 600,
              letterSpacing: 2
            }}
          >
            REWARDS CENTER
          </Typography>
          <Typography 
            variant="h2" 
            component="h1"
            sx={{ 
              mt: 1,
              mb: 2,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Your Rewards Dashboard
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', lineHeight: 1.6 }}>
            Earn coins, unlock exclusive benefits, and get rewarded for your journey!
          </Typography>
        </Box>

        {/* Balance Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Coin Balance */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              color: '#000',
              transition: 'transform 0.3s',
              '&:hover': { transform: 'translateY(-8px)' }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <MonetizationOn sx={{ fontSize: 40, mr: 1 }} />
                  <Typography variant="h6" fontWeight={700}>Coins</Typography>
                </Box>
                <Typography variant="h3" fontWeight={800}>
                  {coinBalance.toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                  1 Coin = ₹1 discount
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Points Balance */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              transition: 'transform 0.3s',
              '&:hover': { transform: 'translateY(-8px)' }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Stars sx={{ fontSize: 40, mr: 1 }} />
                  <Typography variant="h6" fontWeight={700}>Points</Typography>
                </Box>
                <Typography variant="h3" fontWeight={800}>
                  {pointBalance.toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                  Loyalty rewards points
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Vouchers */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: '#fff',
              transition: 'transform 0.3s',
              '&:hover': { transform: 'translateY(-8px)' }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CardGiftcard sx={{ fontSize: 40, mr: 1 }} />
                  <Typography variant="h6" fontWeight={700}>Vouchers</Typography>
                </Box>
                <Typography variant="h3" fontWeight={800}>
                  {vouchers.length}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                  Active vouchers
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Loyalty Tier */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${getTierColor(loyaltyTier?.tier)} 0%, ${alpha(getTierColor(loyaltyTier?.tier), 0.6)} 100%)`,
              color: '#fff',
              transition: 'transform 0.3s',
              '&:hover': { transform: 'translateY(-8px)' }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <EmojiEvents sx={{ fontSize: 40, mr: 1 }} />
                  <Typography variant="h6" fontWeight={700}>Tier</Typography>
                </Box>
                <Typography variant="h3" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
                  {loyaltyTier?.tier || 'Bronze'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                  {loyaltyTier?.next_tier_points - loyaltyTier?.current_points || 0} pts to next tier
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Loyalty Progress */}
        {loyaltyTier && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUp sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight={600}>Loyalty Progress</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {loyaltyTier.current_points.toLocaleString()} / {loyaltyTier.next_tier_points.toLocaleString()} points
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={getTierProgress()} 
                sx={{ 
                  height: 12, 
                  borderRadius: 6,
                  bgcolor: alpha('#000', 0.1),
                  '& .MuiLinearProgress-bar': {
                    background: `linear-gradient(90deg, ${getTierColor(loyaltyTier.tier)} 0%, ${alpha(getTierColor(loyaltyTier.tier), 0.6)} 100%)`,
                    borderRadius: 6
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {Math.round(getTierProgress())}% complete to {loyaltyTier.next_tier} tier
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Referral Program */}
        {referralStats && (
          <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 10%, #764ba2 100%)', color: '#fff' }}>
            <CardContent>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <Share sx={{ mr: 1 }} />
                Refer & Earn 500 Coins!
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1" sx={{ mb: 2, opacity: 0.9 }}>
                    Share your referral code and get rewarded when friends sign up!
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField 
                      value={referralStats.referral_code}
                      fullWidth
                      InputProps={{
                        readOnly: true,
                        sx: { 
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '1.2rem',
                          letterSpacing: 1
                        }
                      }}
                    />
                    <Tooltip title={copiedCode === 'referral' ? 'Copied!' : 'Copy code'}>
                      <IconButton 
                        onClick={() => copyToClipboard(referralStats.referral_code, 'referral')}
                        aria-label="Copy referral code"
                        sx={{ 
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' }
                        }}
                      >
                        {copiedCode === 'referral' ? <CheckCircle /> : <ContentCopy />}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Button 
                    variant="contained" 
                    fullWidth
                    startIcon={<Share />}
                    onClick={shareReferralCode}
                    sx={{ 
                      bgcolor: 'rgba(255, 255, 255, 0.9)',
                      color: '#764ba2',
                      fontWeight: 700,
                      '&:hover': { bgcolor: '#fff' }
                    }}
                  >
                    Share Referral Link
                  </Button>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                    <Box>
                      <Typography variant="h3" fontWeight={800}>{referralStats.total_referrals || 0}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>Total Referrals</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h3" fontWeight={800}>{referralStats.successful_referrals || 0}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>Successful</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h3" fontWeight={800}>{referralStats.coins_earned || 0}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>Coins Earned</Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Coupons, Vouchers, History */}
        <Box sx={{ mb: 4 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            <Tab label={`Coupons (${coupons.length})`} icon={<LocalOffer />} iconPosition="start" />
            <Tab label={`Vouchers (${vouchers.length})`} icon={<CardGiftcard />} iconPosition="start" />
            <Tab label="Coin History" icon={<History />} iconPosition="start" />
            <Tab label="Point History" icon={<History />} iconPosition="start" />
          </Tabs>

          {/* Coupons Tab */}
          {activeTab === 0 && (
            <Grid container spacing={2}>
              {coupons.length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info">No active coupons available. Check back soon for exclusive offers!</Alert>
                </Grid>
              ) : (
                coupons.map((coupon) => {
                  const discountLabel = coupon.discount_type === 'percentage' 
                    ? `${coupon.discount_value}% OFF` 
                    : `₹${coupon.discount_value} OFF`;
                  
                  return (
                  <Grid item xs={12} sm={6} md={4} key={coupon.code}>
                    <Card sx={{ border: '2px dashed', borderColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                          <Chip 
                            label={discountLabel}
                            color="primary"
                            size="small"
                          />
                          <LocalOffer color="primary" />
                        </Box>
                        
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                          {coupon.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {coupon.description}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField 
                            value={coupon.code}
                            size="small"
                            fullWidth
                            InputProps={{
                              readOnly: true,
                              sx: { bgcolor: alpha('#000', 0.05), fontWeight: 700 }
                            }}
                          />
                          <Tooltip title={copiedCode === coupon.code ? 'Copied!' : 'Copy code'}>
                            <IconButton 
                              size="small"
                              onClick={() => copyToClipboard(coupon.code, coupon.code)}
                              aria-label="Copy coupon code"
                            >
                              {copiedCode === coupon.code ? <CheckCircle color="success" /> : <ContentCopy />}
                            </IconButton>
                          </Tooltip>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Valid until {new Date(coupon.valid_until).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  );
                })
              )}
            </Grid>
          )}

          {/* Vouchers Tab */}
          {activeTab === 1 && (
            <Grid container spacing={2}>
              {vouchers.length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info">No vouchers available. Earn more points to unlock exclusive vouchers!</Alert>
                </Grid>
              ) : (
                vouchers.map((voucher) => (
                  <Grid item xs={12} sm={6} md={4} key={voucher.code}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      color: '#fff'
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justify: 'space-between', alignItems: 'start', mb: 2 }}>
                          <Typography variant="h5" fontWeight={800}>
                            ₹{voucher.amount}
                          </Typography>
                          <CardGiftcard />
                        </Box>
                        
                        <Typography variant="body1" fontWeight={600} sx={{ mb: 1 }}>
                          {voucher.title}
                        </Typography>
                        
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', p: 1, borderRadius: 1, mb: 2 }}>
                          <Typography variant="body2" fontWeight={700} sx={{ letterSpacing: 1 }}>
                            {voucher.code}
                          </Typography>
                        </Box>

                        <Button 
                          variant="contained"
                          fullWidth
                          startIcon={<Redeem />}
                          sx={{ 
                            bgcolor: 'rgba(255,255,255,0.9)',
                            color: '#f5576c',
                            fontWeight: 700,
                            '&:hover': { bgcolor: '#fff' }
                          }}
                        >
                          Redeem Now
                        </Button>

                        <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.8 }}>
                          Expires: {new Date(voucher.valid_until).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}

          {/* Coin History Tab */}
          {activeTab === 2 && (
            <Paper sx={{ p: 2 }}>
              {coinTransactions.length === 0 ? (
                <Alert severity="info">No coin transactions yet. Start earning coins by completing actions!</Alert>
              ) : (
                <List>
                  {coinTransactions.map((txn, index) => (
                    <Box key={txn.id}>
                      <ListItem>
                        <ListItemIcon>
                          <MonetizationOn color={txn.type === 'credit' ? 'success' : 'error'} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={txn.description}
                          secondary={new Date(txn.created_at).toLocaleString()}
                        />
                        <Typography 
                          variant="h6" 
                          fontWeight={700}
                          color={txn.type === 'credit' ? 'success.main' : 'error.main'}
                        >
                          {txn.type === 'credit' ? '+' : '-'}{txn.amount}
                        </Typography>
                      </ListItem>
                      {index < coinTransactions.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </Paper>
          )}

          {/* Point History Tab */}
          {activeTab === 3 && (
            <Paper sx={{ p: 2 }}>
              {pointTransactions.length === 0 ? (
                <Alert severity="info">No point transactions yet. Keep using Savitara to earn loyalty points!</Alert>
              ) : (
                <List>
                  {pointTransactions.map((txn, index) => (
                    <Box key={txn.id}>
                      <ListItem>
                        <ListItemIcon>
                          <Stars color={txn.type === 'credit' ? 'success' : 'error'} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={txn.description}
                          secondary={new Date(txn.created_at).toLocaleString()}
                        />
                        <Typography 
                          variant="h6" 
                          fontWeight={700}
                          color={txn.type === 'credit' ? 'success.main' : 'error.main'}
                        >
                          {txn.type === 'credit' ? '+' : '-'}{txn.amount}
                        </Typography>
                      </ListItem>
                      {index < pointTransactions.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </Paper>
          )}
        </Box>

        {/* How to Earn Section */}
        <Card sx={{ bgcolor: alpha('#FF6B35', 0.05) }}>
          <CardContent>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <MonetizationOn sx={{ mr: 1, color: 'primary.main' }} />
              How to Earn Coins & Points
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="h6" fontWeight={600} color="primary" sx={{ mb: 1 }}>
                    +100 Coins
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Complete your profile and sign up
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="h6" fontWeight={600} color="primary" sx={{ mb: 1 }}>
                    +200 Coins
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Make your first booking
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="h6" fontWeight={600} color="primary" sx={{ mb: 1 }}>
                    +50 Coins
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Complete a booking successfully
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="h6" fontWeight={600} color="primary" sx={{ mb: 1 }}>
                    +30 Coins
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Submit a review after booking
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="h6" fontWeight={600} color="primary" sx={{ mb: 1 }}>
                    +500 Coins
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Successful referral (friend signs up)
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Box>
                  <Typography variant="h6" fontWeight={600} color="primary" sx={{ mb: 1 }}>
                    +10 Coins
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Daily login bonus
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Container>
    </Layout>
  )
}
