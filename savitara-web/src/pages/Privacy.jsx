import { Container, Typography, Paper, Box, Divider } from '@mui/material'
import Layout from '../components/Layout'

export default function Privacy() {
  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h3" gutterBottom fontWeight="bold">
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Last updated: {new Date().toLocaleDateString()}
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ mt: 3 }}>
            {/* 1. Introduction */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              1. INTRODUCTION
            </Typography>
            <Typography variant="body1" paragraph>
              At Savitara, we are committed to protecting your privacy and personal information. This Privacy Policy explains how we collect, use, share, and protect your data when you use our Platform. We follow GDPR-inspired best practices while complying with Indian data protection laws.
            </Typography>

            {/* 2. Information We Collect */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              2. INFORMATION WE COLLECT
            </Typography>
            
            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Personal Information:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Name, email address, phone number</li>
                <li>Location data (city, state, country, coordinates)</li>
                <li>Date of birth, profile pictures</li>
                <li>Google OAuth data (Google ID, verified email)</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Acharya-Specific Information:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Parampara (spiritual tradition), Gotra (lineage)</li>
                <li>Experience years, educational credentials</li>
                <li>Specializations, languages spoken</li>
                <li>Availability schedule</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Grihasta-Specific Information:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Service preferences</li>
                <li>Referral codes used</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Transaction Data:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Booking details (service type, date, time, location)</li>
                <li>Payment information (processed by Razorpay - we do not store card details)</li>
                <li>Attendance confirmations</li>
                <li>Reviews and ratings</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Technical Data:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>IP address, browser type, device information</li>
                <li>Cookies and tracking technologies</li>
                <li>Usage analytics (pages visited, features used)</li>
                <li>Error logs and performance data</li>
              </ul>
            </Typography>

            {/* 3. How We Collect Information */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              3. HOW WE COLLECT INFORMATION
            </Typography>
            <Typography variant="body1" paragraph component="div">
              We collect information through:
              <ul>
                <li>Direct input during registration and profile completion</li>
                <li>Google OAuth authentication</li>
                <li>Automated collection via cookies and analytics tools</li>
                <li>Communications including chat messages and support tickets</li>
              </ul>
            </Typography>

            {/* 4. How We Use Your Information */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              4. HOW WE USE YOUR INFORMATION
            </Typography>
            
            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Service Delivery:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Facilitate bookings between Grihastas and Acharyas</li>
                <li>Process payments securely via Razorpay</li>
                <li>Send booking confirmations and reminders</li>
                <li>Enable in-app messaging and communications</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Account Management:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Create and maintain user accounts</li>
                <li>Verify Acharya credentials</li>
                <li>Manage authentication via JWT tokens</li>
                <li>Handle attendance confirmations</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Platform Improvement:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Analyze usage patterns and feature adoption</li>
                <li>Develop new features and improvements</li>
                <li>Bug fixes and performance optimization</li>
                <li>A/B testing with anonymized data</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Safety and Security:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Fraud detection and prevention</li>
                <li>Abuse prevention and user safety</li>
                <li>Dispute resolution</li>
                <li>Legal compliance</li>
              </ul>
            </Typography>

            {/* 5. Information Sharing */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              5. INFORMATION SHARING
            </Typography>
            
            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              With Other Users:
            </Typography>
            <Typography variant="body1" paragraph>
              Grihastas can view Acharya profiles (name, specializations, ratings, location). Acharyas can view booking details (name, phone, location, service requirements). Both parties can see booking status and attendance confirmations.
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              With Service Providers:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li><strong>Razorpay:</strong> Payment processing (name, amount, transaction details)</li>
                <li><strong>MongoDB Atlas:</strong> Database hosting with encryption</li>
                <li><strong>Google Firebase:</strong> Authentication services</li>
                <li><strong>Hosting Providers:</strong> Infrastructure services with anonymization where possible</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              For Legal Reasons:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              We may share information when required by:
              <ul>
                <li>Court orders or legal processes</li>
                <li>Government requests</li>
                <li>Fraud prevention and investigation</li>
                <li>Protecting rights and safety of users</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              We NEVER:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Sell personal data to third parties</li>
                <li>Share data for third-party marketing purposes</li>
                <li>Disclose payment card details (handled exclusively by Razorpay)</li>
              </ul>
            </Typography>

            {/* 6. Data Security */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              6. DATA SECURITY
            </Typography>
            
            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Technical Measures:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Password hashing with bcrypt (12 rounds)</li>
                <li>JWT token authentication for secure sessions</li>
                <li>HTTPS encryption for data in transit</li>
                <li>MongoDB encryption at rest</li>
                <li>Firebase security rules</li>
                <li>Rate limiting for DoS protection</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Organizational Measures:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Role-based access controls</li>
                <li>Admin verification processes</li>
                <li>Audit logging</li>
                <li>Security incident response plan</li>
                <li>Regular security reviews</li>
              </ul>
            </Typography>

            <Typography variant="body1" paragraph>
              <strong>User Responsibilities:</strong> You are responsible for selecting secure passwords, maintaining account confidentiality, securing your devices, and immediately reporting any suspicious activity.
            </Typography>

            <Typography variant="body1" paragraph>
              <strong>Limitations:</strong> No system is 100% secure. In the event of a data breach, we will notify affected users within 72 hours. We are not liable for breaches resulting from user negligence.
            </Typography>

            {/* 7. Data Retention */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              7. DATA RETENTION
            </Typography>
            
            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Active Accounts:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>User data retained while account is active</li>
                <li>Booking history: 7 years (tax compliance)</li>
                <li>Payment records: 7 years (legal requirement)</li>
                <li>Chat messages: 1 year</li>
                <li>Analytics: Anonymized after 2 years</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ mt: 2, fontWeight: '500' }}>
              Deleted Accounts:
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <ul>
                <li>Personal data deleted within 30 days</li>
                <li>Transaction records retained for legal requirements</li>
                <li>Reviews anonymized (not deleted)</li>
                <li>Backup copies may persist up to 90 days</li>
              </ul>
            </Typography>

            {/* 8. Your Rights */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              8. YOUR RIGHTS
            </Typography>
            <Typography variant="body1" paragraph component="div">
              You have the right to:
              <ul>
                <li><strong>Access:</strong> View and download your personal data</li>
                <li><strong>Correction:</strong> Update profile information and correct inaccuracies</li>
                <li><strong>Deletion:</strong> Delete your account permanently (right to be forgotten, subject to legal exceptions)</li>
                <li><strong>Restriction:</strong> Limit data processing or object to certain uses</li>
                <li><strong>Portability:</strong> Export your data in JSON format for transfer to another service</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails, push notifications, and analytics tracking</li>
              </ul>
            </Typography>
            <Typography variant="body1" paragraph>
              To exercise these rights, use in-app settings or email <strong>privacy@savitara.com</strong>. We will respond within 30 days.
            </Typography>

            {/* 9. Cookies and Tracking */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              9. COOKIES AND TRACKING
            </Typography>
            <Typography variant="body1" paragraph component="div">
              We use cookies for:
              <ul>
                <li><strong>Essential:</strong> Authentication tokens, session management, security</li>
                <li><strong>Analytics:</strong> Usage patterns, feature adoption, performance monitoring</li>
                <li><strong>Preferences:</strong> Language settings, UI preferences</li>
              </ul>
              You can control cookies through your browser settings. Review third-party cookie policies for external services.
            </Typography>

            {/* 10. Children's Privacy */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              10. CHILDREN'S PRIVACY
            </Typography>
            <Typography variant="body1" paragraph>
              The Platform is not intended for users under 18 years of age. We do not knowingly collect data from minors. If we discover such data, it will be deleted immediately.
            </Typography>

            {/* 11. International Data Transfers */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              11. INTERNATIONAL DATA TRANSFERS
            </Typography>
            <Typography variant="body1" paragraph>
              Data is primarily stored in India. MongoDB Atlas operates global infrastructure with adequate safeguards for international transfers.
            </Typography>

            {/* 12. Changes to Privacy Policy */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              12. CHANGES TO PRIVACY POLICY
            </Typography>
            <Typography variant="body1" paragraph>
              We reserve the right to modify this Privacy Policy at any time. Material changes will be communicated via email. Continued use of the Platform after changes constitutes acceptance. Archived versions are available upon request.
            </Typography>

            {/* 13. Indian Law Compliance */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              13. INDIAN LAW COMPLIANCE
            </Typography>
            <Typography variant="body1" paragraph>
              We comply with the Information Technology Act 2000 (Section 43A - reasonable security practices), IT Rules 2011 (privacy policy publication, user consent, grievance redressal), and are prepared to comply with the Personal Data Protection Bill when enacted.
            </Typography>

            {/* 14. Contact Information */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              14. CONTACT INFORMATION
            </Typography>
            <Typography variant="body1" paragraph component="div">
              For privacy-related inquiries:
              <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: 12 }}>
                <li><strong>Privacy Inquiries:</strong> privacy@savitara.com</li>
                <li><strong>Data Protection Officer:</strong> dpo@savitara.com</li>
                <li><strong>Grievance Officer:</strong> grievance@savitara.com (Response: 72 hours, Resolution: 30 days)</li>
                <li><strong>General Support:</strong> support@savitara.com</li>
              </ul>
            </Typography>

            <Divider sx={{ my: 4 }} />

            <Typography variant="body2" color="text.secondary" textAlign="center">
              By using Savitara, you acknowledge that you have read and understood this Privacy Policy and consent to the collection, use, and sharing of your information as described herein.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Layout>
  )
}
