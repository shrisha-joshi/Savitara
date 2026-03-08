import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
    ActivityIndicator,
    Card,
    Chip,
    Divider,
    IconButton,
    Text,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function PanchangaWidget() {
  const { user } = useAuth();
  const [panchanga, setPanchanga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPanchanga();
  // Re-fetch when user location or panchanga type changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.location?.latitude, user?.location?.longitude, user?.panchanga_type]);

  const loadPanchanga = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const lat = user?.location?.latitude;
      const lon = user?.location?.longitude;
      const type = user?.panchanga_type || 'lunar';
      if (lat != null) params.set('latitude', lat);
      if (lon != null) params.set('longitude', lon);
      params.set('panchanga_type', type);
      const response = await api.get(`/panchanga/today?${params.toString()}`);
      const data = response.data?.data || response.data;
      setPanchanga(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load Panchanga:', err);
      setError('Unable to load Panchanga');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card style={styles.card}>
        <Card.Content style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#667eea" />
        </Card.Content>
      </Card>
    );
  }

  if (error || !panchanga) {
    return null; // Silently fail if panchanga unavailable
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="calendar-month" size={24} color="#fff" />
            <Text variant="titleLarge" style={styles.title}>
              Panchanga
            </Text>
          </View>
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            iconColor="#fff"
            onPress={() => setExpanded(!expanded)}
          />
        </View>

        <Text style={styles.date}>{today}</Text>

        {panchanga.panchanga_type_name && (
          <Chip
            mode="flat"
            style={[styles.chip, styles.typeChip]}
            textStyle={[styles.chipText, styles.typeChipText]}
            icon="calendar-clock"
          >
            {panchanga.panchanga_type_name}
          </Chip>
        )}

        <View style={styles.chipsRow}>
          <Chip
            mode="flat"
            style={styles.chip}
            textStyle={styles.chipText}
          >
            Tithi: {panchanga.tithi?.name || 'N/A'}
          </Chip>
          <Chip
            mode="flat"
            style={styles.chip}
            textStyle={styles.chipText}
          >
            Nakshatra: {panchanga.nakshatra?.name || 'N/A'}
          </Chip>
        </View>

        {expanded && (
          <>
            <Divider style={styles.divider} />

            {panchanga.yoga && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Yoga</Text>
                <Text style={styles.sectionText}>{panchanga.yoga.name}</Text>
              </View>
            )}

            {panchanga.karana && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Karana</Text>
                <Text style={styles.sectionText}>{panchanga.karana.name}</Text>
              </View>
            )}

            {panchanga.paksha && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Paksha</Text>
                <Text style={styles.sectionText}>{panchanga.paksha} ({panchanga.tithi?.paksha_english || ''})</Text>
              </View>
            )}

            {panchanga.sunrise && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <MaterialCommunityIcons name="weather-sunny" size={16} color="#fff" />
                  <Text style={styles.sectionTitle}>Sunrise & Sunset</Text>
                </View>
                <Text style={styles.sectionText}>
                  Sunrise: {panchanga.sunrise} | Sunset: {panchanga.sunset}
                </Text>
              </View>
            )}

            {panchanga.festivals && panchanga.festivals.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <MaterialCommunityIcons name="star" size={16} color="#fff" />
                  <Text style={styles.sectionTitle}>Festivals</Text>
                </View>
                <View style={styles.festivalsContainer}>
                  {panchanga.festivals.map((festival, idx) => (
                    <Chip
                      key={`festival-${festival}-${idx}`}
                      mode="flat"
                      style={styles.festivalChip}
                      textStyle={styles.chipText}
                    >
                      {festival}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    backgroundColor: '#667eea',
    borderRadius: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
  },
  date: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  typeChip: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  typeChipText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  festivalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  festivalChip: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
