/**
 * User Reports List Component
 * Displays reports created by the current user
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-800',
  action_taken: 'bg-purple-100 text-purple-800'
};

const PRIORITY_COLORS = {
  1: 'text-gray-500',
  2: 'text-blue-500',
  3: 'text-yellow-500',
  4: 'text-orange-500',
  5: 'text-red-500'
};

export default function UserReportsList() {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedReport, setExpandedReport] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0
  });

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/moderation/reports', {
        params: {
          include_reported: false, // Only reports created by user
          limit: pagination.limit,
          offset: pagination.offset
        }
      });

      if (response.data.success) {
        const data = response.data.data;
        setReports(data.reports || []);
       setPagination(prev => ({
          ...prev,
          total: data.total || 0
        }));
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError(err.response?.data?.error?.message || 'Failed to load reports');
      toast.error('Failed to load reports', { position: 'top-right' });
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit, pagination.offset]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const toggleExpand = (reportId) => {
    setExpandedReport(expandedReport === reportId ? null : reportId);
  };

  if (isLoading && reports.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Reports</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <button
          onClick={fetchReports}
          className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Reports</h3>
        <p className="mt-1 text-sm text-gray-500">
          You haven't submitted any reports yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          My Reports {pagination.total > 0 && `(${pagination.total})`}
        </h2>
        <button
          onClick={fetchReports}
          disabled={isLoading}
          className="text-sm text-orange-600 hover:text-orange-700 focus:outline-none 
                   focus:ring-2 focus:ring-orange-500 rounded-md px-2 py-1"
          aria-label="Refresh reports list"
        >
          <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {reports.map((report) => (
            <li key={report.id} className="hover:bg-gray-50 transition-colors">
              <div className="px-4 py-4 sm:px-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Priority Indicator */}
                    <svg 
                      className={`h-5 w-5 ${PRIORITY_COLORS[report.priority] || 'text-gray-500'}`} 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                      aria-label={`Priority ${report.priority}`}
                    >
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>

                    {/* Report Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {report.reason.replaceAll('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Reported {report.reported_user?.name || 'Unknown User'}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[report.status]}`}>
                      {report.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => toggleExpand(report.id)}
                    className="ml-4 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md p-1"
                    aria-label={expandedReport === report.id ? 'Collapse details' : 'Expand details'}
                    aria-expanded={expandedReport === report.id}
                  >
                    <svg 
                      className={`h-5 w-5 transition-transform ${expandedReport === report.id ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Expanded Details */}
                {expandedReport === report.id && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Report ID</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-mono">{report.id}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(report.created_at).toLocaleString()}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Description</dt>
                        <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                          {report.description}
                        </dd>
                      </div>
                      {report.message_id && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Message ID</dt>
                          <dd className="mt-1 text-sm text-gray-900 font-mono">{report.message_id}</dd>
                        </div>
                      )}
                      {report.evidence_urls && report.evidence_urls.length > 0 && (
                        <div className="sm:col-span-2">
                          <dt className="text-sm font-medium text-gray-500">Evidence</dt>
                          <dd className="mt-1 space-y-1">
                            {report.evidence_urls.map((url) => (
                              <a 
                                key={url} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block text-sm text-blue-600 hover:text-blue-800 truncate"
                              >
                                {url}
                              </a>
                            ))}
                          </dd>
                        </div>
                      )}
                      {report.reviewed_by && (
                        <>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Reviewed At</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {new Date(report.reviewed_at).toLocaleString()}
                            </dd>
                          </div>
                          {report.action_taken && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500">Action Taken</dt>
                              <dd className="mt-1 text-sm text-gray-900">
                                {report.action_taken.replaceAll('_', ' ')}
                              </dd>
                            </div>
                          )}
                          {report.admin_notes && (
                            <div className="sm:col-span-2">
                              <dt className="text-sm font-medium text-gray-500">Admin Notes</dt>
                              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-md">
                                {report.admin_notes}
                              </dd>
                            </div>
                          )}
                        </>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pag ination */}
      {pagination.total > pagination.limit && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-700">
            Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="space-x-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
              disabled={pagination.offset === 0}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 
                       hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
              disabled={pagination.offset + pagination.limit >= pagination.total}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 
                       hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
