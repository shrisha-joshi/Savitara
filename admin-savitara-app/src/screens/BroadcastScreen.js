import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { TextInput, Button, RadioButton, Card } from 'react-native-paper';
import api from '../services/api';

export default function BroadcastScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleSendBroadcast = async () => {
    if (!title || !message) {
      alert('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      await api.post('/admin/broadcast', {
        title,
        message,
        audience,
      });
      alert('Broadcast sent successfully!');
      setTitle('');
      setMessage('');
      navigation.goBack();
    } catch (error) {
      console.error('Broadcast failed:', error);
      alert('Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Send Broadcast Notification</Text>
          <Text style={styles.subtitle}>
            Send notifications to users based on audience selection
          </Text>

          <TextInput
            label="Notification Title"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            mode="outlined"
          />

          <TextInput
            label="Message"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            style={styles.input}
            mode="outlined"
          />

          <Text style={styles.sectionTitle}>Target Audience</Text>
          <RadioButton.Group onValueChange={setAudience} value={audience}>
            <View style={styles.radioRow}>
              <RadioButton value="all" />
              <Text style={styles.radioLabel}>All Users</Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="grihastas" />
              <Text style={styles.radioLabel}>Grihastas Only</Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="acharyas" />
              <Text style={styles.radioLabel}>Acharyas Only</Text>
            </View>
          </RadioButton.Group>

          <Button
            mode="contained"
            onPress={handleSendBroadcast}
            loading={loading}
            disabled={loading || !title || !message}
            style={styles.button}
          >
            Send Broadcast
          </Button>
        </Card.Content>
      </Card>
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
