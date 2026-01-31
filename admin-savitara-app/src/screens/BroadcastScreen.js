import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, RadioButton, Card, Text, Snackbar } from 'react-native-paper';
import api from '../services/api';

export default function BroadcastScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: '' });

  const handleSendBroadcast = async () => {
    if (!title || !body) {
      setSnackbar({ visible: true, message: 'Please fill all fields' });
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/admin/notifications/broadcast', {
        title,
        body,
        target_role: targetRole,
      });
      const data = response.data?.data || response.data;
      setSnackbar({ 
        visible: true, 
        message: `Notification sent to ${data.recipients_count || 'all'} users!` 
      });
      setTitle('');
      setBody('');
      setTimeout(() => navigation.goBack(), 2000);
    } catch (error) {
      console.error('Broadcast failed:', error);
      setSnackbar({ 
        visible: true, 
        message: error.response?.data?.detail || 'Failed to send broadcast' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Send Broadcast Notification
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Send push notifications to users across the platform
          </Text>

          <TextInput
            label="Notification Title"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            mode="outlined"
            placeholder="Enter a catchy title..."
          />

          <TextInput
            label="Message"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            style={styles.input}
            mode="outlined"
            placeholder="Type your message here..."
          />

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Target Audience
          </Text>
          <RadioButton.Group onValueChange={setTargetRole} value={targetRole}>
            <View style={styles.radioRow}>
              <RadioButton value="all" />
              <Text style={styles.radioLabel}>All Users (Grihastas + Acharyas)</Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="grihasta" />
              <Text style={styles.radioLabel}>Grihastas Only</Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="acharya" />
              <Text style={styles.radioLabel}>Acharyas Only</Text>
            </View>
          </RadioButton.Group>

          <Button
            mode="contained"
            onPress={handleSendBroadcast}
            loading={loading}
            disabled={loading || !title || !body}
            style={styles.button}
            icon="send"
          >
            {loading ? 'Sending...' : 'Send Notification'}
          </Button>
        </Card.Content>
      </Card>

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
    </ScrollView>
  );
}

BroadcastScreen.propTypes = {
  navigation: PropTypes.shape({
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  card: {
    margin: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#757575',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  radioLabel: {
    fontSize: 16,
    marginLeft: 8,
  },
  button: {
    marginTop: 24,
  },
});
