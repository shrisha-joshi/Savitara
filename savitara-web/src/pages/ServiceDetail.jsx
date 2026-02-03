import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import MobileNavigation from '../../components/navigation/MobileNavigation'
import './ServiceDetail.css'

const ServiceDetail = () => {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedBookingType, setSelectedBookingType] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingData, setBookingData] = useState({
    selected_date: '',
    selected_time_slot: '',
    venue_address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: ''
    },
    contact_number: '',
    alternate_number: '',
    special_requests: ''
  })

  useEffect(() => {
    fetchServiceDetails()
  }, [serviceId])

  const fetchServiceDetails = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/services/${serviceId}`)
      if (response.data.success) {
        setService(response.data.data.service)
      }
    } catch (error) {
      console.error('Error fetching service:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBookingTypeSelect = (type) => {
    if (!user) {
      navigate('/login')
      return
    }
    setSelectedBookingType(type)
    setShowBookingModal(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name.startsWith('venue_')) {
      const field = name.replace('venue_', '')
      setBookingData(prev => ({
        ...prev,
        venue_address: {
          ...prev.venue_address,
          [field]: value
        }
      }))
    } else {
      setBookingData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSubmitBooking = async (e) => {
    e.preventDefault()
    
    try {
      const payload = {
        booking_type: selectedBookingType,
        ...bookingData
      }

      const response = await api.post(`/services/${serviceId}/booking`, payload)
      
      if (response.data.success) {
        const bookingId = response.data.data.booking_id
        
        // For muhurta consultation, redirect to acharya selection
        if (selectedBookingType === 'muhurta_consultation') {
          alert('Muhurta consultation booking created. Please select an Acharya to proceed.')
          navigate('/grihasta/search-acharyas')
        } else {
          // For full service and custom acharya, proceed to payment
          navigate(`/grihasta/payment`, { 
            state: { 
              bookingId,
              bookingType: 'service',
              amount: response.data.data.total_amount 
            } 
          })
        }
      }
    } catch (error) {
      console.error('Error creating booking:', error)
      alert('Failed to create booking. Please try again.')
    }
  }

  const getPrice = (type) => {
    if (!service) return 0
    
    switch(type) {
      case 'muhurta_consultation':
        return service.muhurta_consultation_price
      case 'full_service':
        return service.full_service_base_price
      case 'custom_acharya':
        return service.custom_acharya_base_price
      default:
        return 0
    }
  }

  const getBookingTypeDetails = (type) => {
    const details = {
      muhurta_consultation: {
        title: 'Muhurta Consultation Only',
        description: 'Get auspicious timing consultation from an experienced Acharya',
        includes: [
          'Detailed muhurta analysis',
          'Best dates and timings',
          'Things to avoid',
          '30-min consultation call',
          'Written muhurta report'
        ]
      },
      full_service: {
        title: 'Complete Service Package',
        description: 'Full service organized by Savitara with all arrangements',
        includes: service?.platform_provides || []
      },
      custom_acharya: {
        title: 'Choose Your Acharya',
        description: 'Select and book with your preferred Acharya',
        includes: service?.customer_provides || []
      }
    }
    return details[type]
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading service details...</p>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="error-container">
        <h2>Service not found</h2>
        <button onClick={() => navigate('/services')}>Back to Services</button>
      </div>
    )
  }

  return (
    <div className="service-detail-page">
      <MobileNavigation />
      
      <div className="service-detail-header">
        <button className="back-btn" onClick={() => navigate('/services')}>
          ← Back to Services
        </button>
        
        <div className="service-title-section">
          <div className="service-icon-large">{service.icon}</div>
          <h1>{service.name_english}</h1>
          <h2 className="sanskrit-name-large">{service.name_sanskrit}</h2>
        </div>
      </div>

      <div className="service-content">
        <div className="service-main-info">
          <section className="info-section">
            <h3>About This Service</h3>
            <p>{service.full_description}</p>
          </section>

          <section className="info-section">
            <h3>Why It's Important</h3>
            <p>{service.importance}</p>
          </section>

          <section className="info-section">
            <h3>Benefits</h3>
            <p>{service.benefits}</p>
          </section>

          <section className="info-section">
            <h3>Requirements</h3>
            <ul>
              {service.requirements?.map((req, index) => (
                <li key={`req-${index}`}>{req}</li>
              ))}
            </ul>
          </section>

          {service.muhurta_details && (
            <section className="info-section muhurta-section">
              <h3>Muhurta (Auspicious Timing)</h3>
              <div className="muhurta-info">
                <div className="muhurta-item">
                  <strong>Best Tithis:</strong>
                  <p>{service.muhurta_details.best_tithis?.join(', ')}</p>
                </div>
                <div className="muhurta-item">
                  <strong>Best Nakshatras:</strong>
                  <p>{service.muhurta_details.best_nakshatras?.join(', ')}</p>
                </div>
                <div className="muhurta-item">
                  <strong>Avoid On:</strong>
                  <p>{service.muhurta_details.avoid_days?.join(', ')}</p>
                </div>
              </div>
            </section>
          )}

          <section className="info-section">
            <h3>Duration</h3>
            <p>{service.duration}</p>
          </section>
        </div>

        <div className="booking-options-sidebar">
          <h3>Booking Options</h3>
          
          {/* Muhurta Consultation */}
          <div className="booking-option-card">
            <h4>{getBookingTypeDetails('muhurta_consultation').title}</h4>
            <p className="booking-description">
              {getBookingTypeDetails('muhurta_consultation').description}
            </p>
            <ul className="includes-list">
              {getBookingTypeDetails('muhurta_consultation').includes.map((item, idx) => (
                <li key={`mc-${idx}`}>✓ {item}</li>
              ))}
            </ul>
            <div className="price-display">
              ₹{getPrice('muhurta_consultation')}
            </div>
            <button 
              className="book-now-btn"
              onClick={() => handleBookingTypeSelect('muhurta_consultation')}
            >
              Book Consultation
            </button>
          </div>

          {/* Full Service */}
          <div className="booking-option-card featured">
            <div className="popular-badge">Most Popular</div>
            <h4>{getBookingTypeDetails('full_service').title}</h4>
            <p className="booking-description">
              {getBookingTypeDetails('full_service').description}
            </p>
            <ul className="includes-list">
              {getBookingTypeDetails('full_service').includes.map((item, idx) => (
                <li key={`fs-${idx}`}>✓ {item}</li>
              ))}
            </ul>
            <div className="price-display">
              from ₹{getPrice('full_service')}
            </div>
            <button 
              className="book-now-btn primary"
              onClick={() => handleBookingTypeSelect('full_service')}
            >
              Book Full Service
            </button>
          </div>

          {/* Custom Acharya */}
          <div className="booking-option-card">
            <h4>{getBookingTypeDetails('custom_acharya').title}</h4>
            <p className="booking-description">
              {getBookingTypeDetails('custom_acharya').description}
            </p>
            <div className="responsibility-note">
              <strong>You'll need to arrange:</strong>
              <ul className="includes-list">
                {getBookingTypeDetails('custom_acharya').includes.map((item, idx) => (
                  <li key={`ca-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="price-display">
              from ₹{getPrice('custom_acharya')}
            </div>
            <button 
              className="book-now-btn"
              onClick={() => handleBookingTypeSelect('custom_acharya')}
            >
              Choose Acharya
            </button>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowBookingModal(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setShowBookingModal(false)}
        >
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()}
            role="document"
          >
            <div className="modal-header">
              <h3>Complete Your Booking</h3>
              <button className="close-btn" onClick={() => setShowBookingModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmitBooking} className="booking-form">
              <div className="form-group">
                <label htmlFor="selected_date">Preferred Date *</label>
                <input 
                  id="selected_date"
                  type="date" 
                  name="selected_date"
                  value={bookingData.selected_date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="selected_time_slot">Preferred Time Slot *</label>
                <select 
                  id="selected_time_slot"
                  name="selected_time_slot"
                  value={bookingData.selected_time_slot}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a time slot</option>
                  <option value="morning">Morning (6 AM - 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                  <option value="evening">Evening (4 PM - 8 PM)</option>
                </select>
              </div>

              <div className="form-section-title">Venue Address</div>
              
              <div className="form-group">
                <label htmlFor="venue_line1">Address Line 1 *</label>
                <input 
                  id="venue_line1"
                  type="text" 
                  name="venue_line1"
                  value={bookingData.venue_address.line1}
                  onChange={handleInputChange}
                  placeholder="House/Flat No., Street Name"
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="venue_line2">Address Line 2</label>
                <input 
                  id="venue_line2"
                  type="text" 
                  name="venue_line2"
                  value={bookingData.venue_address.line2}
                  onChange={handleInputChange}
                  placeholder="Landmark, Area"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="venue_city">City *</label>
                  <input 
                    id="venue_city"
                    type="text" 
                    name="venue_city"
                    value={bookingData.venue_address.city}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="venue_state">State *</label>
                  <input 
                    id="venue_state"
                    type="text" 
                    name="venue_state"
                    value={bookingData.venue_address.state}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="venue_pincode">Pincode *</label>
                <input 
                  id="venue_pincode"
                  type="text" 
                  name="venue_pincode"
                  value={bookingData.venue_address.pincode}
                  onChange={handleInputChange}
                  pattern="[0-9]{6}"
                  placeholder="6-digit pincode"
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="contact_number">Contact Number *</label>
                <input 
                  id="contact_number"
                  type="tel" 
                  name="contact_number"
                  value={bookingData.contact_number}
                  onChange={handleInputChange}
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile number"
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="alternate_number">Alternate Number</label>
                <input 
                  id="alternate_number"
                  type="tel" 
                  name="alternate_number"
                  value={bookingData.alternate_number}
                  onChange={handleInputChange}
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="special_requests">Special Requests</label>
                <textarea 
                  id="special_requests"
                  name="special_requests"
                  value={bookingData.special_requests}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Any specific requirements or preferences..."
                />
              </div>

              <div className="booking-summary">
                <div className="summary-row">
                  <span>Base Price:</span>
                  <span>₹{getPrice(selectedBookingType)}</span>
                </div>
                <div className="summary-row">
                  <span>Platform Fee (10%):</span>
                  <span>₹{(getPrice(selectedBookingType) * 0.1).toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>GST (18%):</span>
                  <span>₹{(getPrice(selectedBookingType) * 1.1 * 0.18).toFixed(2)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Amount:</span>
                  <span>₹{(getPrice(selectedBookingType) * 1.1 * 1.18).toFixed(2)}</span>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowBookingModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {selectedBookingType === 'muhurta_consultation' ? 'Create Booking' : 'Proceed to Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServiceDetail
