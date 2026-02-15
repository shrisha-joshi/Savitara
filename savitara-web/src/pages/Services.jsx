import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import MobileNavigation from '../components/navigation/MobileNavigation'
import './Services.css'

const Services = () => {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchServices()
    fetchCategories()
  }, [])

  const fetchServices = async (category = null, search = null) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (category) params.append('category', category)
      if (search) params.append('search', search)
      
      const response = await api.get(`/services?${params.toString()}`)
      if (response.data.success) {
        setServices(response.data.data.services)
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/services/categories')
      if (response.data.success) {
        setCategories(response.data.data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    fetchServices(category, searchQuery)
  }

  const handleSearch = (e) => {
    const query = e.target.value
    setSearchQuery(query)
    if (query.length > 2 || query.length === 0) {
      fetchServices(selectedCategory, query)
    }
  }

  const getCategoryDisplayName = (category) => {
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
    <div className="services-page">
      <MobileNavigation />
      
      <div className="services-header">
        <h1>Hindu Spiritual Services</h1>
        <p>Book authentic rituals and ceremonies performed by experienced Acharyas</p>
      </div>

      <div className="services-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        <div className="category-filters">
          <button 
            className={selectedCategory ? '' : 'active'}
            onClick={() => handleCategoryChange(null)}
          >
            All Services
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              className={selectedCategory === cat._id ? 'active' : ''}
              onClick={() => handleCategoryChange(cat._id)}
            >
              {getCategoryDisplayName(cat._id)} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading services...</p>
        </div>
      ) : (
        <div className="services-grid">
          {services.length === 0 ? (
            <div className="no-services">
              <p>No services found</p>
            </div>
          ) : (
            services.map((service) => (
              <button 
                key={service._id} 
                className="service-card"
                onClick={() => navigate(`/services/${service._id}`)}
              >
                <div className="service-icon">{service.icon}</div>
                <h3>{service.name_english}</h3>
                <p className="sanskrit-name">{service.name_sanskrit}</p>
                <p className="service-description">{service.short_description}</p>
                
                <div className="service-meta">
                  <span className="category-badge">
                    {getCategoryDisplayName(service.category)}
                  </span>
                  {service.muhurta_required === 'mandatory' && (
                    <span className="muhurta-badge">Muhurta Required</span>
                  )}
                </div>

                <div className="service-pricing">
                  <div className="price-option">
                    <span className="price-label">Muhurta Consultation</span>
                    <span className="price">₹{service.muhurta_consultation_price}</span>
                  </div>
                  <div className="price-option">
                    <span className="price-label">Full Service</span>
                    <span className="price">from ₹{service.full_service_base_price}</span>
                  </div>
                </div>

                <span className="view-details-btn">View Details</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default Services
