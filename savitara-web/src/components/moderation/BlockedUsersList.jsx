/**
 * Blocked Users List Component
 * Displays list of users that the current user has blocked
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import BlockUserButton from './BlockUserButton';

/**
 * @typedef {Object} BlockedUser
 * @property {string} id - User ID
 * @property {string} name - User name
 * @property {string} [email] - User email
 * @property {string} [role] - User role
 * @property {string} [profile_picture] - Profile picture URL
 * @property {string} blocked_at - ISO timestamp when blocked
 */

export default function BlockedUsersList() {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0
  });

  const fetchBlockedUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/moderation/blocks', {
        params: {
          limit: pagination.limit,
          offset: pagination.offset
        }
      });

      if (response.data.success) {
        const data = response.data.data;
        setBlockedUsers(data.users || []);
        setPagination(prev => ({
          ...prev,
          total: data.total || 0
        }));
      }
    } catch (err) {
      console.error('Error fetching blocked users:', err);
      setError(err.response?.data?.error?.message || 'Failed to load blocked users');
      toast.error('Failed to load blocked users', { position: 'top-right' });
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit, pagination.offset]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleUnblock = useCallback((userId) => {
    // Remove user from list optimistically
    setBlockedUsers(prev => prev.filter(user => user.id !== userId));
    setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
  }, []);

  const loadMore = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const loadPrevious = () => {
    setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
  };

  if (isLoading && blockedUsers.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error && blockedUsers.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Blocked Users</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <button
          onClick={fetchBlockedUsers}
          className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 
                   focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (blockedUsers.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Blocked Users</h3>
        <p className="mt-1 text-sm text-gray-500">
          You haven't blocked any users yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Blocked Users {pagination.total > 0 && `(${pagination.total})`}
        </h2>
        <button
          onClick={fetchBlockedUsers}
          disabled={isLoading}
          className="text-sm text-orange-600 hover:text-orange-700 focus:outline-none 
                   focus:ring-2 focus:ring-orange-500 rounded-md px-2 py-1
                   disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Refresh blocked users list"
        >
          <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {blockedUsers.map((user) => (
            <li key={user.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  {/* Profile Picture */}
                  <div className="flex-shrink-0">
                    {user.profile_picture ? (
                      <img
                        className="h-12 w-12 rounded-full object-cover"
                        src={user.profile_picture}
                        alt={`${user.name || 'User'}'s profile`}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-xl font-medium text-gray-600">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="ml-4 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.name || 'Unknown User'}
                    </p>
                    {user.email && (
                      <p className="text-sm text-gray-500 truncate">
                        {user.email}
                      </p>
                    )}
                    {user.role && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mt-1">
                        {user.role}
                      </span>
                    )}
                    {user.blocked_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Blocked {new Date(user.blocked_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Unblock Button */}
                <div className="ml-4 flex-shrink-0">
                  <BlockUserButton
                    userId={user.id}
                    userName={user.name || 'User'}
                    isBlocked={true}
                    onBlockChange={(blocked) => {
                      if (!blocked) {
                        handleUnblock(user.id);
                      }
                    }}
                    className="text-sm"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pagination Controls */}
      {pagination.total > pagination.limit && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={loadPrevious}
              disabled={pagination.offset === 0}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white 
                       px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={loadMore}
              disabled={pagination.offset + pagination.limit >= pagination.total}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 
                       bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{pagination.offset + 1}</span>
                {' to '}
                <span className="font-medium">
                  {Math.min(pagination.offset + pagination.limit, pagination.total)}
                </span>
                {' of '}
                <span className="font-medium">{pagination.total}</span>
                {' results'}
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={loadPrevious}
                  disabled={pagination.offset === 0}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 
                           ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={loadMore}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 
                           ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
