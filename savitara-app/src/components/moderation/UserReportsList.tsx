/**
 * User Reports List Component - React Native
 * Displays reports created by the user and reports about the user
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';

const STATUS_COLORS = {
  pending: '#F59E0B',
  reviewing: '#3B82F6',
  resolved: '#10B981',
  dismissed: '#6B7280',
};

const PRIORITY_COLORS = {
  1: '#9CA3AF',
  2: '#9CA3AF',
  3: '#F59E0B',
  4: '#EF4444',
  5: '#DC2626',
};

type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reporter_name?: string;
  reported_user_name?: string;
  reason: string;
  description: string;
  status: ReportStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  message_content?: string;
  evidence_urls?: string[];
  admin_notes?: string;
  admin_action?: string;
  created_at: string;
  reviewed_at?: string;
}

interface UserReportsListProps {
  userId?: string;
}

/**
 * UserReportsList Component
 */
export default function UserReportsList({ userId }: Readonly<UserReportsListProps>) {
  const [activeTab, setActiveTab] = useState<'created' | 'received'>('created');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 20;

  const fetchReports = useCallback(
    async (page = 0, refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else if (page === 0) {
        setIsLoading(true);
      }

      try {
        const offset = page * ITEMS_PER_PAGE;
        const params = {
          limit: ITEMS_PER_PAGE,
          offset,
          include_reported: activeTab === 'received',
        };

        const response = await api.get('/moderation/reports', { params });

        if (response.data.success) {
          const newReports = response.data.data.reports || [];
          const hasMoreData = response.data.data.has_more || false;

          if (page === 0 || refresh) {
            setReports(newReports);
          } else {
            setReports((prev) => [...prev, ...newReports]);
          }

          setHasMore(hasMoreData);
          setCurrentPage(page);
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load reports',
          position: 'top',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    setReports([]);
    setCurrentPage(0);
    setHasMore(true);
    setExpandedReportId(null);
    fetchReports(0);
  }, [activeTab, fetchReports]);

  const handleRefresh = useCallback(() => {
    fetchReports(0, true);
  }, [fetchReports]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchReports(currentPage + 1);
    }
  }, [isLoading, hasMore, currentPage, fetchReports]);

  const toggleExpanded = (reportId: string) => {
    setExpandedReportId((current) => (current === reportId ? null : reportId));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getPriorityStars = (priority: number): string => {
    return '⭐'.repeat(priority);
  };

  const renderReport = ({ item }: { item: Report }) => {
    const isExpanded = expandedReportId === item.id;

    return (
      <View style={styles.reportCard}>
        <TouchableOpacity
          onPress={() => toggleExpanded(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.reportHeader}>
            <View style={styles.reportHeaderLeft}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
              <View style={styles.priorityContainer}>
                <Text style={[styles.priorityStars, { color: PRIORITY_COLORS[item.priority] }]}>
                  {getPriorityStars(item.priority)}
                </Text>
              </View>
            </View>
            <Text style={styles.reportDate}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.reportInfo}>
            <Text style={styles.reasonBadge}>{item.reason.replace('_', ' ')}</Text>
            {activeTab === 'created' ? (
              <Text style={styles.reportedUser}>
                Reported: <Text style={styles.boldText}>{item.reported_user_name}</Text>
              </Text>
            ) : (
              <Text style={styles.reportedUser}>
                Reported by: <Text style={styles.boldText}>{item.reporter_name}</Text>
              </Text>
            )}
          </View>

          {!isExpanded && (
            <Text style={styles.descriptionPreview} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Description:</Text>
              <Text style={styles.detailText}>{item.description}</Text>
            </View>

            {Boolean(item.message_content) && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Reported Message:</Text>
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{item.message_content}</Text>
                </View>
              </View>
            )}

            {item.evidence_urls && item.evidence_urls.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Evidence URLs:</Text>
                {item.evidence_urls.map((url: string, index: number) => (
                  <Text key={`evidence-${item.id}-${index}`} style={styles.evidenceUrl} numberOfLines={1}>
                    🔗 {url}
                  </Text>
                ))}
              </View>
            )}

            {Boolean(item.admin_action) && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Admin Action:</Text>
                <Text style={styles.detailText}>{item.admin_action}</Text>
              </View>
            )}

            {Boolean(item.admin_notes) && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Admin Notes:</Text>
                <Text style={styles.detailText}>{item.admin_notes}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📋</Text>
      <Text style={styles.emptyTitle}>No Reports</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'created'
          ? "You haven't submitted any reports yet"
          : 'No one has reported you'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isLoading || currentPage === 0) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#FF6B35" />
      </View>
    );
  };

  if (isLoading && currentPage === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'created' && styles.tabActive]}
          onPress={() => setActiveTab('created')}
        >
          <Text style={[styles.tabText, activeTab === 'created' && styles.tabTextActive]}>
            Reports Created
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            Reports About Me
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FF6B35"
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#FF6B35',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priorityContainer: {
    flexDirection: 'row',
  },
  priorityStars: {
    fontSize: 14,
  },
  reportDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reportInfo: {
    marginBottom: 8,
  },
  reasonBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  reportedUser: {
    fontSize: 14,
    color: '#6B7280',
  },
  boldText: {
    fontWeight: '600',
    color: '#111827',
  },
  descriptionPreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailSection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  messageBox: {
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
    fontStyle: 'italic',
  },
  evidenceUrl: {
    fontSize: 13,
    color: '#3B82F6',
    marginVertical: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
