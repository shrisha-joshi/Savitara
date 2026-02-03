import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  Alert
} from 'react-native'
import { TextInput, Switch, Button as PaperButton } from 'react-native-paper'
import { Picker } from '@react-native-picker/picker'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const CalendarScreen = () => {
  const { user } = useAuth()
  const [availability, setAvailability] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)

  const [newSlot, setNewSlot] = useState({
    day_of_week: 'monday',
    start_time: '09:00',
    end_time: '17:00',
    is_recurring: true,
    max_bookings: 5
  })

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday'
  }

  useEffect(() => {
    if (user?.role === 'acharya') {
      fetchAvailability()
    }
  }, [user])

  const fetchAvailability = async () => {
    try {
      const response = await api.get('/calendar/availability')
      
      if (response.data.success) {
        setAvailability(response.data.data.availability || [])
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      Alert.alert('Error', 'Failed to load availability schedule')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchAvailability()
  }

  const handleAddSlot = async () => {
    try {
      const response = await api.post('/calendar/availability', newSlot)
      
      if (response.data.success) {
        Alert.alert('Success', 'Availability slot added')
        setShowAddModal(false)
        setNewSlot({
          day_of_week: 'monday',
          start_time: '09:00',
          end_time: '17:00',
          is_recurring: true,
          max_bookings: 5
        })
        fetchAvailability()
      }
    } catch (error) {
      console.error('Error adding slot:', error)
      Alert.alert('Error', 'Failed to add availability slot')
    }
  }

  const handleUpdateSlot = async () => {
    try {
      const response = await api.put(`/calendar/availability/${editingSlot._id}`, editingSlot)
      
      if (response.data.success) {
        Alert.alert('Success', 'Availability updated')
        setEditingSlot(null)
        fetchAvailability()
      }
    } catch (error) {
      console.error('Error updating slot:', error)
      Alert.alert('Error', 'Failed to update availability')
    }
  }

  const handleDeleteSlot = (slotId) => {
    Alert.alert(
      'Delete Slot',
      'Are you sure you want to delete this availability slot?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/calendar/availability/${slotId}`)
              Alert.alert('Success', 'Availability slot deleted')
              fetchAvailability()
            } catch (error) {
              console.error('Error deleting slot:', error)
              Alert.alert('Error', 'Failed to delete availability slot')
            }
          }
        }
      ]
    )
  }

  const groupByDay = () => {
    const grouped = {}
    daysOfWeek.forEach(day => {
      grouped[day] = availability.filter(slot => slot.day_of_week === day)
    })
    return grouped
  }

  const groupedAvailability = groupByDay()

  if (user?.role !== 'acharya') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          This feature is only available for Acharyas
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📅 My Availability</Text>
          <Text style={styles.headerSubtitle}>
            Manage your weekly schedule
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add Slot</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading availability...</Text>
        ) : (
          daysOfWeek.map(day => (
            <View key={day} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{dayLabels[day]}</Text>
                <View
                  style={[
                    styles.slotBadge,
                    groupedAvailability[day].length > 0 && styles.slotBadgeActive
                  ]}
                >
                  <Text style={styles.slotBadgeText}>
                    {groupedAvailability[day].length} slot(s)
                  </Text>
                </View>
              </View>

              {groupedAvailability[day].length === 0 ? (
                <View style={styles.noSlots}>
                  <Text style={styles.noSlotsText}>
                    No availability set
                  </Text>
                </View>
              ) : (
                groupedAvailability[day].map(slot => (
                  <View key={slot._id} style={styles.slotItem}>
                    <View style={styles.slotInfo}>
                      <Text style={styles.slotTime}>
                        ⏰ {slot.start_time} - {slot.end_time}
                      </Text>
                      <View style={styles.slotMeta}>
                        {slot.is_recurring && (
                          <View style={styles.recurringBadge}>
                            <Text style={styles.recurringText}>Recurring</Text>
                          </View>
                        )}
                        <Text style={styles.maxBookings}>
                          Max: {slot.max_bookings}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.slotActions}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => setEditingSlot(slot)}
                      >
                        <Text style={styles.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteSlot(slot._id)}
                      >
                        <Text style={styles.deleteBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Slot Modal */}
      <Modal
        visible={showAddModal || !!editingSlot}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false)
          setEditingSlot(null)
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingSlot ? 'Edit' : 'Add'} Availability Slot
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Day of Week</Text>
              <Picker
                selectedValue={editingSlot ? editingSlot.day_of_week : newSlot.day_of_week}
                onValueChange={(value) => {
                  if (editingSlot) {
                    setEditingSlot({ ...editingSlot, day_of_week: value })
                  } else {
                    setNewSlot({ ...newSlot, day_of_week: value })
                  }
                }}
                style={styles.picker}
              >
                {daysOfWeek.map(day => (
                  <Picker.Item key={day} label={dayLabels[day]} value={day} />
                ))}
              </Picker>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Start Time</Text>
              <TextInput
                value={editingSlot ? editingSlot.start_time : newSlot.start_time}
                onChangeText={(value) => {
                  if (editingSlot) {
                    setEditingSlot({ ...editingSlot, start_time: value })
                  } else {
                    setNewSlot({ ...newSlot, start_time: value })
                  }
                }}
                placeholder="09:00"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>End Time</Text>
              <TextInput
                value={editingSlot ? editingSlot.end_time : newSlot.end_time}
                onChangeText={(value) => {
                  if (editingSlot) {
                    setEditingSlot({ ...editingSlot, end_time: value })
                  } else {
                    setNewSlot({ ...newSlot, end_time: value })
                  }
                }}
                placeholder="17:00"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Max Bookings</Text>
              <TextInput
                value={(editingSlot ? editingSlot.max_bookings : newSlot.max_bookings).toString()}
                onChangeText={(value) => {
                  const num = parseInt(value) || 1
                  if (editingSlot) {
                    setEditingSlot({ ...editingSlot, max_bookings: num })
                  } else {
                    setNewSlot({ ...newSlot, max_bookings: num })
                  }
                }}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.label}>Recurring (every week)</Text>
              <Switch
                value={editingSlot ? editingSlot.is_recurring : newSlot.is_recurring}
                onValueChange={(value) => {
                  if (editingSlot) {
                    setEditingSlot({ ...editingSlot, is_recurring: value })
                  } else {
                    setNewSlot({ ...newSlot, is_recurring: value })
                  }
                }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowAddModal(false)
                  setEditingSlot(null)
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={editingSlot ? handleUpdateSlot : handleAddSlot}
              >
                <Text style={styles.saveBtnText}>
                  {editingSlot ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  addButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 16
  },
  loadingText: {
    textAlign: 'center',
    padding: 40,
    color: '#666'
  },
  errorText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
    color: '#666'
  },
  dayCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0'
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#F5F5F5'
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  slotBadge: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  slotBadgeActive: {
    backgroundColor: '#4caf50'
  },
  slotBadgeText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500'
  },
  noSlots: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 8
  },
  noSlotsText: {
    color: '#999',
    fontSize: 14
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    marginBottom: 8
  },
  slotInfo: {
    flex: 1
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6
  },
  slotMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  recurringBadge: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  recurringText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500'
  },
  maxBookings: {
    fontSize: 12,
    color: '#666'
  },
  slotActions: {
    flexDirection: 'row',
    gap: 8
  },
  editBtn: {
    padding: 8
  },
  editBtnText: {
    fontSize: 18
  },
  deleteBtn: {
    padding: 8
  },
  deleteBtnText: {
    fontSize: 18
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12
  },
  picker: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center'
  },
  cancelBtnText: {
    color: '#666',
    fontWeight: '600'
  },
  saveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
    alignItems: 'center'
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '600'
  }
})

export default CalendarScreen
