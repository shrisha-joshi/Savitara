import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { 
  Card, 
  Button, 
  Chip, 
  ActivityIndicator, 
  TextInput, 
  Text, 
  Avatar, 
  Divider,
  Snackbar,
  Portal,
  Dialog,
  Paragraph
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api';

export default function VerificationsScreen() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedAcharya, setSelectedAcharya] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/acharyas/pending');
      const data = response.data?.data || response.data;
      setVerifications(data?.acharyas || []);
    } catch (error) {
      console.error('Failed to fetch verifications:', error);
      setSnackbar({ visible: true, message: 'Failed to load verifications' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleVerify = async (acharyaId) => {
    try {
      setActionLoading(true);
      await api.post(`/admin/acharyas/${acharyaId}/verify`, { action: 'approve' });
      setSnackbar({ visible: true, message: 'Acharya verified successfully!' });
      fetchVerifications();
    } catch (error) {
      console.error('Verification failed:', error);
      setSnackbar({ visible: true, message: error.response?.data?.detail || 'Failed to verify' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setSnackbar({ visible: true, message: 'Please provide a reason for rejection' });
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/admin/acharyas/${selectedAcharya._id}/verify`, { 
        action: 'reject', 
        notes: rejectReason 
      });
      setSnackbar({ visible: true, message: 'Verification rejected' });
      setRejectDialog(false);
      setRejectReason('');
      setSelectedAcharya(null);
      fetchVerifications();
    } catch (error) {
      console.error('Rejection failed:', error);
      setSnackbar({ visible: true, message: error.response?.data?.detail || 'Failed to reject' });
    } finally {
      setActionLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVerifications();
  };

  const renderVerification = ({ item }) => (
    <Card style={styles.card} elevation={2}>
      <Card.Content>
        <View style={styles.header}>
          <Avatar.Icon 
            size={48} 
            icon="account" 
            style={styles.avatar} 
          />
          <View style={styles.headerText}>
            <Text variant="titleLarge" style={styles.name}>
              {item.full_name}
            </Text>
            <Chip mode="flat" style={styles.pendingChip} textStyle={styles.chipText}>
              PENDING
            </Chip>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="email" size={18} color="#666" />
          <Text variant="bodyMedium" style={styles.infoText}>
            {item.email}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="phone" size={18} color="#666" />
          <Text variant="bodyMedium" style={styles.infoText}>
            {item.phone_number || 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker" size={18} color="#666" />
          <Text variant="bodyMedium" style={styles.infoText}>
            {item.profile?.location?.city}, {item.profile?.location?.state}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="star" size={18} color="#666" />
          <Text variant="bodyMedium" style={styles.infoText}>
            {item.profile?.experience_years || 0} years experience
          </Text>
        </View>

        {item.profile?.specializations && item.profile.specializations.length > 0 && (
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionTitle}>
              Specializations
            </Text>
            <View style={styles.chips}>
              {item.profile.specializations.slice(0, 5).map((spec, idx) => (
                <Chip 
                  key={idx} 
                  mode="outlined" 
                  style={styles.chip}
                  textStyle={styles.chipTextSmall}
                >
                  {spec}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {item.profile?.languages && item.profile.languages.length > 0 && (
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionTitle}>
              Languages
            </Text>
            <View style={styles.chips}>
              {item.profile.languages.slice(0, 5).map((lang, idx) => (
                <Chip 
                  key={idx} 
                  style={styles.chip}
                  textStyle={styles.chipTextSmall}
                >
                  {lang}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {item.profile?.bio && (
          <View style={styles.section}>
            <Text variant="labelLarge" style={styles.sectionTitle}>
              Bio
            </Text>
            <Text variant="bodySmall" style={styles.bio}>
              {item.profile.bio.substring(0, 150)}
              {item.profile.bio.length > 150 ? '...' : ''}
            </Text>
          </View>
        )}
      </Card.Content>

      <Card.Actions style={styles.actions}>
        <Button
          mode="contained"
          icon="check-circle"
          buttonColor="#4CAF50"
          onPress={() => handleVerify(item._id)}
          disabled={actionLoading}
          style={styles.actionButton}
        >
          Approve
        </Button>
        <Button
          mode="outlined"
          icon="cancel"
          textColor="#F44336"
          onPress={() => {
            setSelectedAcharya(item);
            setRejectDialog(true);
          }}
          disabled={actionLoading}
          style={styles.actionButton}
        >
          Reject
        </Button>
      </Card.Actions>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading verifications...</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={verifications}
        renderItem={renderVerification}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="check-circle" size={64} color="#4CAF50" />
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              All Caught Up!
            </Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              No pending Acharya verifications
            </Text>
          </View>
        }
      />

      <Portal>
        <Dialog 
          visible={rejectDialog} 
          onDismiss={() => !actionLoading && setRejectDialog(false)}
        >
          <Dialog.Title>Reject Verification</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={styles.dialogText}>
              Please provide a reason for rejecting this Acharya's verification
            </Paragraph>
            <TextInput
              mode="outlined"
              label="Reason for rejection"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              placeholder="E.g., Incomplete documentation, invalid credentials..."
              disabled={actionLoading}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              onPress={handleReject} 
              disabled={actionLoading || !rejectReason.trim()}
              loading={actionLoading}
              textColor="#F44336"
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: '' })}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbar({ visible: false, message: '' }),
        }}
      >
        {snackbar.message}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#FF6B35',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pendingChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
  },
  chipText: {
    color: '#F57C00',
    fontSize: 11,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    flex: 1,
    color: '#333',
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    marginRight: 4,
    marginBottom: 4,
  },
  chipTextSmall: {
    fontSize: 12,
  },
  bio: {
    color: '#666',
    lineHeight: 20,
  },
  actions: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
    textAlign: 'center',
  },
  dialogText: {
    marginBottom: 16,
    color: '#666',
  },
});
