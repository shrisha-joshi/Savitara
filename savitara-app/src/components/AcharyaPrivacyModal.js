import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch
} from 'react-native'
import PropTypes from 'prop-types'

const AcharyaPrivacyModal = ({ visible, onAccept, onCancel }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20
    
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true)
    }
  }

  const handleAccept = () => {
    if (!agreedToTerms || !hasScrolledToBottom) {
      return
    }
    onAccept()
  }

  const resetState = () => {
    setHasScrolledToBottom(false)
    setAgreedToTerms(false)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        resetState()
        onCancel()
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🔒 Privacy & Confidentiality</Text>
            <Text style={styles.headerSubtitle}>
              Important Information for Acharyas
            </Text>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Data Protection Responsibility</Text>
              <Text style={styles.paragraph}>
                As an Acharya on Savitara platform, you have access to sensitive personal 
                and spiritual information shared by Grihastas (service seekers). This includes:
              </Text>
              <Text style={styles.bullet}>• Personal details (name, location, contact)</Text>
              <Text style={styles.bullet}>• Birth details for astrological consultations</Text>
              <Text style={styles.bullet}>• Family information for rituals and ceremonies</Text>
              <Text style={styles.bullet}>• Spiritual concerns and queries</Text>
              <Text style={styles.bullet}>• Payment and booking information</Text>
            </View>

            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Confidentiality Requirements</Text>
              <Text style={styles.paragraph}>
                You MUST maintain strict confidentiality of all user information:
              </Text>
              <Text style={styles.bullet}>
                ✓ Do NOT share user details with any third party
              </Text>
              <Text style={styles.bullet}>
                ✓ Do NOT use information for purposes outside service delivery
              </Text>
              <Text style={styles.bullet}>
                ✓ Do NOT retain user data after service completion
              </Text>
              <Text style={styles.bullet}>
                ✓ Do NOT discuss user details publicly or privately
              </Text>
            </View>

            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Platform Communication Only</Text>
              <Text style={styles.paragraph}>
                All consultations and communications MUST happen through Savitara platform:
              </Text>
              <Text style={styles.bullet}>
                • Use in-app chat for all communications
              </Text>
              <Text style={styles.bullet}>
                • Do NOT ask users to contact you outside the platform
              </Text>
              <Text style={styles.bullet}>
                • Do NOT share personal contact details (phone, email, social media)
              </Text>
              <Text style={styles.bullet}>
                • Report any user requesting off-platform communication
              </Text>
            </View>

            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Booking Confirmation Ethics</Text>
              <Text style={styles.paragraph}>
                When confirming bookings:
              </Text>
              <Text style={styles.bullet}>
                • Ensure you can genuinely fulfill the service requested
              </Text>
              <Text style={styles.bullet}>
                • Do NOT accept bookings for specializations outside your expertise
              </Text>
              <Text style={styles.bullet}>
                • Be honest about availability and time commitments
              </Text>
              <Text style={styles.bullet}>
                • Inform users promptly if you need to decline or reschedule
              </Text>
            </View>

            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Consequences of Violation</Text>
              <Text style={styles.paragraph}>
                Violation of privacy and confidentiality policies will result in:
              </Text>
              <Text style={styles.bullet}>⚠️ Immediate account suspension</Text>
              <Text style={styles.bullet}>⚠️ Permanent ban from platform</Text>
              <Text style={styles.bullet}>⚠️ Legal action under Indian data protection laws</Text>
              <Text style={styles.bullet}>⚠️ Financial penalties and compensation claims</Text>
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠️ IMPORTANT</Text>
              <Text style={styles.warningText}>
                By confirming bookings on Savitara, you acknowledge that you have read, 
                understood, and agree to comply with all privacy and confidentiality 
                requirements outlined above. You accept full responsibility for maintaining 
                user data security and understand the serious consequences of any breach.
              </Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Savitara is committed to protecting user privacy and expects the same 
                commitment from all Acharyas on the platform.
              </Text>
            </View>
          </ScrollView>

          {/* Scroll Indicator */}
          {!hasScrolledToBottom && (
            <View style={styles.scrollIndicator}>
              <Text style={styles.scrollText}>↓ Please scroll to read fully ↓</Text>
            </View>
          )}

          {/* Agreement Checkbox */}
          <View style={styles.agreementSection}>
            <Switch
              value={agreedToTerms}
              onValueChange={setAgreedToTerms}
              disabled={!hasScrolledToBottom}
              trackColor={{ false: '#ccc', true: '#4caf50' }}
              thumbColor={agreedToTerms ? '#fff' : '#f4f3f4'}
            />
            <Text style={styles.agreementText}>
              I have read and understood all privacy policies. I agree to maintain 
              strict confidentiality of user information.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                resetState()
                onCancel()
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.acceptBtn,
                (!agreedToTerms || !hasScrolledToBottom) && styles.disabledBtn
              ]}
              onPress={handleAccept}
              disabled={!agreedToTerms || !hasScrolledToBottom}
            >
              <Text style={styles.acceptBtnText}>Accept & Confirm Booking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden'
  },
  header: {
    padding: 20,
    backgroundColor: '#FF6B35',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)'
  },
  scrollContent: {
    maxHeight: 400,
    padding: 20
  },
  contentSection: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginBottom: 12
  },
  bullet: {
    fontSize: 14,
    lineHeight: 24,
    color: '#666',
    paddingLeft: 8,
    marginBottom: 4
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    marginTop: 12
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8
  },
  warningText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333'
  },
  footer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center'
  },
  scrollIndicator: {
    padding: 12,
    backgroundColor: '#FFF9F5',
    borderTopWidth: 2,
    borderTopColor: '#FF6B35',
    alignItems: 'center'
  },
  scrollText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
    animation: 'bounce 2s infinite'
  },
  agreementSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    gap: 12
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    lineHeight: 18
  },
  buttonGroup: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
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
    fontSize: 15,
    fontWeight: '600'
  },
  acceptBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#4caf50',
    alignItems: 'center'
  },
  acceptBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600'
  },
  disabledBtn: {
    backgroundColor: '#ccc'
  }
})

AcharyaPrivacyModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onAccept: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default AcharyaPrivacyModal
