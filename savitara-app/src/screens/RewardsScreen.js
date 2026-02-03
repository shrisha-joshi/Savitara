/**
 * RewardsScreen - React Native Component
 * Displays user's gamification rewards: coins, loyalty points, vouchers, referrals, milestones
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Card, Chip, Button, ProgressBar, Divider } from 'react-native-paper';
import api from '../services/api';

const RewardsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, coins, vouchers, referrals, milestones
  const [data, setData] = useState({
    coins: { balance: 0, transactions: [] },
    loyalty: { tier: null, points: 0 },
    vouchers: [],
    referrals: { code: '', stats: { total_referrals: 0, successful_bookings: 0, total_earned: 0 } },
    milestones: [],
    stats: {}
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [coinsRes, loyaltyRes, vouchersRes, referralsRes, milestonesRes, statsRes] = await Promise.all([
        api.get('/gamification/coins/balance'),
        api.get('/gamification/loyalty/status'),
        api.get('/gamification/vouchers/my-vouchers'),
        api.get('/gamification/referrals/my-code'),
        api.get('/gamification/milestones/my-milestones'),
        api.get('/gamification/statistics/overview')
      ]);

      setData({
        coins: coinsRes.data.data || { balance: 0, transactions: [] },
        loyalty: loyaltyRes.data.data || { tier: null, points: 0 },
        vouchers: vouchersRes.data.data?.vouchers || [],
        referrals: referralsRes.data.data || { code: '', stats: {} },
        milestones: milestonesRes.data.data?.milestones || [],
        stats: statsRes.data.data || {}
      });
    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const renderOverview = () => (
    <View>
      {/* Coins Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>🪙 Savitara Coins</Text>
          <Text style={styles.bigNumber}>{data.coins.balance}</Text>
          <Text style={styles.label}>Available Coins</Text>
          <Text style={styles.hint}>10 coins = ₹1 discount</Text>
          <Button
            mode="outlined"
            style={styles.actionButton}
            onPress={() => setActiveTab('coins')}
          >
            View Transactions
          </Button>
        </Card.Content>
      </Card>

      {/* Loyalty Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>⭐ Loyalty Status</Text>
          {data.loyalty.tier ? (
            <>
              <View style={styles.loyaltyBadge}>
                <Text style={styles.tierName}>{data.loyalty.tier.name}</Text>
                <Chip>{data.loyalty.tier.level}</Chip>
              </View>
              <Text style={styles.points}>{data.loyalty.points} points</Text>
              <ProgressBar
                progress={data.loyalty.points / (data.loyalty.tier.min_bookings * 100)}
                color="#FF6B35"
                style={styles.progressBar}
              />
              <Text style={styles.benefit}>
                Cashback: {data.loyalty.tier.cashback_percentage}%
              </Text>
            </>
          ) : (
            <Text style={styles.emptyText}>Complete bookings to unlock loyalty rewards</Text>
          )}
        </Card.Content>
      </Card>

      {/* Vouchers Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>🎟️ My Vouchers</Text>
          <Text style={styles.bigNumber}>{data.vouchers.length}</Text>
          <Text style={styles.label}>Active Vouchers</Text>
          {data.vouchers.length > 0 && (
            <Button
              mode="outlined"
              style={styles.actionButton}
              onPress={() => setActiveTab('vouchers')}
            >
              View All Vouchers
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* Referrals Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>👥 Refer & Earn</Text>
          <View style={styles.referralCode}>
            <Text style={styles.codeLabel}>Your Code:</Text>
            <Chip>{data.referrals.code}</Chip>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data.referrals.stats.total_referrals || 0}</Text>
              <Text style={styles.statLabel}>Referrals</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>₹{data.referrals.stats.total_earned || 0}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
          </View>
          <Button
            mode="contained"
            style={styles.actionButton}
            onPress={() => setActiveTab('referrals')}
          >
            Share & Earn ₹500
          </Button>
        </Card.Content>
      </Card>

      {/* Milestones Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>🏆 Milestones</Text>
          <Text style={styles.bigNumber}>
            {data.milestones.filter(m => m.completed).length}/{data.milestones.length}
          </Text>
          <Text style={styles.label}>Completed</Text>
          <Button
            mode="outlined"
            style={styles.actionButton}
            onPress={() => setActiveTab('milestones')}
          >
            View Milestones
          </Button>
        </Card.Content>
      </Card>
    </View>
  );

  const renderCoins = () => (
    <View>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Coin Balance</Text>
          <Text style={styles.bigNumber}>{data.coins.balance}</Text>
          <Text style={styles.hint}>Use coins for instant discounts on bookings</Text>
        </Card.Content>
      </Card>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {data.coins.transactions && data.coins.transactions.length > 0 ? (
        <FlatList
          data={data.coins.transactions.slice(0, 10)}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <Card style={styles.transactionCard}>
              <Card.Content>
                <View style={styles.transactionRow}>
                  <View>
                    <Text style={styles.transactionAction}>{item.action}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.transactionAmount, item.coins > 0 ? styles.positive : styles.negative]}>
                    {item.coins > 0 ? '+' : ''}{item.coins}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      ) : (
        <Text style={styles.emptyText}>No transactions yet</Text>
      )}
    </View>
  );

  const renderVouchers = () => (
    <View>
      <Text style={styles.sectionTitle}>My Active Vouchers</Text>
      {data.vouchers.length > 0 ? (
        <FlatList
          data={data.vouchers}
          keyExtractor={(item) => item._id || item.code}
          renderItem={({ item }) => (
            <Card style={styles.voucherCard}>
              <Card.Content>
                <View style={styles.voucherHeader}>
                  <Chip>{item.code}</Chip>
                  <Chip style={styles.categoryChip}>{item.category}</Chip>
                </View>
                <Text style={styles.voucherName}>{item.name}</Text>
                <Text style={styles.voucherDescription}>{item.description}</Text>
                <View style={styles.voucherFooter}>
                  <Text style={styles.voucherDiscount}>
                    {item.discount_type === 'percentage'
                      ? `${item.discount_value}% OFF`
                      : `₹${item.discount_value} OFF`}
                  </Text>
                  <Text style={styles.voucherExpiry}>
                    Valid until {new Date(item.valid_until).toLocaleDateString()}
                  </Text>
                </View>
                {item.claimed_at && (
                  <Text style={styles.hint}>
                    Claimed on {new Date(item.claimed_at).toLocaleDateString()}
                  </Text>
                )}
              </Card.Content>
            </Card>
          )}
        />
      ) : (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.emptyText}>No active vouchers</Text>
            <Text style={styles.hint}>Complete bookings and milestones to earn vouchers</Text>
          </Card.Content>
        </Card>
      )}
    </View>
  );

  const renderReferrals = () => (
    <View>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Your Referral Code</Text>
          <View style={styles.codeDisplay}>
            <Text style={styles.code}>{data.referrals.code}</Text>
          </View>
          <Text style={styles.hint}>Share this code with friends and earn ₹500 per referral!</Text>
          <Button mode="contained" style={styles.shareButton}>
            Share Code
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Referral Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.referrals.stats.total_referrals || 0}</Text>
              <Text style={styles.statLabel}>Total Referrals</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.referrals.stats.successful_bookings || 0}</Text>
              <Text style={styles.statLabel}>Successful</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>₹{data.referrals.stats.total_earned || 0}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  const renderMilestones = () => (
    <View>
      <Text style={styles.sectionTitle}>Achievement Milestones</Text>
      {data.milestones.length > 0 ? (
        <FlatList
          data={data.milestones}
          keyExtractor={(item) => item._id || item.name}
          renderItem={({ item }) => (
            <Card style={[styles.milestoneCard, item.completed && styles.completedCard]}>
              <Card.Content>
                <View style={styles.milestoneHeader}>
                  <Text style={styles.milestoneName}>{item.name}</Text>
                  {item.completed && <Text style={styles.completedBadge}>✓ Completed</Text>}
                </View>
                <Text style={styles.milestoneDescription}>{item.description}</Text>
                {!item.completed && (
                  <>
                    <ProgressBar
                      progress={item.progress / item.target}
                      color="#FF6B35"
                      style={styles.progressBar}
                    />
                    <Text style={styles.progressText}>
                      {item.progress}/{item.target}
                    </Text>
                  </>
                )}
                <View style={styles.rewardRow}>
                  <Text style={styles.rewardLabel}>Reward:</Text>
                  <Text style={styles.rewardValue}>{item.reward_coins} coins</Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      ) : (
        <Text style={styles.emptyText}>No milestones available</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading your rewards...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {['overview', 'coins', 'vouchers', 'referrals', 'milestones'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'coins' && renderCoins()}
        {activeTab === 'vouchers' && renderVouchers()}
        {activeTab === 'referrals' && renderReferrals()}
        {activeTab === 'milestones' && renderMilestones()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 4
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#FF6B35'
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  activeTabText: {
    color: '#FF6B35',
    fontWeight: 'bold'
  },
  content: {
    flex: 1,
    padding: 16
  },
  card: {
    marginBottom: 16,
    elevation: 2
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333'
  },
  bigNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginVertical: 8
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4
  },
  actionButton: {
    marginTop: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20
  },
  loyaltyBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  tierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35'
  },
  points: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginVertical: 8
  },
  benefit: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 4
  },
  referralCode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12
  },
  codeLabel: {
    fontSize: 14,
    color: '#666'
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16
  },
  stat: {
    alignItems: 'center'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35'
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  transactionCard: {
    marginBottom: 8,
    elevation: 1
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  transactionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  positive: {
    color: '#4CAF50'
  },
  negative: {
    color: '#F44336'
  },
  voucherCard: {
    marginBottom: 12,
    elevation: 2
  },
  voucherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  categoryChip: {
    backgroundColor: '#E3F2FD'
  },
  voucherName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  voucherDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  voucherFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
  },
  voucherDiscount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35'
  },
  voucherExpiry: {
    fontSize: 12,
    color: '#999'
  },
  codeDisplay: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginVertical: 12
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B35',
    letterSpacing: 2
  },
  shareButton: {
    marginTop: 12
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginHorizontal: 4
  },
  milestoneCard: {
    marginBottom: 12,
    elevation: 1
  },
  completedCard: {
    backgroundColor: '#E8F5E9'
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  milestoneName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  completedBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600'
  },
  milestoneDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'right'
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  rewardLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B35'
  }
});

export default RewardsScreen;
