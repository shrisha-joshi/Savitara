/**
 * Block/Unblock User Button Component
 * Allows users to block or unblock another user
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import api from '../../services/api';

/**
 * @typedef {Object} BlockUserButtonProps
 * @property {string} userId - ID of the user to block/unblock
 * @property {string} userName - Name of the user
 * @property {boolean} [isBlocked] - Whether user is currently blocked
 * @property {Function} [onBlockChange] - Callback when block status changes
 * @property {string} [className] - Additional CSS classes
 */

/**
 * BlockUserButton Component
 * @param {BlockUserButtonProps} props
 */
export default function BlockUserButton({ 
  userId, 
  userName, 
  isBlocked: initialBlocked = false, 
  onBlockChange,
  className = '' 
}) {
  const [isBlocked, setIsBlocked] = useState(initialBlocked);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleBlock = async () => {
    setIsLoading(true);
    try {
      const response = await api.post(`/moderation/block/${userId}`, {
        reason: 'User blocked via UI'
      });

      if (response.data.success) {
        setIsBlocked(true);
        setShowConfirm(false);
        
        const isMutual = response.data.data?.is_mutual;
        if (isMutual) {
          toast.success(`${userName} blocked. Mutual block detected.`, {
            position: 'top-right',
            autoClose: 4000
          });
        } else {
          toast.success(`${userName} has been blocked`, {
            position: 'top-right',
            autoClose: 3000
          });
        }

        if (onBlockChange) {
          onBlockChange(true, response.data.data);
        }
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error(
        error.response?.data?.error?.message || 'Failed to block user. Please try again.',
        { position: 'top-right' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async () => {
    setIsLoading(true);
    try {
      const response = await api.delete(`/moderation/block/${userId}`);

      if (response.data.success) {
        setIsBlocked(false);
        toast.success(`${userName} has been unblocked`, {
          position: 'top-right',
          autoClose: 3000
        });

        if (onBlockChange) {
          onBlockChange(false, null);
        }
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error(
        error.response?.data?.error?.message || 'Failed to unblock user. Please try again.',
        { position: 'top-right' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (isBlocked) {
      // Directly unblock without confirmation
      handleUnblock();
    } else {
      // Show confirmation before blocking
      setShowConfirm(true);
    }
  };

  if (showConfirm) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="text-sm text-gray-700 font-medium">
          Block {userName}?
        </div>
        <button
          onClick={handleBlock}
          disabled={isLoading}
          className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md 
                   hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={`Confirm block ${userName}`}
        >
          {isLoading ? 'Blocking...' : 'Yes, Block'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isLoading}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-md 
                   hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Cancel block"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`px-4 py-2 rounded-md font-medium text-sm transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isBlocked 
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400' 
                  : 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                } ${className}`}
      aria-label={isBlocked ? `Unblock ${userName}` : `Block ${userName}`}
      aria-pressed={isBlocked}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{isBlocked ? 'Unblocking...' : 'Blocking...'}</span>
        </div>
      ) : (
        <>
          {isBlocked ? (
            <>
              <svg className="inline-block w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Unblock User
            </>
          ) : (
            <>
              <svg className="inline-block w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Block User
            </>
          )}
        </>
      )}
    </button>
  );
}

BlockUserButton.propTypes = {
  userId: PropTypes.string.isRequired,
  userName: PropTypes.string.isRequired,
  isBlocked: PropTypes.bool,
  onBlockChange: PropTypes.func,
  className: PropTypes.string,
};
