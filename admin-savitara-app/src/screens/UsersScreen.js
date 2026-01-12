import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Searchbar, Card, Title, Paragraph, Button, Chip, ActivityIndicator } from 'react-native-paper';
import api from '../services/api';

export default function UsersScreen() {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, [search, page]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users', {
        params: { search, page, limit: 20 },
      });
      setUsers(page === 1 ? response.data.data : [...users, ...response.data.data]);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (userId, suspend) => {
    try {
      await api.post(`/admin/users/${userId}/suspend`, { suspend });
      fetchUsers();
    } catch (error) {
      console.error('Failed to suspend user:', error);
    }
  };

  const renderUser = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.userInfo}>
            <Title>{item.name}</Title>
            <Paragraph>{item.email}</Paragraph>
            <Chip
              icon={item.role === 'acharya' ? 'account-star' : 'account'}
              style={[styles.chip, item.role === 'acharya' && styles.acharyaChip]}
            >
              {item.role}
            </Chip>
            {item.suspended && <Chip style={styles.suspendedChip}>Suspended</Chip>}
          </View>
          <Button
            mode="contained"
            buttonColor={item.suspended ? '#4CAF50' : '#F44336'}
            onPress={() => handleSuspend(item._id, !item.suspended)}
          >
            {item.suspended ? 'Unsuspend' : 'Suspend'}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading && page === 1) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search users..."
        onChangeText={setSearch}
        value={search}
        style={styles.searchbar}
      />
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item._id}
        onEndReached={() => setPage(page + 1)}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchbar: {
    margin: 16,
  },
  card: {
    margin: 8,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  chip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  acharyaChip: {
    backgroundColor: '#FF6B35',
  },
  suspendedChip: {
    backgroundColor: '#F44336',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
