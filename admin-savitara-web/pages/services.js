import { useState, useEffect } from 'react'
import Layout from '../src/components/Layout'
import api from '../src/services/api'
import styles from '../styles/AdminServices.module.css'

export default function AdminServices() {
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('services')
  const [editingService, setEditingService] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    fetchServices()
    fetchBookings()
  }, [])

  const fetchServices = async () => {
    try {
      const response = await api.get('/services?limit=100')
      if (response.data.success) {
        setServices(response.data.data.services)
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookings = async () => {
    try {
      const response = await api.get('/admin/services/bookings/all?limit=100')
      if (response.data.success) {
        setBookings(response.data.data.bookings)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    }
  }

  const handleEditService = (service) => {
    setEditingService(service)
    setShowEditModal(true)
  }

  const handleUpdateService = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/admin/services/${editingService._id}`, editingService)
      alert('Service updated successfully')
      setShowEditModal(false)
      fetchServices()
    } catch (error) {
      console.error('Error updating service:', error)
      alert('Failed to update service')
    }
  }

  const handleToggleActive = async (serviceId, currentStatus) => {
    try {
      await api.put(`/admin/services/${serviceId}`, { is_active: !currentStatus })
      fetchServices()
    } catch (error) {
      console.error('Error toggling service status:', error)
    }
  }

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      await api.patch(`/admin/services/bookings/${bookingId}/status`, {
        new_status: newStatus
      })
      alert('Booking status updated')
      fetchBookings()
    } catch (error) {
      console.error('Error updating booking status:', error)
      alert('Failed to update booking status')
    }
  }

  const getCategoryName = (category) => {
    const names = {
      'life_ceremonies': 'Life Ceremonies',
      'worship_puja': 'Worship & Puja',
      'remedial_services': 'Remedial Services',
      'ancestral_rites': 'Ancestral Rites',
      'special_occasions': 'Special Occasions'
    }
    return names[category] || category
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Services Management</h1>
          <div className={styles.tabs}>
            <button
              className={activeTab === 'services' ? styles.activeTab : ''}
              onClick={() => setActiveTab('services')}
            >
              Services Catalog ({services.length})
            </button>
            <button
              className={activeTab === 'bookings' ? styles.activeTab : ''}
              onClick={() => setActiveTab('bookings')}
            >
              Service Bookings ({bookings.length})
            </button>
          </div>
        </div>

        {activeTab === 'services' && (
          <div className={styles.servicesGrid}>
            {loading ? (
              <div className={styles.loading}>Loading services...</div>
            ) : (
              services.map((service) => (
                <div key={service._id} className={styles.serviceCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.serviceIcon}>{service.icon}</span>
                    <div className={styles.statusBadge}>
                      {service.is_active ? (
                        <span className={styles.active}>Active</span>
                      ) : (
                        <span className={styles.inactive}>Inactive</span>
                      )}
                    </div>
                  </div>

                  <h3>{service.name_english}</h3>
                  <p className={styles.sanskritName}>{service.name_sanskrit}</p>
                  <p className={styles.category}>{getCategoryName(service.category)}</p>

                  <div className={styles.stats}>
                    <div className={styles.stat}>
                      <span>Bookings:</span>
                      <strong>{service.total_bookings || 0}</strong>
                    </div>
                    <div className={styles.stat}>
                      <span>Rating:</span>
                      <strong>{service.average_rating?.toFixed(1) || 'N/A'}</strong>
                    </div>
                  </div>

                  <div className={styles.pricing}>
                    <div className={styles.priceRow}>
                      <span>Muhurta:</span>
                      <span>₹{service.muhurta_consultation_price}</span>
                    </div>
                    <div className={styles.priceRow}>
                      <span>Full Service:</span>
                      <span>₹{service.full_service_base_price}</span>
                    </div>
                    <div className={styles.priceRow}>
                      <span>Custom Acharya:</span>
                      <span>₹{service.custom_acharya_base_price}</span>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => handleEditService(service)}
                    >
                      Edit Service
                    </button>
                    <button
                      className={service.is_active ? styles.deactivateBtn : styles.activateBtn}
                      onClick={() => handleToggleActive(service._id, service.is_active)}
                    >
                      {service.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className={styles.bookingsTable}>
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Service</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking._id}>
                    <td className={styles.bookingId}>{booking._id.slice(-6)}</td>
                    <td>{booking.service_name}</td>
                    <td>{booking.user_name}</td>
                    <td className={styles.bookingType}>{booking.booking_type}</td>
                    <td>{new Date(booking.selected_date).toLocaleDateString()}</td>
                    <td>₹{booking.total_amount}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[booking.status]}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <select
                        value={booking.status}
                        onChange={(e) => handleUpdateBookingStatus(booking._id, e.target.value)}
                        className={styles.statusSelect}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Service Modal */}
        {showEditModal && editingService && (
          <div 
            className={styles.modalOverlay} 
            onClick={() => setShowEditModal(false)}
            onKeyDown={(e) => e.key === 'Escape' && setShowEditModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-service-title"
          >
            <div 
              className={styles.modal} 
              onClick={(e) => e.stopPropagation()}
              role="document"
            >
              <div className={styles.modalHeader}>
                <h2 id="edit-service-title">Edit Service</h2>
                <button onClick={() => setShowEditModal(false)}>×</button>
              </div>

              <form onSubmit={handleUpdateService} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="name-english">English Name</label>
                  <input
                    id="name-english"
                    type="text"
                    value={editingService.name_english}
                    onChange={(e) =>
                      setEditingService({ ...editingService, name_english: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="name-sanskrit">Sanskrit Name</label>
                  <input
                    id="name-sanskrit"
                    type="text"
                    value={editingService.name_sanskrit}
                    onChange={(e) =>
                      setEditingService({ ...editingService, name_sanskrit: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="short-description">Short Description</label>
                  <textarea
                    id="short-description"
                    value={editingService.short_description}
                    onChange={(e) =>
                      setEditingService({ ...editingService, short_description: e.target.value })
                    }
                    rows="2"
                  />
                </div>

                <div className={styles.pricingSection}>
                  <h3>Pricing</h3>
                  <div className={styles.priceInputs}>
                    <div className={styles.formGroup}>
                      <label htmlFor="muhurta-price">Muhurta Consultation Price (₹)</label>
                      <input
                        id="muhurta-price"
                        type="number"
                        value={editingService.muhurta_consultation_price}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            muhurta_consultation_price: Number.parseFloat(e.target.value)
                          })
                        }
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="full-service-price">Full Service Base Price (₹)</label>
                      <input
                        id="full-service-price"
                        type="number"
                        value={editingService.full_service_base_price}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            full_service_base_price: Number.parseFloat(e.target.value)
                          })
                        }
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="custom-acharya-price">Custom Acharya Base Price (₹)</label>
                      <input
                        id="custom-acharya-price"
                        type="number"
                        value={editingService.custom_acharya_base_price}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            custom_acharya_base_price: Number.parseFloat(e.target.value)
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button type="button" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.saveBtn}>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
