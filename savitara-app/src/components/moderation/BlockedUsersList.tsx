/**
 * Blocked Users List Component - React Native
 * Displays a paginated list of users that the current user has blocked
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import BlockUserButton from './BlockUserButton';

interface BlockedUser {
  id: string;
  name: string;
  email?: string;
  is_mutual: boolean;
  blocked_at: string;
  profile_picture_url?: string;
  avatar_url?: string;
}

interface BlockedUsersListProps {
  onUserUnblocked?: (userId: string) => void;
}

/**
 * BlockedUsersList Component
 */
export default function BlockedUsersList({ onUserUnblocked }: Readonly<BlockedUsersListProps>) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<BlockedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const ITEMS_PER_PAGE = 20;

  const fetchBlockedUsers = useCallback(async (page = 0, refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else if (page === 0) {
      setIsLoading(true);
    }

    try {
      const offset = page * ITEMS_PER_PAGE;
      const response = await api.get('/moderation/blocks', {
        params: {
          limit: ITEMS_PER_PAGE,
          offset,
        },
      });

      if (response.data.success) {
        const newUsers = response.data.data.users || [];
        const total = response.data.data.total || 0;
        const hasMoreData = response.data.data.has_more || false;

        if (page === 0 || refresh) {
          setBlockedUsers(newUsers);
          setFilteredUsers(newUsers);
        } else {
          setBlockedUsers((prev) => [...prev, ...newUsers]);
          setFilteredUsers((prev) => [...prev, ...newUsers]);
        }

        setTotalCount(total);
        setHasMore(hasMoreData);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load blocked users',
        position: 'top',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockedUsers(0);
  }, []);

  useEffect(() => {
    const filtered = blockedUsers.filter((user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, blockedUsers]);

  const handleUnblock = useCallback((userId: string) => {
    // Remove from local state immediately for optimistic UI
    setBlockedUsers((prev) => prev.filter((user) => user.id !== userId));
    setFilteredUsers((prev) => prev.filter((user) => user.id !== userId));
    setTotalCount((prev) => Math.max(0, prev - 1));

    if (onUserUnblocked) {
      onUserUnblocked(userId);
    }
  }, [onUserUnblocked]);

  const handleRefresh = useCallback(() => {
    fetchBlockedUsers(0, true);
  }, [fetchBlockedUsers]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchBlockedUsers(currentPage + 1);
    }
  }, [isLoading, hasMore, currentPage, fetchBlockedUsers]);

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        {item.profile_picture_url ? (
          <Image
            source={{ uri: item.profile_picture_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {item.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name || 'Unknown User'}</Text>
          {!!item.email && (
            <Text style={styles.userEmail}>{item.email}</Text>
          )}
          {!!item.is_mutual && (
            <View style={styles.mutualBadge}>
              <Text style={styles.mutualBadgeText}>Mutual Block</Text>
            </View>
          )}
        </View>
      </View>

      <BlockUserButton
        userId={item.id}
        userName={item.name || 'this user'}
        isBlocked={true}
        onBlockChange={(blocked: boolean) => {
          if (!blocked) {
            handleUnblock(item.id);
          }
        }}
        variant="outline"
        style={styles.unblockButton}
      />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🚫</Text>
      <Text style={styles.emptyTitle}>No Blocked Users</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'No blocked users match your search'
          : "You haven't blocked anyone yet"}
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
        <Text style={styles.loadingText}>Loading blocked users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Blocked Users</Text>
        {totalCount > 0 && (
          <Text style={styles.count}>{totalCount} blocked</Text>
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search blocked users..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderBlockedUser}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  count: {
    fontSize: 14,
    color: '#6B7280',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  listContent: {
    flexGrow: 1,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  mutualBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  mutualBadgeText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
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
