/**
 * Admin Report Queue Component - React Native
 * Admin interface to review and moderate user reports
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';

type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reported_user_name?: string;
  reporter_name?: string;
  reason: string;
  description: string;
  status: ReportStatus;
  priority: number;
  message_content?: string;
  evidence_urls?: string[];
  admin_notes?: string;
  admin_action?: string;
  created_at: string;
}

const STATUS_FILTERS = ['all', 'pending', 'reviewing', 'resolved', 'dismissed'];

const STATUS_COLORS = {
  pending: '#F59E0B',
  reviewing: '#3B82F6',
  resolved: '#10B981',
  dismissed: '#6B7280',
};

const PRIORITY_COLORS: { [key: number]: string } = {
  1: '#9CA3AF', 2: '#9CA3AF', 3: '#F59E0B', 4: '#EF4444', 5: '#DC2626',
};

const BAN_DURATIONS = [
  { label: '1 Day', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: 'Permanent', days: null },
];

type ApiError = { response?: { data?: { error?: { message?: string } } } };

/**
 * AdminReportQueue Component
 * Admin-only interface for managing reports
 */
export default function AdminReportQueue() {
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const fetchReports = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const endpoint =
        statusFilter === 'all'
          ? '/moderation/admin/reports/pending'
          : '/moderation/admin/reports';
      
      const response = await api.get(endpoint, {
        params: statusFilter === 'all' ? {} : { status: statusFilter },
      });

      if (response.data.success) {
        const newReports = response.data.data.reports || [];
        // Sort by priority (descending) then created_at (newest first)
        const sorted = newReports.sort((a: Report, b: Report) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setFilteredReports(sorted);
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
  }, [statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [statusFilter, fetchReports]);

  const executeDismiss = async (report: Report) => {
    setActionInProgress(report.id);
    try {
      const response = await api.post(
        `/moderation/admin/reports/${report.id}/dismiss`,
        { reason: 'No violation found' }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Report Dismissed',
          text2: 'Report has been marked as invalid',
          position: 'top',
        });

        setFilteredReports((prev) =>
          prev.map((r) =>
            r.id === report.id ? { ...r, status: 'dismissed' } : r
          )
        );
      }
    } catch (error) {
      console.error('Error dismissing report:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to dismiss report',
        position: 'top',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDismiss = (report: Report) => {
    Alert.alert(
      'Dismiss Report',
      `Are you sure you want to dismiss this report as invalid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: () => { void executeDismiss(report); },
        },
      ]
    );
  };

  const executeIssueWarning = async (report: Report) => {
    setActionInProgress(report.id);
    try {
      const response = await api.post('/moderation/admin/warnings', {
        user_id: report.reported_user_id,
        reason: report.reason,
        severity: 'medium',
        report_id: report.id,
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Warning Issued',
          text2: `Warning sent to ${report.reported_user_name}`,
          position: 'top',
          visibilityTime: 3000,
        });

        // Update report status
        await api.patch(`/moderation/admin/reports/${report.id}/status`, {
          status: 'resolved',
          action_taken: 'warning_issued',
        });

        setFilteredReports((prev) =>
          prev.map((r) =>
            r.id === report.id ? { ...r, status: 'resolved' } : r
          )
        );
      }
    } catch (error) {
      console.error('Error issuing warning:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to issue warning',
        position: 'top',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleIssueWarning = (report: Report) => {
    Alert.alert(
      'Issue Warning',
      `Issue a warning to ${report.reported_user_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue Warning',
          onPress: () => { void executeIssueWarning(report); },
        },
      ]
    );
  };

  const handleBanUser = async (days: number | null) => {
    setShowBanModal(false);
    if (!selectedReport) return;
    
    setActionInProgress(selectedReport.id);

    try {
      const response = await api.post(
        `/moderation/admin/reports/${selectedReport.id}/action`,
        {
          action: 'ban',
          reason: selectedReport.reason,
          duration_days: days,
        }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'User Banned',
          text2: `${selectedReport.reported_user_name} has been banned`,
          position: 'top',
          visibilityTime: 3000,
        });

        setFilteredReports((prev) =>
          prev.map((r) =>
            r.id === selectedReport.id ? { ...r, status: 'resolved' } : r
          )
        );
      }
    } catch (error) {
      console.error('Error banning user:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to ban user',
        position: 'top',
      });
    } finally {
      setActionInProgress(null);
      setSelectedReport(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPriorityStars = (priority: number): string => '⭐'.repeat(priority);

  const renderReport = ({ item }: { item: Report }) => {
    const isExpanded = expandedReportId === item.id;
    const isProcessing = actionInProgress === item.id;

    return (
      <View style={styles.reportCard}>
        <TouchableOpacity
          onPress={() => setExpandedReportId(isExpanded ? null : item.id)}
          activeOpacity={0.7}
          disabled={isProcessing}
        >
          <View style={styles.reportHeader}>
            <View style={styles.reportHeaderLeft}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
              <Text style={[styles.priorityStars, { color: PRIORITY_COLORS[item.priority] }]}>
                {getPriorityStars(item.priority)}
              </Text>
            </View>
            <Text style={styles.reportDate}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.reportInfo}>
            <Text style={styles.reasonBadge}>{item.reason.replace('_', ' ')}</Text>
            <Text style={styles.reportedInfo}>
              Reporter: <Text style={styles.boldText}>{item.reporter_name}</Text> →{' '}
              <Text style={styles.boldText}>{item.reported_user_name}</Text>
            </Text>
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
              <Text style={styles.detailLabel}>Full Description:</Text>
              <Text style={styles.detailText}>{item.description}</Text>
            </View>

            {!!item.message_content && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Reported Message:</Text>
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{item.message_content}</Text>
                </View>
              </View>
            )}

            {item.evidence_urls && item.evidence_urls.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Evidence:</Text>
                {item.evidence_urls.map((url, index) => (
                  <Text key={url} style={styles.evidenceUrl} numberOfLines={1}>
                    🔗 {url}
                  </Text>
                ))}
              </View>
            )}

            {item.status === 'pending' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.dismissButton]}
                  onPress={() => handleDismiss(item)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#6B7280" size="small" />
                  ) : (
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.warningButton]}
                  onPress={() => handleIssueWarning(item)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.warningButtonText}>Issue Warning</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.banButton]}
                  onPress={() => {
                    setSelectedReport(item);
                    setShowBanModal(true);
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.banButtonText}>Ban User</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    const filterLabel = statusFilter === 'all' ? '' : statusFilter;
    const emptyText = statusFilter === 'pending'
      ? 'No pending reports to review'
      : `No ${filterLabel} reports found`;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>
          {statusFilter === 'pending' ? '🎉' : '📋'}
        </Text>
        <Text style={styles.emptyTitle}>
          {statusFilter === 'pending' ? 'All Clear!' : 'No Reports'}
        </Text>
        <Text style={styles.emptyText}>
          {emptyText}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                statusFilter === item && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === item && styles.filterChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        />
      </View>

      <FlatList
        data={filteredReports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchReports(true)}
            tintColor="#FF6B35"
          />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Ban Duration Modal */}
      <Modal visible={showBanModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBanModal(false)}
        >
          <View style={styles.banModalContainer}>
            <Text style={styles.banModalTitle}>Select Ban Duration</Text>
            {BAN_DURATIONS.map((duration) => (
              <TouchableOpacity
                key={duration.label}
                style={styles.banDurationOption}
                onPress={() => handleBanUser(duration.days)}
              >
                <Text style={styles.banDurationText}>{duration.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.banModalCancel}
              onPress={() => setShowBanModal(false)}
            >
              <Text style={styles.banModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
  },
  filterChipActive: {
    backgroundColor: '#FF6B35',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
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
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priorityStars: {
    fontSize: 14,
  },
  reportDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  reportInfo: {
    marginBottom: 8,
  },
  reasonBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  reportedInfo: {
    fontSize: 13,
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
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
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
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: '#F3F4F6',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  warningButton: {
    backgroundColor: '#F59E0B',
  },
  warningButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  banButton: {
    backgroundColor: '#DC2626',
  },
  banButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  banModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 20,
    padding: 16,
    width: '80%',
  },
  banModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  banDurationOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  banDurationText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  banModalCancel: {
    paddingVertical: 14,
    marginTop: 8,
  },
  banModalCancelText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
});
