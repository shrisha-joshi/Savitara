import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types';
import './AcharyaPrivacyModal.css'

const AcharyaPrivacyModal = ({ isOpen, onAccept, onCancel }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setHasScrolledToBottom(false)
      setAgreedToTerms(false)
    }
  }, [isOpen])

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight
    if (bottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true)
    }
  }

  const handleAccept = () => {
    if (!agreedToTerms || !hasScrolledToBottom) {
      return
    }
    onAccept()
  }

  if (!isOpen) return null

  return (
    <div 
      className="privacy-modal-overlay" 
      onClick={onCancel}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div 
        className="privacy-modal-content" 
        onClick={e => e.stopPropagation()}
        role="document"
        tabIndex={0} // Allows focus to be trapped here if we implemented trap focus
      >
        {/* Header */}
        <div className="privacy-header">
          <h2>🔒 Privacy & Confidentiality</h2>
          <p>Important Information for Acharyas</p>
        </div>

        {/* Scrollable Content */}
        <div 
          className="privacy-scroll-content" 
          onScroll={handleScroll}
          ref={scrollRef}
        >
          <div className="content-section">
            <h3>Data Protection Responsibility</h3>
            <p>
              As an Acharya on Savitara platform, you have access to sensitive personal 
              and spiritual information shared by Grihastas (service seekers). This includes:
            </p>
            <ul>
              <li>Personal details (name, location, contact)</li>
              <li>Birth details for astrological consultations</li>
              <li>Family information for rituals and ceremonies</li>
              <li>Spiritual concerns and queries</li>
              <li>Payment and booking information</li>
            </ul>
          </div>

          <div className="content-section">
            <h3>Confidentiality Requirements</h3>
            <p>You MUST maintain strict confidentiality of all user information:</p>
            <ul>
              <li>✓ Do NOT share user details with any third party</li>
              <li>✓ Do NOT use information for purposes outside service delivery</li>
              <li>✓ Do NOT retain user data after service completion</li>
              <li>✓ Do NOT discuss user details publicly or privately</li>
            </ul>
          </div>

          <div className="content-section">
            <h3>Platform Communication Only</h3>
            <p>All consultations and communications MUST happen through Savitara platform:</p>
            <ul>
              <li>• Use in-app chat for all communications</li>
              <li>• Do NOT ask users to contact you outside the platform</li>
              <li>• Do NOT share personal contact details (phone, email, social media)</li>
              <li>• Report any user requesting off-platform communication</li>
            </ul>
          </div>

          <div className="content-section">
            <h3>Booking Confirmation Ethics</h3>
            <p>When confirming bookings:</p>
            <ul>
              <li>• Ensure you can genuinely fulfill the service requested</li>
              <li>• Do NOT accept bookings for specializations outside your expertise</li>
              <li>• Be honest about availability and time commitments</li>
              <li>• Inform users promptly if you need to decline or reschedule</li>
            </ul>
          </div>

          <div className="content-section">
            <h3>Consequences of Violation</h3>
            <p>Violation of privacy and confidentiality policies will result in:</p>
            <ul>
              <li>⚠️ Immediate account suspension</li>
              <li>⚠️ Permanent ban from platform</li>
              <li>⚠️ Legal action under Indian data protection laws</li>
              <li>⚠️ Financial penalties and compensation claims</li>
            </ul>
          </div>

          <div className="warning-box">
            <h4>⚠️ IMPORTANT</h4>
            <p>
              By confirming bookings on Savitara, you acknowledge that you have read, 
              understood, and agree to comply with all privacy and confidentiality 
              requirements outlined above. You accept full responsibility for maintaining 
              user data security and understand the serious consequences of any breach.
            </p>
          </div>

          <div className="footer-note">
            <p>
              Savitara is committed to protecting user privacy and expects the same 
              commitment from all Acharyas on the platform.
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        {!hasScrolledToBottom && (
          <div className="scroll-indicator">
            <p>↓ Please scroll to read fully ↓</p>
          </div>
        )}

        {/* Agreement Checkbox */}
        <div className="agreement-section">
          <label className={!hasScrolledToBottom ? 'disabled' : ''}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              disabled={!hasScrolledToBottom}
            />
            <span>
              I have read and understood all privacy policies. I agree to maintain 
              strict confidentiality of user information.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="button-group">
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`accept-btn ${(!agreedToTerms || !hasScrolledToBottom) ? 'disabled' : ''}`}
            onClick={handleAccept}
            disabled={!agreedToTerms || !hasScrolledToBottom}
          >
            Accept & Confirm Booking
          </button>
        </div>
      </div>
    </div>
  )
}

export default AcharyaPrivacyModal


AcharyaPrivacyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onAccept: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

