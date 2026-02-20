/**
 * Admin Report Queue Component
 * For admins to review and moderate user reports
 */
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import api from '../../services/api';

/**
 * @typedef {Object} AdminReportQueueProps
 * @property {string} [filter] - Status filter (all/pending/reviewing/resolved)
 */

const REPORT_STATUSES = [
  { value: 'all', label: 'All Reports' },
  { value: 'pending', label: 'Pending', color: 'orange' },
  { value: 'reviewing', label: 'Under Review', color: 'blue' },
  { value: 'resolved', label: 'Resolved', color: 'green' },
  { value: 'dismissed', label: 'Dismissed', color: 'gray' },
  { value: 'action_taken', label: 'Action Taken', color: 'red' }
];

const PRIORITY_LABELS = {
  1: { label: 'Low', color: 'text-gray-600' },
  2: { label: 'Medium', color: 'text-yellow-600' },
  3: { label: 'High', color: 'text-orange-600' },
  4: { label: 'Urgent', color: 'text-red-600' },
  5: { label: 'Critical', color: 'text-red-700 font-bold' }
};

/**
 * AdminReportQueue Component
 * @param {AdminReportQueueProps} props
 */
export default function AdminReportQueue({ filter: initialFilter = 'pending' }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for admin actions
  const [adminNotes, setAdminNotes] = useState('');
  const [actionType, setActionType] = useState('warning'); // warning, ban, dismiss
  const [warningLevel, setWarningLevel] = useState(1);
  const [banDuration, setBanDuration] = useState(7);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = statusFilter === 'all' 
        ? '/moderation/admin/reports'
        : `/moderation/admin/reports?status=${statusFilter}`;
      
      const response = await api.get(endpoint);
      const fetchedReports = response.data.reports || [];
      
      // Sort by priority (high to low) and then by date (newest first)
      const sorted = fetchedReports.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      setReports(sorted);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (!showDetailModal) return undefined;
    const handler = (e) => { if (e.key === 'Escape') closeDetailModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showDetailModal]);

  const openReportDetail = (report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
    setAdminNotes('');
    setActionType('warning');
    setWarningLevel(1);
    setBanDuration(7);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedReport(null);
  };

  const handleUpdateStatus = async (reportId, newStatus) => {
    setActionLoading(true);
    try {
      await api.patch(`/moderation/admin/reports/${reportId}/status`, {
        status: newStatus,
        admin_notes: adminNotes || undefined
      });

      toast.success('Report status updated');
      fetchReports();
      closeDetailModal();
    } catch (error) {
      console.error('Error updating report status:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissReport = async (reportId) => {
    if (!adminNotes.trim()) {
      toast.error('Please provide a reason for dismissing this report');
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/moderation/admin/reports/${reportId}/dismiss`, {
        reason: adminNotes
      });

      toast.success('Report dismissed');
      fetchReports();
      closeDetailModal();
    } catch (error) {
      console.error('Error dismissing report:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to dismiss report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTakeAction = async (reportId) => {
    if (!adminNotes.trim()) {
      toast.error('Please provide details about the action taken');
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/moderation/admin/reports/${reportId}/action`, {
        action_type: actionType,
        details: adminNotes,
        warning_level: actionType === 'warning' ? warningLevel : undefined,
        ban_duration_days: actionType === 'ban' ? banDuration : undefined
      });

      toast.success(`Action taken: ${actionType}`);
      fetchReports();
      closeDetailModal();
    } catch (error) {
      console.error('Error taking action:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to take action');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityDisplay = (priority) => {
    const config = PRIORITY_LABELS[priority] || PRIORITY_LABELS[1];
    return (
      <span className={`font-medium ${config.color}`}>
        {'⭐'.repeat(priority)} {config.label}
      </span>
    );
  };

  const getStatusColor = (status) => {
    const statusConfig = REPORT_STATUSES.find(s => s.value === status);
    return statusConfig?.color || 'gray';
  };

  const renderReportList = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      );
    }
    if (reports.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No reports</h3>
          <p className="mt-1 text-sm text-gray-500">
            No reports match the selected filter.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {reports.map((report) => (
          <button
            key={report.id}
            type="button"
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer w-full text-left"
            onClick={() => openReportDetail(report)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openReportDetail(report); }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center space-x-3 mb-2">
                    {getPriorityDisplay(report.priority)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                   bg-${getStatusColor(report.status)}-100 
                                   text-${getStatusColor(report.status)}-800`}>
                      {report.status.replaceAll('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {/* Reported User */}
                  <h3 className="text-lg font-semibold text-gray-900">
                    Report against {report.reported_user?.name || 'Unknown User'}
                  </h3>

                  {/* Reason */}
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Reason:</span>{' '}
                    {report.reason.replaceAll('_', ' ').replaceAll(/\b\w/g, l => l.toUpperCase())}
                  </p>

                  {/* Description Preview */}
                  <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                    {report.description}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                    <span>Reported by {report.reporter?.name || 'Unknown'}</span>
                    <span>•</span>
                    <span>{formatDate(report.created_at)}</span>
                    {report.message_id && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600">Message Report</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Indicator */}
                <svg
                  className="h-5 w-5 text-gray-400 ml-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and moderate user reports
        </p>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {REPORT_STATUSES.map((status) => (
          <button
            key={status.value}
            onClick={() => setStatusFilter(status.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                      ${statusFilter === status.value
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {renderReportList()}

      {/* Detail Modal */}
      {showDetailModal && selectedReport && (
        <dialog
          className="fixed inset-0 z-50 bg-transparent m-0 p-0 max-w-none w-full h-full border-0"
          open
          aria-labelledby="report-detail-title"
        >
          <button
            type="button"
            className="fixed inset-0 w-full h-full bg-black bg-opacity-50 cursor-default border-0 p-0"
            onClick={closeDetailModal}
            aria-label="Close modal"
          />
          <div className="flex items-center justify-center min-h-full p-4">
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 id="report-detail-title" className="text-xl font-bold text-gray-900">Report Details</h2>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Report Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Report Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    {getPriorityDisplay(selectedReport.priority)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                   bg-${getStatusColor(selectedReport.status)}-100 
                                   text-${getStatusColor(selectedReport.status)}-800`}>
                      {selectedReport.status.replaceAll('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reported User:</span>
                    <span className="font-medium">{selectedReport.reported_user?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reporter:</span>
                    <span className="font-medium">{selectedReport.reporter?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{formatDate(selectedReport.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Reason & Description */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Reason</h3>
                <p className="text-sm text-gray-700 bg-yellow-50 rounded p-3">
                  {selectedReport.reason.replaceAll('_', ' ').replaceAll(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-wrap">
                  {selectedReport.description}
                </p>
              </div>

              {/* Evidence */}
              {selectedReport.evidence_urls && selectedReport.evidence_urls.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Evidence</h3>
                  <ul className="space-y-1">
                    {selectedReport.evidence_urls.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Admin Action Form */}
              {selectedReport.status === 'pending' || selectedReport.status === 'reviewing' ? (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Take Action</h3>

                  {/* Action Type */}
                  <div className="mb-4">
                    <p className="block text-sm font-medium text-gray-700 mb-2">
                      Action Type
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActionType('warning')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                  ${actionType === 'warning'
                                    ? 'bg-yellow-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        Warning
                      </button>
                      <button
                        onClick={() => setActionType('ban')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                  ${actionType === 'ban'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        Ban User
                      </button>
                      <button
                        onClick={() => setActionType('dismiss')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                  ${actionType === 'dismiss'
                                    ? 'bg-gray-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {/* Conditional Inputs */}
                  {actionType === 'warning' && (
                    <div className="mb-4">
                      <label htmlFor="warning-level-select" className="block text-sm font-medium text-gray-700 mb-2">
                        Warning Level (1-3)
                      </label>
                      <select
                        id="warning-level-select"
                        value={warningLevel}
                        onChange={(e) => setWarningLevel(Number.parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value={1}>Level 1 - Minor Violation</option>
                        <option value={2}>Level 2 - Serious Violation</option>
                        <option value={3}>Level 3 - Final Warning</option>
                      </select>
                    </div>
                  )}

                  {actionType === 'ban' && (
                    <div className="mb-4">
                      <label htmlFor="ban-duration-select" className="block text-sm font-medium text-gray-700 mb-2">
                        Ban Duration (days)
                      </label>
                      <select
                        id="ban-duration-select"
                        value={banDuration}
                        onChange={(e) => setBanDuration(Number.parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value={1}>1 Day</option>
                        <option value={7}>7 Days</option>
                        <option value={30}>30 Days</option>
                        <option value={365}>1 Year</option>
                      </select>
                    </div>
                  )}

                  {/* Admin Notes */}
                  <div className="mb-4">
                    <label htmlFor="admin-notes-input" className="block text-sm font-medium text-gray-700 mb-2">
                      Notes / Reason {actionType !== 'dismiss' && '(optional)'}
                    </label>
                    <textarea
                      id="admin-notes-input"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Explain your decision..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {actionType === 'dismiss' ? (
                      <button
                        onClick={() => handleDismissReport(selectedReport.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? 'Processing...' : 'Dismiss Report'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTakeAction(selectedReport.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? 'Processing...' : 'Take Action'}
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, 'reviewing')}
                      disabled={actionLoading || selectedReport.status === 'reviewing'}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mark as Reviewing
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Admin Resolution</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Status:</span> {selectedReport.status.replaceAll('_', ' ').toUpperCase()}
                    </p>
                    {selectedReport.admin_notes && (
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-medium">Notes:</span> {selectedReport.admin_notes}
                      </p>
                    )}
                    {selectedReport.reviewed_at && (
                      <p className="text-sm text-gray-500 mt-2">
                        Reviewed on {formatDate(selectedReport.reviewed_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

AdminReportQueue.propTypes = {
  filter: PropTypes.string,
};
