/**
 * Report Dialog Component
 * Allows users to report violations (users or messages)
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import api from '../../services/api';

/**
 * @typedef {Object} ReportDialogProps
 * @property {boolean} isOpen - Whether dialog is open
 * @property {Function} onClose - Callback to close dialog
 * @property {string} reportedUserId - ID of user being reported
 * @property {string} reportedUserName - Name of user being reported
 * @property {string} [messageId] - Optional message ID if reporting a specific message
 * @property {Function} [onReportSubmitted] - Callback after successful report
 */

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam', description: 'Unwanted promotional or repetitive content' },
  { value: 'harassment', label: 'Harassment', description: 'Threatening, bullying, or intimidating behavior' },
  { value: 'inappropriate', label: 'Inappropriate Content', description: 'Offensive or adult content' },
  { value: 'violence', label: 'Violence', description: 'Violent or graphic content' },
  { value: 'hate_speech', label: 'Hate Speech', description: 'Discriminatory or hateful language' },
  { value: 'scam', label: 'Scam', description: 'Fraudulent or deceptive activity' },
  { value: 'fake', label: 'Fake Account', description: 'Impersonation or fake identity' },
  { value: 'other', label: 'Other', description: 'Other violations not listed above' }
];

/**
 * ReportDialog Component
 * @param {ReportDialogProps} props
 */
export default function ReportDialog({ 
  isOpen, 
  onClose, 
  reportedUserId, 
  reportedUserName,
  messageId,
  onReportSubmitted 
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evidenceUrls, setEvidenceUrls] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedReason) {
      toast.error('Please select a reason for reporting', { position: 'top-right' });
      return;
    }

    if (!description.trim()) {
      toast.error('Please provide a description', { position: 'top-right' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse evidence URLs (comma-separated)
      const evidenceArray = evidenceUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const response = await api.post('/moderation/reports', {
        reported_user_id: reportedUserId,
        reason: selectedReason,
        description: description.trim(),
        message_id: messageId || null,
        evidence_urls: evidenceArray.length > 0 ? evidenceArray : null,
        context: {
          source: 'web_app',
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      if (response.data.success) {
        toast.success(
          'Report submitted successfully. Our team will review it soon.',
          { 
            position: 'top-right',
            autoClose: 5000
          }
        );

        // Reset form
        setSelectedReason('');
        setDescription('');
        setEvidenceUrls('');

        // Call callback if provided
        if (onReportSubmitted) {
          onReportSubmitted(response.data.data);
        }

        // Close dialog
        onClose();
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error(
        error.response?.data?.error?.message || 'Failed to submit report. Please try again.',
        { position: 'top-right' }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setDescription('');
      setEvidenceUrls('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      className="fixed inset-0 z-50 overflow-y-auto bg-transparent max-w-none w-full h-full m-0 p-0"
      aria-labelledby="report-dialog-title"
      open
    >
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 w-full h-full bg-black bg-opacity-50 cursor-default border-0 p-0"
        onClick={handleClose}
        aria-label="Close dialog"
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 id="report-dialog-title" className="text-xl font-semibold text-gray-900">
              Report {messageId ? 'Message' : 'User'}
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 
                       focus:ring-orange-500 rounded-full p-1 disabled:opacity-50"
              aria-label="Close dialog"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            {/* Warning Notice */}
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Report {reportedUserName}
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    False reports may result in action against your account. 
                    Please only report genuine violations of our community guidelines.
                  </p>
                </div>
              </div>
            </div>

            {/* Reason Selection */}
            <div className="mb-6">
              <p className="block text-sm font-medium text-gray-700 mb-3">
                Reason for Reporting <span className="text-red-500">*</span>
              </p>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    aria-label={reason.label}
                    className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors
                              ${selectedReason === reason.value 
                                ? 'border-orange-500 bg-orange-50' 
                                : 'border-gray-300 hover:border-gray-400'}`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.value}
                      checked={selectedReason === reason.value}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500"
                      disabled={isSubmitting}
                    />
                    <span className="ml-3 flex-1">
                      <span className="block text-sm font-medium text-gray-900">{reason.label}</span>
                      <span className="block text-sm text-gray-500">{reason.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-orange-500 focus:border-orange-500
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Please provide specific details about the violation..."
                maxLength={2000}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {description.length}/2000 characters
              </p>
            </div>

            {/* Evidence URLs (Optional) */}
            <div className="mb-6">
              <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-2">
                Evidence Links (Optional)
              </label>
              <input
                type="text"
                id="evidence"
                value={evidenceUrls}
                onChange={(e) => setEvidenceUrls(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-orange-500 focus:border-orange-500
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="https://example.com/screenshot1.png, https://example.com/screenshot2.png"
              />
              <p className="mt-1 text-xs text-gray-500">
                Comma-separated URLs to screenshots or other evidence
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 
                         rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 
                         focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedReason || !description.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent 
                         rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                         focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
}

ReportDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  reportedUserId: PropTypes.string.isRequired,
  reportedUserName: PropTypes.string.isRequired,
  messageId: PropTypes.string,
  onReportSubmitted: PropTypes.func,
};
