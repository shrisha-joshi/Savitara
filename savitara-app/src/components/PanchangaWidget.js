import { MaterialCommunityIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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

// ── helpers ─────────────────────────────────────────────────────────────────
const CHG_QUALITY_BG = {
  excellent:    'rgba(26,188,156,0.3)',
  auspicious:   'rgba(46,204,113,0.3)',
  good:         'rgba(88,214,141,0.3)',
  neutral:      'rgba(52,152,219,0.3)',
  caution:      'rgba(243,156,18,0.3)',
  inauspicious: 'rgba(231,76,60,0.3)',
};

const nowMins = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const toMins = (t) => { if (!t) { return null; } const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const getActivePeriod = (periods) => {
  const now = nowMins();
  return (periods || []).find(p => {
    const s = toMins(p.start), e = toMins(p.end);
    return s !== null && e !== null && now >= s && now < e;
  }) || null;
};

export default function PanchangaWidget({ navigation }) {
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
        {navigation && (
          <IconButton
            icon="arrow-expand"
            iconColor="#fff"
            size={18}
            onPress={() => navigation.navigate('Panchanga')}
          />
        )}

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

        {/* Samvatsara */}
        {panchanga.samvatsara?.name && (
          <Chip
            mode="flat"
            style={[styles.chip, { marginBottom: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.28)' }]}
            textStyle={[styles.chipText, { fontSize: 11 }]}
            icon="star-four-points"
          >
            {panchanga.samvatsara.name} · VS {panchanga.vikrama_samvat}
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

            {/* Active Choghadiya period */}
            {(() => {
              const active = getActivePeriod(panchanga.choghadiya);
              if (!active) return null;
              return (
                <View style={[styles.section, { backgroundColor: CHG_QUALITY_BG[active.quality] || 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8 }]}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#fff" />
                    <Text style={styles.sectionTitle}>Current Choghadiya</Text>
                  </View>
                  <Text style={styles.sectionText}>
                    {active.name} ({active.quality}) · {active.start}–{active.end}
                  </Text>
                </View>
              );
            })()}
          </>
        )}
      </Card.Content>

      {navigation && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Panchanga')}
          style={styles.viewFullBtn}
        >
          <Text style={styles.viewFullText}>View Full Panchanga →</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

PanchangaWidget.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
  }),
};

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
  viewFullBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  viewFullText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
