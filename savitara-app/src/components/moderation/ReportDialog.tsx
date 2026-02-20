/**
 * Report Dialog Component - React Native
 * Modal dialog for reporting users or messages for violations
 */
import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or Bullying', icon: '😠' },
  { value: 'spam', label: 'Spam or Unwanted Content', icon: '📧' },
  { value: 'inappropriate_content', label: 'Inappropriate Content', icon: '⚠️' },
  { value: 'hate_speech', label: 'Hate Speech', icon: '🚫' },
  { value: 'violence', label: 'Violence or Threats', icon: '⚔️' },
  { value: 'fake_profile', label: 'Fake Profile', icon: '🎭' },
  { value: 'scam', label: 'Scam or Fraud', icon: '💸' },
  { value: 'other', label: 'Other', icon: '❓' },
];

interface ReportDialogProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  messageId?: string;
  messageContent?: string;
  onReportSubmitted?: () => void;
}

type ApiError = { response?: { data?: { error?: { message?: string } } } };

/**
 * ReportDialog Component
 */
export default function ReportDialog({
  visible,
  onClose,
  reportedUserId,
  reportedUserName,
  messageId,
  messageContent,
  onReportSubmitted,
}: Readonly<ReportDialogProps>) {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setSelectedReason('');
    setDescription('');
    setEvidenceUrls('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedReason) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please select a reason for reporting',
        position: 'top',
      });
      return;
    }

    if (!description.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please provide a description',
        position: 'top',
      });
      return;
    }

    if (description.trim().length < 10) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Description must be at least 10 characters',
        position: 'top',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        reported_user_id: reportedUserId,
        reason: selectedReason,
        description: description.trim(),
      };

      if (messageId) {
        payload.message_id = messageId;
      }

      if (evidenceUrls.trim()) {
        const urls = evidenceUrls
          .split('\n')
          .map((url) => url.trim())
          .filter((url) => url.length > 0);
        if (urls.length > 0) {
          payload.evidence_urls = urls;
        }
      }

      const response = await api.post('/moderation/reports', payload);

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Report Submitted',
          text2: 'Thank you for helping keep our community safe. We will review your report.',
          position: 'top',
          visibilityTime: 4000,
        });

        if (onReportSubmitted) {
          onReportSubmitted();
        }

        handleClose();
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2:
          (error as ApiError).response?.data?.error?.message ||
          'Failed to submit report. Please try again.',
        position: 'top',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Report User</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close report dialog"
              accessibilityRole="button"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.reportingText}>
              Reporting: <Text style={styles.reportingName}>{reportedUserName}</Text>
            </Text>

            {Boolean(messageId && messageContent) && (
              <View style={styles.messagePreview}>
                <Text style={styles.messageLabel}>Message:</Text>
                <Text style={styles.messageText} numberOfLines={3}>
                  {messageContent}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Reason for Report *</Text>
            <View style={styles.reasonGrid}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={[
                    styles.reasonButton,
                    selectedReason === reason.value && styles.reasonButtonSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.value)}
                  accessibilityLabel={`Report for ${reason.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedReason === reason.value }}
                >
                  <Text style={styles.reasonIcon}>{reason.icon}</Text>
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reason.value && styles.reasonLabelSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Description *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Please provide details about why you're reporting this user..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>

            <Text style={styles.sectionTitle}>Evidence URLs (Optional)</Text>
            <Text style={styles.helperText}>
              Enter screenshot or evidence URLs, one per line
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="https://example.com/screenshot1.png"
              placeholderTextColor="#9CA3AF"
              value={evidenceUrls}
              onChangeText={setEvidenceUrls}
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                ℹ️ Reports are reviewed by our moderation team. Making false reports may
                result in action against your account.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6B7280',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reportingText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  reportingName: {
    fontWeight: '600',
    color: '#111827',
  },
  messagePreview: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 8,
  },
  reasonButton: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  reasonButtonSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FF6B35',
  },
  reasonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  reasonLabel: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  reasonLabelSelected: {
    color: '#111827',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  disclaimer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
