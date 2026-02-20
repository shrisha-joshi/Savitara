/**
 * Group Admin Panel Component - React Native
 * Comprehensive group chat moderation interface for admins/owners
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';

type UserRole = 'owner' | 'admin' | 'member';
type ActionType = 'mute' | 'ban' | null;

interface Member {
  id: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  muted_until?: string | null;
  banned_until?: string | null;
  is_online?: boolean;
}

interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_id?: string;
  target_name?: string;
  details?: any;
  timestamp: string;
  created_at: string;
}

interface GroupAdminPanelProps {
  conversationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
  members?: Member[];
  onMemberUpdate?: (memberId: string, action: string) => void;
}

const MUTE_DURATIONS = [
  { label: '1 Hour', value: 1 },
  { label: '6 Hours', value: 6 },
  { label: '24 Hours', value: 24 },
  { label: '7 Days', value: 168 },
  { label: 'Indefinite', value: null },
];

const BAN_DURATIONS = [
  { label: '1 Day', value: 1 },
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: 'Permanent', value: null },
];

type ApiError = { response?: { data?: { error?: { message?: string } } } };

/**
 * GroupAdminPanel Component
 * @param {Object} props
 * @param {string} props.conversationId - Group conversation ID
 * @param {string} props.currentUserId - Current user's ID
 * @param {string} props.currentUserRole - Current user's role (owner, admin, member)
 * @param {Array} props.members - List of group members
 * @param {Function} props.onMemberUpdate - Callback when member status changes
 */
const AuditEmptyComponent = () => (
  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
    <Text style={{ color: '#6B7280' }}>No audit logs yet</Text>
  </View>
);

