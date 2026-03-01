/**
 * PricingDisplay - React Native Component
 * Displays booking pricing with gamification features (coins, coupons, vouchers)
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView
} from 'react-native';
import { Card, Chip, Button, Divider } from 'react-native-paper';
import api from '../services/api';

const PricingDisplay = ({ baseAmount, serviceId, onPriceCalculated }) => {
  const [loading, setLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [useCoins, setUseCoins] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [pricing, setPricing] = useState({
    base_amount: baseAmount,
    discount_amount: 0,
    coins_discount: 0,
    coins_used: 0,
    final_amount: baseAmount,
    coins_earned: 0
  });
  const [showCoupons, setShowCoupons] = useState(false);

  useEffect(() => {
    fetchCoinBalance();
    fetchAvailableCoupons();
  }, []);

  useEffect(() => {
    calculatePricing();
  }, [baseAmount, selectedCoupon, useCoins, serviceId]);

  const fetchCoinBalance = async () => {
    try {
      const response = await api.get('/gamification/coins/balance');
      if (response.data.success) {
        setCoinBalance(response.data.data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch coin balance:', error);
    }
  };

  const fetchAvailableCoupons = async () => {
    try {
      const response = await api.get('/gamification/coupons/available');
      if (response.data.success) {
        setAvailableCoupons(response.data.data.coupons || []);
      }
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
    }
  };

  const calculatePricing = async () => {
    if (!baseAmount || baseAmount <= 0) return;

    setLoading(true);
    try {
      const response = await api.post('/gamification/calculate-price', {
        base_amount: baseAmount,
        service_id: serviceId,
        coupon_code: selectedCoupon?.code,
        use_coins: useCoins
      });

      if (response.data.success) {
        const pricingData = response.data.data;
        setPricing(pricingData);
        if (onPriceCalculated) {
          onPriceCalculated(pricingData);
        }
      }
    } catch (error) {
      console.error('Failed to calculate pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setLoading(true);
    try {
      const response = await api.post('/gamification/coupons/validate', {
        code: couponCode.toUpperCase(),
        booking_amount: baseAmount,
        service_id: serviceId
      });

      if (response.data.success && response.data.data.valid) {
        const coupon = response.data.data.coupon;
        setSelectedCoupon(coupon);
        setCouponCode('');
        setShowCoupons(false);
      } else {
        Alert.alert('Invalid Coupon', response.data.data.message || 'Invalid coupon code');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to apply coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCoupon = (coupon) => {
    setSelectedCoupon(coupon);
    setCouponCode('');
    setShowCoupons(false);
  };

  const maxCoinsUsable = Math.min(
    Math.floor(coinBalance / 10) * 10,
    Math.floor(baseAmount * 0.3)
  );

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Pricing Details</Text>

          {/* Base Amount */}
          <View style={styles.row}>
            <Text style={styles.label}>Base Amount:</Text>
            <Text style={styles.value}>₹{baseAmount}</Text>
          </View>

          <Divider style={styles.divider} />

          {/* Coupon Section */}
          <TouchableOpacity
            style={styles.section}
            onPress={() => setShowCoupons(!showCoupons)}
          >
            <Text style={styles.sectionTitle}>Apply Coupon Code</Text>
            {selectedCoupon && (
              <Chip style={styles.chip} onClose={() => setSelectedCoupon(null)}>
                {selectedCoupon.code}
              </Chip>
            )}
          </TouchableOpacity>

          {showCoupons && (
            <View style={styles.couponInput}>
              <TextInput
                style={styles.input}
                placeholder="Enter coupon code"
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
              />
              <Button
                mode="contained"
                onPress={handleApplyCoupon}
                loading={loading}
                disabled={loading || !couponCode.trim()}
              >
                Apply
              </Button>
            </View>
          )}

          {showCoupons && availableCoupons.length > 0 && (
            <View style={styles.couponList}>
              <Text style={styles.subtitle}>Available Coupons:</Text>
              {availableCoupons.slice(0, 3).map((coupon) => (
                <TouchableOpacity
                  key={coupon.code}
                  style={styles.couponCard}
                  onPress={() => handleSelectCoupon(coupon)}
                >
                  <View style={styles.couponHeader}>
                    <Chip style={styles.couponCode}>{coupon.code}</Chip>
                    <Text style={styles.couponDiscount}>
                      {coupon.discount_type === 'percentage'
                        ? `${coupon.discount_value}% OFF`
                        : `₹${coupon.discount_value} OFF`}
                    </Text>
                  </View>
                  <Text style={styles.couponName}>{coupon.name}</Text>
                  <Text style={styles.couponDescription}>{coupon.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedCoupon && pricing.discount_amount > 0 && (
            <View style={styles.row}>
              <Text style={styles.discountLabel}>Coupon Discount:</Text>
              <Text style={styles.discountValue}>-₹{pricing.discount_amount}</Text>
            </View>
          )}

          <Divider style={styles.divider} />

          {/* Coins Section */}
          <View style={styles.section}>
            <View style={styles.coinsHeader}>
              <Text style={styles.sectionTitle}>Use Savitara Coins</Text>
              <Text style={styles.coinBalance}>
                Balance: {coinBalance} coins
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.coinToggle, useCoins && styles.coinToggleActive]}
              onPress={() => setUseCoins(!useCoins)}
              disabled={coinBalance < 10 || maxCoinsUsable === 0}
            >
              <Text style={[styles.coinToggleText, useCoins && styles.coinToggleTextActive]}>
                {useCoins ? '✓ Using Coins' : 'Use Coins for Discount'}
              </Text>
              {useCoins && maxCoinsUsable > 0 && (
                <Text style={styles.coinUsage}>
                  Using up to {maxCoinsUsable} coins
                </Text>
              )}
            </TouchableOpacity>

            {coinBalance < 10 && (
              <Text style={styles.hint}>
                Minimum 10 coins required to redeem
              </Text>
            )}
          </View>

          {useCoins && pricing.coins_used > 0 && (
            <View style={styles.row}>
              <Text style={styles.discountLabel}>Coins Discount:</Text>
              <Text style={styles.discountValue}>-₹{pricing.coins_discount}</Text>
            </View>
          )}

          <Divider style={styles.divider} />

          {/* Final Amount */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Final Amount:</Text>
            <Text style={styles.totalValue}>₹{pricing.final_amount}</Text>
          </View>

          {/* Coins to Earn */}
          {pricing.coins_earned > 0 && (
            <View style={styles.earnBadge}>
              <Text style={styles.earnText}>
                🪙 You'll earn {pricing.coins_earned} coins on this booking!
              </Text>
            </View>
          )}

          {/* Savings Display */}
          {(pricing.discount_amount > 0 || pricing.coins_discount > 0) && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>
                You're saving ₹{pricing.discount_amount + pricing.coins_discount}!
              </Text>
            </View>
          )}

          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.loaderText}>Calculating best price...</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  card: {
    marginVertical: 8
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  label: {
    fontSize: 14,
    color: '#666'
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  discountLabel: {
    fontSize: 14,
    color: '#4CAF50'
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35'
  },
  section: {
    marginVertical: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333'
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 8,
    color: '#666'
  },
  chip: {
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  couponInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14
  },
  couponList: {
    marginTop: 12
  },
  couponCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    backgroundColor: '#fff'
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  couponCode: {
    backgroundColor: '#FFF3E0'
  },
  couponDiscount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B35'
  },
  couponName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333'
  },
  couponDescription: {
    fontSize: 12,
    color: '#666'
  },
  coinsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  coinBalance: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600'
  },
  coinToggle: {
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  coinToggleActive: {
    backgroundColor: '#FF6B35'
  },
  coinToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35'
  },
  coinToggleTextActive: {
    color: '#fff'
  },
  coinUsage: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6
  },
  earnBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12
  },
  earnText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
    textAlign: 'center'
  },
  savingsBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 8
  },
  savingsText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center'
  },
  loader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8
  },
  loaderText: {
    fontSize: 12,
    color: '#666'
  },
  divider: {
    marginVertical: 12
  }
});

export default PricingDisplay;
