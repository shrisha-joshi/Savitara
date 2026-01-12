import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Text } from 'react-native';
import { Card, Button, Chip, ActivityIndicator, TextInput } from 'react-native-paper';
import api from '../services/api';

export default function VerificationsScreen() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      const response = await api.get('/admin/verifications/pending');
      setVerifications(response.data.data);
    } catch (error) {
      console.error('Failed to fetch verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (acharyaId, approve, reason = '') => {
    try {
      await api.post(`/admin/acharyas/${acharyaId}/verify`, {
        approve,
        rejection_reason: reason,
      });
      fetchVerifications();
      setSelectedId(null);
      setRejectReason('');
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  const renderVerification = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.text}>{item.email}</Text>
        <Text style={styles.info}>Phone: {item.phone}</Text>
        <Text style={styles.info}>Years of Experience: {item.yearsOfExperience}</Text>
        {item.specializations && (
          <View style={styles.chips}>
            {item.specializations.map((spec) => (
              <Chip key={spec} style={styles.chip}>
                {spec}
              </Chip>
            ))}
          </View>
        )}
        <Text style={styles.info}>Languages: {item.languages?.join(', ')}</Text>

        {selectedId === item._id ? (
          <View style={styles.rejectContainer}>
            <TextInput
              label="Rejection Reason"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              style={styles.input}
            />
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={() => {
                  setSelectedId(null);
                  setRejectReason('');
                }}
                style={styles.button}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor="#F44336"
                onPress={() => handleVerify(item._id, false, rejectReason)}
                disabled={!rejectReason}
                style={styles.button}
              >
                Confirm Reject
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              buttonColor="#4CAF50"
              onPress={() => handleVerify(item._id, true)}
              style={styles.button}
            >
              Approve
            </Button>
            <Button
              mode="contained"
              buttonColor="#F44336"
              onPress={() => setSelectedId(item._id)}
              style={styles.button}
            >
              Reject
            </Button>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <FlatList
      data={verifications}
      renderItem={renderVerification}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.text}>No pending verifications</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
  info: {
    marginTop: 4,
    color: '#757575',
    fontSize: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    margin: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  rejectContainer: {
    marginTop: 12,
  },
  input: {
    marginBottom: 12,
  },
});