export default function GroupAdminPanel({
  conversationId,
  currentUserId,
  currentUserRole,
  members: initialMembers = [],
  onMemberUpdate,
}: Readonly<GroupAdminPanelProps>) {
  const [activeTab, setActiveTab] = useState<'members' | 'settings' | 'audit'>('members');
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [actionType, setActionType] = useState<ActionType>(null);

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
  const isOwner = currentUserRole === 'owner';

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLog();
    }
  }, [activeTab]);

  const fetchAuditLog = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/groups/${conversationId}/audit`, {
        params: { limit: 50, skip: 0 },
      });
      if (response.data.success) {
        setAuditLogs(response.data.data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching audit log:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load audit log',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuteMember = async (duration: number | null) => {
    setShowDurationModal(false);
    setIsLoading(true);

    if (!selectedMember) return;

    try {
      const response = await api.post(`/groups/${conversationId}/mute`, {
        user_id: selectedMember.id,
        duration_hours: duration,
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Member Muted',
          text2: `${selectedMember.name} has been muted`,
          position: 'top',
        });

        // Update local state
        setMembers((prev) =>
          prev.map((m) =>
            m.id === selectedMember.id
              ? { ...m, muted_until: response.data.data.muted_until }
              : m
          )
        );

        if (onMemberUpdate) {
          onMemberUpdate(selectedMember.id, 'muted');
        }
      }
    } catch (error) {
      console.error('Error muting member:', error);
      Toast.show({
        type: 'error',
        text1: 'Mute Failed',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to mute member',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
      setSelectedMember(null);
    }
  };

  const handleUnmuteMember = async (member: Member) => {
    setIsLoading(true);

    try {
      const response = await api.post(`/groups/${conversationId}/unmute`, null, {
        params: { user_id: member.id },
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Member Unmuted',
          text2: `${member.name} has been unmuted`,
          position: 'top',
        });

        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, muted_until: null } : m))
        );

        if (onMemberUpdate) {
          onMemberUpdate(member.id, 'unmuted');
        }
      }
    } catch (error) {
      console.error('Error unmuting member:', error);
      Toast.show({
        type: 'error',
        text1: 'Unmute Failed',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to unmute member',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBanMember = async (days: number | null) => {
    setShowDurationModal(false);
    setIsLoading(true);

    if (!selectedMember) return;

    try {
      const response = await api.post(`/groups/${conversationId}/ban`, {
        user_id: selectedMember.id,
        duration_days: days,
      });

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Member Banned',
          text2: `${selectedMember.name} has been banned`,
          position: 'top',
        });

        setMembers((prev) =>
          prev.map((m) =>
            m.id === selectedMember.id
              ? { ...m, banned_until: response.data.data.banned_until }
              : m
          )
        );

        if (onMemberUpdate) {
          onMemberUpdate(selectedMember.id, 'banned');
        }
      }
    } catch (error) {
      console.error('Error banning member:', error);
      Toast.show({
        type: 'error',
        text1: 'Ban Failed',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to ban member',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
      setSelectedMember(null);
    }
  };

  const executeRemoveMember = async (member: Member) => {
    setIsLoading(true);
    try {
      const response = await api.delete(
        `/groups/${conversationId}/members/${member.id}`
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Member Removed',
          text2: `${member.name} has been removed from the group`,
          position: 'top',
        });

        setMembers((prev) => prev.filter((m) => m.id !== member.id));

        if (onMemberUpdate) {
          onMemberUpdate(member.id, 'removed');
        }
      }
    } catch (error) {
      console.error('Error removing member:', error);
      Toast.show({
        type: 'error',
        text1: 'Remove Failed',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to remove member',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = (member: Member) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => { void executeRemoveMember(member); },
        },
      ]
    );
  };

  const executeChangeRole = async (member: Member, newRole: UserRole) => {
    setIsLoading(true);
    try {
      const response = await api.patch(
        `/groups/${conversationId}/members/${member.id}/role`,
        { new_role: newRole }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Role Changed',
          text2: `${member.name} is now ${newRole}`,
          position: 'top',
        });

        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
        );

        if (onMemberUpdate) {
          onMemberUpdate(member.id, 'role_changed');
        }
      }
    } catch (error) {
      console.error('Error changing role:', error);
      Toast.show({
        type: 'error',
        text1: 'Role Change Failed',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to change role',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = (member: Member, newRole: UserRole) => {
    Alert.alert(
      'Change Role',
      `Change ${member.name}'s role to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => { void executeChangeRole(member, newRole); },
        },
      ]
    );
  };

  const handleLockRoom = async (locked: boolean) => {
    setIsLoading(true);
    try {
      const response = await api.patch(`/groups/${conversationId}/lock`, { locked });

      if (response.data.success) {
        setIsRoomLocked(locked);
        Toast.show({
          type: 'success',
          text1: locked ? 'Room Locked' : 'Room Unlocked',
          text2: locked
            ? 'Only admins can send messages now'
            : 'All members can send messages',
          position: 'top',
        });
      }
    } catch (error) {
      console.error('Error locking room:', error);
      Toast.show({
        type: 'error',
        text1: 'Action Failed',
        text2: (error as ApiError).response?.data?.error?.message || 'Failed to lock/unlock room',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openActionMenu = (member: Member) => {
    setSelectedMember(member);
    setShowActionMenu(true);
  };

  const closeActionMenu = () => {
    setShowActionMenu(false);
    setSelectedMember(null);
  };

  const renderMemberItem = ({ item }: { item: Member }) => {
    const isMuted = item.muted_until && new Date(item.muted_until) > new Date();
    const isBanned = item.banned_until && new Date(item.banned_until) > new Date();

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {item.name?.charAt(0).toUpperCase() || 'M'}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <Text style={styles.memberName}>{item.name || 'Unknown'}</Text>
            <View style={styles.memberBadges}>
              <Text style={styles.roleBadge}>{item.role}</Text>
              {isMuted && <Text style={styles.mutedBadge}>Muted</Text>}
              {isBanned && <Text style={styles.bannedBadge}>Banned</Text>}
            </View>
          </View>
        </View>

        {isAdmin && item.role !== 'owner' && item.id !== currentUserId && (
          <TouchableOpacity
            style={styles.actionsButton}
            onPress={() => openActionMenu(item)}
          >
            <Text style={styles.actionsButtonText}>⋮</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAuditLogItem = ({ item }: { item: AuditLog }) => (
    <View style={styles.auditLogCard}>
      <Text style={styles.auditLogAction}>{item.action.replace('_', ' ')}</Text>
      <Text style={styles.auditLogDetails}>
        By: {item.actor_name} • Target: {item.target_name || 'N/A'}
      </Text>
      <Text style={styles.auditLogTime}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </View>
  );

  if (!isAdmin) {
    return (
      <View style={styles.noAccessContainer}>
        <Text style={styles.noAccessIcon}>🔒</Text>
        <Text style={styles.noAccessTitle}>Admin Access Required</Text>
        <Text style={styles.noAccessText}>
          Only group admins and owners can access this panel
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'audit' && styles.tabActive]}
          onPress={() => setActiveTab('audit')}
        >
          <Text style={[styles.tabText, activeTab === 'audit' && styles.tabTextActive]}>
            Audit Log
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'members' && (
        <FlatList
          data={members}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {activeTab === 'settings' && (
        <ScrollView style={styles.settingsContainer}>
          {isOwner && (
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Lock Room</Text>
                <Text style={styles.settingDescription}>
                  Only admins can send messages when locked
                </Text>
              </View>
              <Switch
                value={isRoomLocked}
                onValueChange={handleLockRoom}
                trackColor={{ false: '#D1D5DB', true: '#FBBF24' }}
                thumbColor={isRoomLocked ? '#FF6B35' : '#F3F4F6'}
              />
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'audit' && (
        <FlatList
          data={auditLogs}
          renderItem={renderAuditLogItem}
          keyExtractor={(item, index) => `${item.id || index}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={AuditEmptyComponent}
        />
      )}

      {/* Action Menu Modal */}
      <Modal visible={showActionMenu} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeActionMenu}
        >
          <View style={styles.actionMenuContainer}>
            <Text style={styles.actionMenuTitle}>
              Actions for {selectedMember?.name}
            </Text>

            {selectedMember?.muted_until && new Date(selectedMember.muted_until) > new Date() ? (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  closeActionMenu();
                  handleUnmuteMember(selectedMember);
                }}
              >
                <Text style={styles.actionMenuItemText}>🔊 Unmute</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  closeActionMenu();
                  setActionType('mute');
                  setShowDurationModal(true);
                }}
              >
                <Text style={styles.actionMenuItemText}>🔇 Mute</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                closeActionMenu();
                setActionType('ban');
                setShowDurationModal(true);
              }}
            >
              <Text style={styles.actionMenuItemText}>🚫 Ban</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                closeActionMenu();
                if (selectedMember) handleRemoveMember(selectedMember);
              }}
            >
              <Text style={[styles.actionMenuItemText, styles.actionMenuItemDanger]}>
                ❌ Remove from Group
              </Text>
            </TouchableOpacity>

            {isOwner && (
              <>
                <View style={styles.actionMenuDivider} />
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => {
                    closeActionMenu();
                    if (selectedMember) handleChangeRole(selectedMember, 'admin');
                  }}
                >
                  <Text style={styles.actionMenuItemText}>👑 Make Admin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => {
                    closeActionMenu();
                    if (selectedMember) handleChangeRole(selectedMember, 'member');
                  }}
                >
                  <Text style={styles.actionMenuItemText}>👤 Make Member</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.actionMenuCancel} onPress={closeActionMenu}>
              <Text style={styles.actionMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Duration Modal */}
      <Modal visible={showDurationModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDurationModal(false)}
        >
          <View style={styles.durationModalContainer}>
            <Text style={styles.durationModalTitle}>
              Select {actionType === 'mute' ? 'Mute' : 'Ban'} Duration
            </Text>

            {(actionType === 'mute' ? MUTE_DURATIONS : BAN_DURATIONS).map((duration) => (
              <TouchableOpacity
                key={duration.label}
                style={styles.durationOption}
                onPress={() => {
                  if (actionType === 'mute') {
                    handleMuteMember(duration.value);
                  } else {
                    handleBanMember(duration.value);
                  }
                }}
              >
                <Text style={styles.durationOptionText}>{duration.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.durationModalCancel}
              onPress={() => setShowDurationModal(false)}
            >
              <Text style={styles.durationModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      )}
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
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#FF6B35',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  memberBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'capitalize',
  },
  mutedBadge: {
    fontSize: 12,
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bannedBadge: {
    fontSize: 12,
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  actionsButton: {
    padding: 8,
  },
  actionsButtonText: {
    fontSize: 24,
    color: '#6B7280',
  },
  settingsContainer: {
    flex: 1,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  auditLogCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
  },
  auditLogAction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  auditLogDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  auditLogTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  noAccessIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noAccessTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  noAccessText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionMenuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionMenuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionMenuItemText: {
    fontSize: 16,
    color: '#111827',
  },
  actionMenuItemDanger: {
    color: '#DC2626',
    fontWeight: '600',
  },
  actionMenuDivider: {
    height: 8,
    backgroundColor: '#F3F4F6',
  },
  actionMenuCancel: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  actionMenuCancelText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  durationModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 20,
    padding: 16,
  },
  durationModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  durationOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  durationOptionText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  durationModalCancel: {
    paddingVertical: 14,
    marginTop: 8,
  },
  durationModalCancelText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
