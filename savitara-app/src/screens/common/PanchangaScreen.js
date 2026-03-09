import { MaterialCommunityIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Chip,
    Divider,
    SegmentedButtons,
    Text
} from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Choghadiya quality → colour
const CHG_QUALITY_COLOR = {
  excellent:    '#1abc9c',
  auspicious:   '#2ecc71',
  good:         '#58d68d',
  neutral:      '#3498db',
  caution:      '#f39c12',
  inauspicious: '#e74c3c',
};

// ── Date helpers ────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

// ── Tiny Section component ──────────────────────────────────────────────────
const Section = ({ icon, title, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      {icon && <MaterialCommunityIcons name={icon} size={18} color="#667eea" style={{ marginRight: 6 }} />}
      <Text variant="titleMedium" style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

Section.propTypes = {
  icon:     PropTypes.string,
  title:    PropTypes.string.isRequired,
  children: PropTypes.node,
};

Section.defaultProps = {
  icon:     null,
  children: null,
};

// ── InfoRow ─────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || 'N/A'}</Text>
  </View>
);

InfoRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

InfoRow.defaultProps = {
  value: null,
};

// ── ChoghadiyaTable ──────────────────────────────────────────────────────────
const ChoghadiyaTable = ({ periods, label }) => {
  if (!periods?.length) return null;
  return (
    <View style={styles.chgTable}>
      <Text style={styles.chgTableLabel}>{label}</Text>
      {periods.map((p) => (
        <View
          key={`${p.start}-${p.name}`}
          style={[styles.chgRow, { borderLeftColor: CHG_QUALITY_COLOR[p.quality] || '#aaa', borderLeftWidth: 4 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.chgName}>{p.name} <Text style={{ color: '#888', fontSize: 11 }}>({p.planet})</Text></Text>
            <Text style={styles.chgTime}>{p.start} – {p.end}</Text>
          </View>
          <Chip compact style={[styles.chgChip, { backgroundColor: CHG_QUALITY_COLOR[p.quality] + '30' }]}
            textStyle={{ color: CHG_QUALITY_COLOR[p.quality], fontSize: 10 }}>
            {p.quality}
          </Chip>
        </View>
      ))}
    </View>
  );
};

ChoghadiyaTable.propTypes = {
  periods: PropTypes.arrayOf(PropTypes.shape({
    start:   PropTypes.string,
    end:     PropTypes.string,
    name:    PropTypes.string,
    planet:  PropTypes.string,
    quality: PropTypes.string,
  })),
  label: PropTypes.string.isRequired,
};

ChoghadiyaTable.defaultProps = {
  periods: [],
};

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function PanchangaScreen() {
  const { user } = useAuth();
  const [panchanga, setPanchanga] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const [panchangaType, setPanchangaType] = useState(
    user?.panchanga_type || 'lunar'
  );

  const lat = user?.location?.latitude;
  const lon = user?.location?.longitude;

  const loadPanchanga = useCallback(async (dateStr, type) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ panchanga_type: type });
      if (lat != null) params.set('latitude', lat);
      if (lon != null) params.set('longitude', lon);

      const isToday = dateStr === today();
      const endpoint = isToday
        ? `/panchanga/today?${params}`
        : `/panchanga/date/${dateStr}?${params}`;
      const res = await api.get(endpoint);
      setPanchanga(res.data?.data || res.data);
      setError(null);
    } catch (err) {
      console.error('Panchanga load error:', err);
      setError('Unable to load Panchanga. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    loadPanchanga(selectedDate, panchangaType);
  }, [selectedDate, panchangaType, loadPanchanga]);

  const goToPrevDay = () => setSelectedDate(prev => addDays(prev, -1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday   = () => setSelectedDate(today());

  const chgDay   = panchanga?.choghadiya?.filter(c => c.period === 'day') || [];
  const chgNight = panchanga?.choghadiya?.filter(c => c.period === 'night') || [];

  const periodLabel = (p) =>
    p?.start && p?.end ? `${p.start} – ${p.end}` : 'N/A';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</Text>
        <Button onPress={() => loadPanchanga(selectedDate, panchangaType)}>Retry</Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="calendar-month" size={28} color="#fff" />
        <Text variant="headlineSmall" style={styles.headerTitle}>Panchanga</Text>
        {panchanga?.panchanga_type_name && (
          <Chip style={styles.typeChip} textStyle={styles.typeChipText}>
            {panchanga.panchanga_type_name}
          </Chip>
        )}
      </View>

      {/* ── Type Toggle ─────────────────────────────────────────────────── */}
      <View style={styles.toggleRow}>
        <SegmentedButtons
          value={panchangaType}
          onValueChange={setPanchangaType}
          buttons={[
            { value: 'lunar', label: 'Chandramana' },
            { value: 'solar', label: 'Souramana' },
          ]}
          style={styles.segmented}
        />
      </View>

      {/* ── Date navigation ─────────────────────────────────────────────── */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPrevDay} style={styles.navBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#667eea" />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="titleSmall" style={styles.dateLabel}>{fmtDate(selectedDate)}</Text>
          {selectedDate !== today() && (
            <Text style={styles.todayHint}>Tap to go to today</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextDay} style={styles.navBtn}>
          <MaterialCommunityIcons name="chevron-right" size={28} color="#667eea" />
        </TouchableOpacity>
      </View>

      {/* ── Sankalpa Strip ──────────────────────────────────────────────── */}
      {panchanga && (
        <View style={styles.sankalpRow}>
          {panchanga.samvatsara?.name && (
            <Chip style={styles.sankalpChip} textStyle={styles.sankalpText} icon="star-four-points">
              {panchanga.samvatsara.name}
            </Chip>
          )}
          {panchanga.vikrama_samvat && (
            <Chip style={styles.sankalpChip} textStyle={styles.sankalpText}>
              VS {panchanga.vikrama_samvat}
            </Chip>
          )}
          {panchanga.shaka_samvat && (
            <Chip style={styles.sankalpChip} textStyle={styles.sankalpText}>
              Śaka {panchanga.shaka_samvat}
            </Chip>
          )}
          {panchanga.ayana?.name && (
            <Chip style={styles.sankalpChip} textStyle={styles.sankalpText}>
              {panchanga.ayana.name}
            </Chip>
          )}
          {panchanga.ritu?.name && (
            <Chip style={styles.sankalpChip} textStyle={styles.sankalpText}>
              {panchanga.ritu.name}
            </Chip>
          )}
          {panchanga.month_name && (
            <Chip style={styles.sankalpChip} textStyle={styles.sankalpText}>
              {panchanga.month_name}
            </Chip>
          )}
        </View>
      )}

      {panchanga && (
        <Card style={styles.card}>
          <Card.Content>

            {/* ── Pañca Aṅga ───────────────────────────────────────────── */}
            <Section icon="calendar-star" title="Pañca Aṅga — Five Limbs">
              {(() => {
                const tithiEnd = panchanga.tithi_end_time ? ` · ends ${panchanga.tithi_end_time}` : '';
                const tithiVal = panchanga.tithi
                  ? `${panchanga.tithi.name} · ${panchanga.tithi.paksha} Paksha${tithiEnd}`
                  : 'N/A';
                return <InfoRow label="Tithi (Lunar Day)" value={tithiVal} />;
              })()}
              {panchanga.tithi?.is_ekadashi && (
                <Chip style={styles.flagChip} icon="star">Ekadashi</Chip>
              )}
              {panchanga.tithi?.is_full_moon && (
                <Chip style={styles.flagChip} icon="moon-full">Purnima</Chip>
              )}
              {panchanga.tithi?.is_new_moon && (
                <Chip style={styles.flagChip} icon="moon-new">Amavasya</Chip>
              )}
              <InfoRow label="Vara (Weekday)"
                value={`${panchanga.day_of_week || ''} (${panchanga.day_of_week_sa || ''})`}
              />
              {(() => {
                const nakEnd = panchanga.nakshatra_end_time ? ` · ends ${panchanga.nakshatra_end_time}` : '';
                const nakVal = panchanga.nakshatra
                  ? `${panchanga.nakshatra.name}${nakEnd}`
                  : 'N/A';
                return <InfoRow label="Nakshatra (Star)" value={nakVal} />;
              })()}
              <InfoRow label="Yoga"   value={panchanga.yoga?.name} />
              <InfoRow label="Karana" value={panchanga.karana?.name} />
            </Section>

            <Divider style={styles.divider} />

            {/* ── Solar / Lunar Times ───────────────────────────────────── */}
            <Section icon="weather-sunny" title="Solar & Lunar Times">
              <InfoRow label="Sunrise"  value={panchanga.sunrise} />
              <InfoRow label="Sunset"   value={panchanga.sunset} />
              <InfoRow label="Moonrise" value={panchanga.moonrise} />
              <InfoRow label="Moonset"  value={panchanga.moonset} />
            </Section>

            <Divider style={styles.divider} />

            {/* ── Extended Elements ─────────────────────────────────────── */}
            <Section icon="earth" title="Extended Elements">
              <InfoRow label="Samvatsara (Jovian Year)"
                value={panchanga.samvatsara
                  ? `${panchanga.samvatsara.name} · ${panchanga.samvatsara.name_sa}`
                  : 'N/A'}
              />
              <InfoRow label="Vikrama Samvat" value={panchanga.vikrama_samvat?.toString()} />
              <InfoRow label="Shaka Samvat"   value={panchanga.shaka_samvat?.toString()} />
              <InfoRow label="Kali Yuga"       value={panchanga.kali_yuga?.toString()} />
              <InfoRow label="Ayana"
                value={panchanga.ayana
                  ? `${panchanga.ayana.name} · ${panchanga.ayana.name_sa}`
                  : 'N/A'}
              />
              <InfoRow label="Ritu (Season)"
                value={panchanga.ritu
                  ? `${panchanga.ritu.name} · ${panchanga.ritu.name_sa}`
                  : 'N/A'}
              />
              <InfoRow label="Surya Rashi (Sun in)"
                value={panchanga.surya_rashi
                  ? `${panchanga.surya_rashi.name} · ${panchanga.surya_rashi.name_sa}`
                  : 'N/A'}
              />
              <InfoRow label="Chandra Rashi (Moon in)"
                value={panchanga.chandra_rashi
                  ? `${panchanga.chandra_rashi.name} · ${panchanga.chandra_rashi.name_sa}`
                  : 'N/A'}
              />
            </Section>

            <Divider style={styles.divider} />

            {/* ── Inauspicious Periods ─────────────────────────────────── */}
            <Section icon="alert-circle-outline" title="Inauspicious Periods">
              <InfoRow label="Rahu Kalam"
                value={periodLabel(panchanga.inauspicious_periods?.rahu_kalam)} />
              <InfoRow label="Yamagandam"
                value={periodLabel(panchanga.inauspicious_periods?.yamagandam)} />
              <InfoRow label="Gulika Kalam"
                value={periodLabel(panchanga.inauspicious_periods?.gulika_kalam)} />
              {panchanga.durmuhurtam?.length > 0 && (
                <InfoRow label="Durmuhurtam"
                  value={panchanga.durmuhurtam.map(d => `${d.start}–${d.end}`).join(', ')} />
              )}
              {panchanga.varjyam && (
                <InfoRow label="Varjyam"
                  value={`${panchanga.varjyam.start}–${panchanga.varjyam.end} (${panchanga.varjyam.nakshatra})`} />
              )}
            </Section>

            <Divider style={styles.divider} />

            {/* ── Choghadiya ──────────────────────────────────────────── */}
            {(chgDay.length > 0 || chgNight.length > 0) && (
              <Section icon="clock-outline" title="Choghadiya">
                <ChoghadiyaTable periods={chgDay}   label="Day Choghadiya" />
                <ChoghadiyaTable periods={chgNight} label="Night Choghadiya" />
              </Section>
            )}

            {(panchanga.hora?.length > 0) && (
              <>
                <Divider style={styles.divider} />
                <Section icon="clock-time-four-outline" title="Hora">
                    {panchanga.hora.map((h) => (
                    <View key={`hora-${h.start}-${h.lord}`} style={[styles.chgRow, { borderLeftColor: h.color || '#aaa', borderLeftWidth: 4 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.chgName}>{h.lord} <Text style={{ color: '#888', fontSize: 11 }}>({h.period})</Text></Text>
                        <Text style={styles.chgTime}>{h.start} – {h.end}</Text>
                      </View>
                      {h.good_for && (
                        <Text style={{ fontSize: 10, color: '#888', maxWidth: 90, textAlign: 'right' }}>
                          {h.good_for.slice(0, 2).join(', ')}
                        </Text>
                      )}
                    </View>
                  ))}
                </Section>
              </>
            )}

            {/* ── Festivals ───────────────────────────────────────────── */}
            {panchanga.festivals?.length > 0 && (
              <>
                <Divider style={styles.divider} />
                <Section icon="star" title="Festivals Today">
                  <View style={styles.chipRow}>
                    {panchanga.festivals.map((f) => (
                      <Chip key={f} style={styles.festChip} textStyle={styles.festText}>{f}</Chip>
                    ))}
                  </View>
                </Section>
              </>
            )}

            {/* ── Muhurat ─────────────────────────────────────────────── */}
            {panchanga.muhurat?.length > 0 && (
              <>
                <Divider style={styles.divider} />
                <Section icon="check-circle-outline" title="Auspicious Muhurat">
                  {panchanga.muhurat.map((m) => (
                    <View key={m.name || m.start} style={styles.muhuratRow}>
                      <Text style={styles.muhuratName}>{m.name}</Text>
                      <Text style={styles.muhuratTime}>{m.start} – {m.end}</Text>
                      {m.good_for?.length > 0 && (
                        <Text style={styles.muhuratFor}>{m.good_for.join(' · ')}</Text>
                      )}
                    </View>
                  ))}
                </Section>
              </>
            )}

          </Card.Content>
        </Card>
      )}

      {/* ── About ─────────────────────────────────────────────────────── */}
      <View style={styles.aboutBox}>
        <Text style={styles.aboutText}>
          Panchanga (पञ्चाङ्ग) comprises five limbs: Tithi, Vara, Nakshatra, Yoga, Karana.
          Calculations use precise astronomical positions.
          {lat && ` Timezone: ${panchanga?.meta?.timezone || 'Asia/Kolkata'}.`}
        </Text>
        {!lat && (
          <Text style={[styles.aboutText, { color: '#f39c12', marginTop: 4 }]}>
            Tip: Save your location in Profile for accurate local timings (Choghadiya, Hora, Moonrise).
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { color: '#fff', fontWeight: 'bold', flex: 1 },
  typeChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  typeChipText: { color: '#fff', fontSize: 11 },

  toggleRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  segmented: { borderRadius: 8 },

  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  navBtn: { padding: 4 },
  dateLabel: { fontWeight: '600', color: '#333', textAlign: 'center' },
  todayHint: { fontSize: 11, color: '#667eea', textAlign: 'center' },

  sankalpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ede7f6',
  },
  sankalpChip: { backgroundColor: '#d1c4e9' },
  sankalpText: { color: '#4527a0', fontSize: 11, fontWeight: '600' },

  card: { margin: 12, borderRadius: 12 },

  section: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 4 },
  sectionTitle: { fontWeight: 'bold', color: '#333' },

  divider: { marginVertical: 12 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  infoLabel: { fontSize: 13, color: '#666', flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '500', color: '#222', flex: 1, textAlign: 'right' },

  flagChip: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#fff9c4' },

  chgTable: { marginTop: 6 },
  chgTableLabel: { fontWeight: '600', color: '#555', marginBottom: 6, fontSize: 13 },
  chgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginVertical: 2,
    backgroundColor: '#fafafa',
    borderRadius: 6,
  },
  chgName: { fontSize: 13, fontWeight: '600', color: '#333' },
  chgTime: { fontSize: 11, color: '#666', marginTop: 1 },
  chgChip: { marginLeft: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  festChip: { backgroundColor: '#e8f5e9' },
  festText: { color: '#2e7d32', fontSize: 12 },

  muhuratRow: { paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  muhuratName: { fontWeight: '600', fontSize: 13, color: '#333' },
  muhuratTime: { color: '#2e7d32', fontSize: 13 },
  muhuratFor: { fontSize: 11, color: '#888', marginTop: 2 },

  aboutBox: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 12,
    backgroundColor: '#e8eaf6',
    borderRadius: 10,
  },
  aboutText: { fontSize: 12, color: '#555', lineHeight: 18 },
});
