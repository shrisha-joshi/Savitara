/**
 * TrustScoreScreen.js
 * Display Acharya trust score breakdown with improvement tips
 * 
 * Features:
 * - 5-component trust score visualization
 * - Verification badge display
 * - Actionable improvement tips
 * - Guarantee & dispute stats
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const TrustScoreScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [trustScore, setTrustScore] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const acharyaId = route.params?.acharyaId || null;

  useEffect(() => {
    fetchTrustScore();
  }, []);

  const fetchTrustScore = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/trust/acharyas/${acharyaId}/trust-score`);
      setTrustScore(response.data);
    } catch (error) {
      console.error('Failed to fetch trust score:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load trust score',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrustScore();
    setRefreshing(false);
  };

  const getVerificationBadgeColor = (badge) => {
    switch (badge) {
      case 'PREMIUM_VERIFIED':
        return '#FFD700'; // Gold
      case 'SAVITARA_VERIFIED':
        return '#4CAF50'; // Green
      default:
        return '#9E9E9E'; // Gray
    }
  };

  const getVerificationBadgeIcon = (badge) => {
    switch (badge) {
      case 'PREMIUM_VERIFIED':
        return 'shield-checkmark';
      case 'SAVITARA_VERIFIED':
        return 'checkmark-circle';
      default:
        return 'shield-outline';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getImprovementTips = () => {
    if (!trustScore) return [];

    const tips = [];

    // Verification tips
    if (trustScore.verification_score < 20) {
      tips.push({
        icon: 'shield-checkmark',
        title: 'Complete KYC Verification',
        description: 'Submit your documents to get Savitara Verified badge',
        action: 'Start KYC',
        priority: 'high',
      });
    } else if (trustScore.verification_score < 30) {
      tips.push({
        icon: 'trophy',
        title: 'Upgrade to Premium',
        description: 'Complete 50 bookings with 4.5+ rating for Premium badge',
        action: 'View Progress',
        priority: 'medium',
      });
    }

    // Completion rate tips
    if (trustScore.completion_score < 20) {
      tips.push({
        icon: 'checkbox-marked-circle',
        title: 'Improve Completion Rate',
        description: 'Complete all accepted bookings. Current rate: ' + 
          Math.round((trustScore.completion_score / 25) * 100) + '%',
        action: 'View Tips',
        priority: 'high',
      });
    }

    // Response time tips
    if (trustScore.response_time_score < 12) {
      tips.push({
        icon: 'clock-fast',
        title: 'Respond Faster',
        description: 'Accept bookings within 1 hour to maximize this score',
        action: 'Enable Notifications',
        priority: 'medium',
      });
    }

    // Rebooking rate tips
    if (trustScore.rebooking_score < 15) {
      tips.push({
        icon: 'account-heart',
        title: 'Build Loyalty',
        description: 'Provide excellent service to encourage repeat bookings',
        action: 'Best Practices',
        priority: 'medium',
      });
    }

    // Review quality tips
    if (trustScore.review_quality_score < 8) {
      tips.push({
        icon: 'star',
        title: 'Improve Ratings',
        description: 'Maintain 4.5+ star rating to maximize this score',
        action: 'Quality Guide',
        priority: 'high',
      });
    }

    return tips.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading Trust Score...</Text>
      </View>
    );
  }

  if (!trustScore) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
        <Text style={styles.errorText}>Failed to load trust score</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTrustScore}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const improvementTips = getImprovementTips();

  return (
    <ScrollView style={styles.container} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
    }>
      {/* Header Card */}
      <LinearGradient
        colors={['#FF6B35', '#F7931E']}
        style={styles.headerCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>{Math.round(trustScore.composite_score)}</Text>
          <Text style={styles.scoreLabel}>TRUST SCORE</Text>
        </View>
        
        <View style={styles.badgeContainer}>
          <Ionicons
            name={getVerificationBadgeIcon(trustScore.verification_badge)}
            size={32}
            color={getVerificationBadgeColor(trustScore.verification_badge)}
          />
          <Text style={styles.badgeText}>
            {trustScore.verification_badge.replace('_', ' ')}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{trustScore.total_guarantees_honored}</Text>
            <Text style={styles.statLabel}>Guarantees Honored</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{trustScore.total_disputes_resolved}</Text>
            <Text style={styles.statLabel}>Disputes Resolved</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Component Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        
        <ScoreComponent
          icon="shield-checkmark"
          title="Verification"
          score={trustScore.verification_score}
          maxScore={30}
          color="#9C27B0"
        />
        
        <ScoreComponent
          icon="checkbox-marked-circle"
          title="Completion Rate"
          score={trustScore.completion_score}
          maxScore={25}
          color="#2196F3"
        />
        
        <ScoreComponent
          icon="clock-fast"
          title="Response Time"
          score={trustScore.response_time_score}
          maxScore={15}
          color="#FF9800"
        />
        
        <ScoreComponent
          icon="account-heart"
          title="Rebooking Rate"
          score={trustScore.rebooking_score}
          maxScore={20}
          color="#4CAF50"
        />
        
        <ScoreComponent
          icon="star"
          title="Review Quality"
          score={trustScore.review_quality_score}
          maxScore={10}
          color="#FFC107"
        />
      </View>

      {/* Improvement Tips */}
      {improvementTips.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Improvement Tips</Text>
          
          {improvementTips.map((tip, index) => (
            <TipCard key={index} tip={tip} />
          ))}
        </View>
      )}

      {/* Trust Benefits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Benefits of High Trust Score</Text>
        
        <BenefitItem
          icon="trending-up"
          title="Higher Search Ranking"
          description="Appear at the top of search results"
        />
        
        <BenefitItem
          icon="cash"
          title="More Bookings"
          description="Grihastas prefer verified, trusted Acharyas"
        />
        
        <BenefitItem
          icon="trophy"
          title="Premium Features"
          description="Unlock exclusive features at 80+ score"
        />
        
        <BenefitItem
          icon="medal"
          title="Featured Listings"
          description="Get featured in 'Top Acharyas' section"
        />
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

// Sub-components

const ScoreComponent = ({ icon, title, score, maxScore, color }) => {
  const percentage = (score / maxScore) * 100;
  
  return (
    <View style={styles.scoreComponentCard}>
      <View style={styles.componentHeader}>
        <View style={styles.componentTitleRow}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
          <Text style={styles.componentTitle}>{title}</Text>
        </View>
        <Text style={styles.componentScore}>
          {score.toFixed(1)}/{maxScore}
        </Text>
      </View>
      
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${percentage}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
        <Text style={styles.percentageText}>{Math.round(percentage)}%</Text>
      </View>
    </View>
  );
};

const TipCard = ({ tip }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      default:
        return '#4CAF50';
    }
  };

  return (
    <View style={styles.tipCard}>
      <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(tip.priority) }]} />
      
      <View style={styles.tipContent}>
        <View style={styles.tipHeader}>
          <MaterialCommunityIcons name={tip.icon} size={24} color="#FF6B35" />
          <Text style={styles.tipTitle}>{tip.title}</Text>
        </View>
        
        <Text style={styles.tipDescription}>{tip.description}</Text>
        
        <TouchableOpacity style={styles.tipAction}>
          <Text style={styles.tipActionText}>{tip.action}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FF6B35" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const BenefitItem = ({ icon, title, description }) => (
  <View style={styles.benefitItem}>
    <View style={styles.benefitIconContainer}>
      <Ionicons name={icon} size={24} color="#FF6B35" />
    </View>
    <View style={styles.benefitTextContainer}>
      <Text style={styles.benefitTitle}>{title}</Text>
      <Text style={styles.benefitDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 4,
    borderColor: '#FFF',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
    letterSpacing: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  scoreComponentCard: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  componentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  componentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  componentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  componentScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 45,
    textAlign: 'right',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  priorityIndicator: {
    width: 4,
  },
  tipContent: {
    flex: 1,
    padding: 16,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  tipDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  tipAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
    marginRight: 4,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  bottomPadding: {
    height: 32,
  },
});

export default TrustScoreScreen;
