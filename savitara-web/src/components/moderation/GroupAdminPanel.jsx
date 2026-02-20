/**
 * Group Admin Panel Component  
 * Provides moderation controls for group chat admins and owners
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import api from '../../services/api';

/**
 * @typedef {Object} GroupAdminPanelProps
 * @property {string} conversationId - ID of the conversation/group
 * @property {string} currentUserId - ID of current user
 * @property {string} currentUserRole - Role of current user (owner/admin/member)
 * @property {Array} members - List of conversation members
 * @property {Function} [onMemberUpdate] - Callback when member status changes
 */

const MUTE_DURATIONS = [
  { label: '1 Hour', hours: 1 },
  { label: '8 Hours', hours: 8 },
  { label: '24 Hours', hours: 24 },
  { label: '7 Days', hours: 168 },
  { label: 'Indefinite', hours: null }
];

const BAN_DURATIONS = [
  { label: '1 Day', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: 'Permanent', days: null }
];

/**
 * GroupAdminPanel Component
 * @param {GroupAdminPanelProps} props
 */
export default function GroupAdminPanel({ 
  conversationId, 
  currentUserId, 
  currentUserRole,
  members = [],
  onMemberUpdate 
}) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('members'); // members | audit | settings

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
  const isOwner = currentUserRole === 'owner';

  // Can't perform admin actions if not admin
  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Admin Access Required</h3>
        <p className="mt-1 text-sm text-gray-500">
          You need to be an admin or owner to access this panel.
        </p>
      </div>
    );
  }

  const handleMuteMember = async (userId, hours) => {
    setIsLoading(true);
    try {
      const response = await api.post(`/groups/${conversationId}/mute`, {
        user_id: userId,
        duration_hours: hours
      });

      if (response.data.success) {
        toast.success(
          hours ? `Member muted for ${hours} hours` : 'Member muted indefinitely',
          { position: 'top-right' }
        );
        if (onMemberUpdate) onMemberUpdate();
        setShowActionMenu(false);
        setSelectedMember(null);
      }
    } catch (error) {
      console.error('Error muting member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to mute member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnmuteMember = async (userId) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({ user_id: userId }).toString();
      const response = await api.post(`/groups/${conversationId}/unmute?${queryParams}`);

      if (response.data.success) {
        toast.success('Member unmuted successfully');
        if (onMemberUpdate) onMemberUpdate();
        setShowActionMenu(false);
        setSelectedMember(null);
      }
    } catch (error) {
      console.error('Error unmuting member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to unmute member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBanMember = async (userId, days) => {
    const banSuffix = days ? ` for ${days} days` : ' permanently';
    if (!globalThis.confirm(`Are you sure you want to ban this member${banSuffix}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post(`/groups/${conversationId}/ban`, {
        user_id: userId,
        duration_days: days
      });

      if (response.data.success) {
        toast.success(
          days ? `Member banned for ${days} days` : 'Member banned permanently',
          { position: 'top-right' }
        );
        if (onMemberUpdate) onMemberUpdate();
        setShowActionMenu(false);
        setSelectedMember(null);
      }
    } catch (error) {
      console.error('Error banning member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to ban member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!globalThis.confirm('Are you sure you want to remove this member from the group?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.delete(`/groups/${conversationId}/members/${userId}`);

      if (response.data.success) {
        toast.success('Member removed successfully');
        if (onMemberUpdate) onMemberUpdate();
        setShowActionMenu(false);
        setSelectedMember(null);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!isOwner) {
      toast.error('Only the group owner can change roles');
      return;
    }

    if (!globalThis.confirm(`Change this member's role to ${newRole}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.patch(`/groups/${conversationId}/members/${userId}/role`, {
        new_role: newRole
      });

      if (response.data.success) {
        toast.success(`Member promoted to ${newRole}`);
        if (onMemberUpdate) onMemberUpdate();
        setShowActionMenu(false);
        setSelectedMember(null);
      }
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to change role');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockRoom = async (locked) => {
    if (!isOwner) {
      toast.error('Only the group owner can lock/unlock the room');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.patch(`/groups/${conversationId}/lock`, { locked });

      if (response.data.success) {
        toast.success(locked ? 'Room locked' : 'Room unlocked');
      }
    } catch (error) {
      console.error('Error locking room:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update room lock status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Admin tabs">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors 
                      ${activeTab === 'members' 
                        ? 'border-orange-500 text-orange-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors 
                      ${activeTab === 'settings' 
                        ? 'border-orange-500 text-orange-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            Settings
          </button>
        </nav>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="p-6">
          <div className="space-y-3">
            {members.map((member) => {
              const isSelf = member.user_id === currentUserId;
              const isTargetOwner = member.role === 'owner';
              const canModerate = !isSelf && !isTargetOwner;

              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {member.profile_picture ? (
                        <img
                          src={member.profile_picture}
                          alt={member.name}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-600">
                            {(member.name || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Name & Role */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name}
                        {isSelf && <span className="ml-2 text-xs text-gray-500">(You)</span>}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                    </div>

                    {/* Status Indicators */}
                    {member.muted_until && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Muted
                      </span>
                    )}
                    {member.banned_until && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Banned
                      </span>
                    )}
                  </div>

                  {/* Action Menu */}
                  {canModerate && (
                    <div className="relative ml-3">
                      <button
                        onClick={() => {
                          setSelectedMember(selectedMember === member.user_id ? null : member.user_id);
                          setShowActionMenu(!showActionMenu);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md"
                        aria-label="Member actions menu"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>

                      {selectedMember === member.user_id && showActionMenu && (
                        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1" role="menu">
                            {/* Mute/Unmute */}
                            {member.muted_until ? (
                              <button
                                onClick={() => handleUnmuteMember(member.user_id)}
                                className="block w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                                disabled={isLoading}
                              >
                                Unmute Member
                              </button>
                            ) : (
                              <>
                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Mute</div>
                                {MUTE_DURATIONS.map((duration) => (
                                  <button
                                    key={duration.label}
                                    onClick={() => handleMuteMember(member.user_id, duration.hours)}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    disabled={isLoading}
                                  >
                                    {duration.label}
                                  </button>
                                ))}
                              </>
                            )}

                            <div className="border-t border-gray-100 my-1"></div>

                            {/* Ban */}
                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Ban</div>
                            {BAN_DURATIONS.map((duration) => (
                              <button
                                key={duration.label}
                                onClick={() => handleBanMember(member.user_id, duration.days)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                disabled={isLoading}
                              >
                                {duration.label}
                              </button>
                            ))}

                            <div className="border-t border-gray-100 my-1"></div>

                            {/* Role Change (Owner only) */}
                            {isOwner && member.role !== 'admin' && (
                              <button
                                onClick={() => handleChangeRole(member.user_id, 'admin')}
                                className="block w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
                                disabled={isLoading}
                              >
                                Promote to Admin
                              </button>
                            )}
                            {isOwner && member.role === 'admin' && (
                              <button
                                onClick={() => handleChangeRole(member.user_id, 'member')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                disabled={isLoading}
                              >
                                Demote to Member
                              </button>
                            )}

                            {/* Remove */}
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                              disabled={isLoading}
                            >
                              Remove from Group
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="p-6 space-y-6">
          {isOwner && (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Lock Room</h3>
                <p className="text-sm text-gray-500">
                  When locked, only owners can send messages
                </p>
              </div>
              <button
                onClick={() => handleLockRoom(true)}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md 
                         hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lock Room
              </button>
            </div>
          )}

          {/* Additional Settings */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Group Information</h3>
            <p className="text-sm text-gray-500">
              More group settings coming soon...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

GroupAdminPanel.propTypes = {
  conversationId: PropTypes.string.isRequired,
  currentUserId: PropTypes.string.isRequired,
  currentUserRole: PropTypes.string.isRequired,
  members: PropTypes.array.isRequired,
  onMemberUpdate: PropTypes.func,
};
