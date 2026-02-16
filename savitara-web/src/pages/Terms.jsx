import { Container, Typography, Paper, Box, Divider } from '@mui/material'
import Layout from '../components/Layout'

export default function Terms() {
  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h3" gutterBottom fontWeight="bold">
            Terms and Conditions
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Last updated: {new Date().toLocaleDateString()}
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ mt: 3 }}>
            {/* 1. Acceptance of Terms */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              1. ACCEPTANCE OF TERMS
            </Typography>
            <Typography variant="body1" paragraph>
              By accessing and using the Savitara platform (the "Platform"), you accept and agree to be bound by these Terms and Conditions. This constitutes a binding agreement upon platform use. We reserve the right to modify these terms at any time, and such modifications will become effective immediately upon posting. Continued use of the Platform after modifications constitutes acceptance of the updated terms.
            </Typography>

            {/* 2. Definitions */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              2. DEFINITIONS
            </Typography>
            <Typography variant="body1" paragraph component="div">
              For the purposes of these Terms and Conditions:
              <ul>
                <li><strong>Platform:</strong> Refers to the Savitara mobile application and website</li>
                <li><strong>Grihasta:</strong> Service seeker or householder seeking spiritual services</li>
                <li><strong>Acharya:</strong> Service provider offering spiritual guidance and religious services</li>
                <li><strong>Services:</strong> Hindu religious ceremonies, consultations, poojas, and spiritual guidance</li>
                <li><strong>Bookings:</strong> Confirmed appointments between Grihastas and Acharyas</li>
                <li><strong>Admin:</strong> Platform administrators responsible for verification and moderation</li>
              </ul>
            </Typography>

            {/* 3. Eligibility */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              3. ELIGIBILITY
            </Typography>
            <Typography variant="body1" paragraph>
              You must be at least 18 years of age to use this Platform. By registering, you represent and warrant that all information provided is accurate, current, and complete. The Platform is primarily designed for users located in India, though access from other regions is permitted.
            </Typography>

            {/* 4. User Accounts */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              4. USER ACCOUNTS
            </Typography>
            <Typography variant="body1" paragraph>
              Registration can be completed via Google OAuth or email/password authentication. You are solely responsible for maintaining the security of your account credentials. Each user is permitted only one account. We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
            </Typography>

            {/* 5. Grihasta Responsibilities */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              5. GRIHASTA RESPONSIBILITIES
            </Typography>
            <Typography variant="body1" paragraph component="div">
              As a Grihasta (service seeker), you agree to:
              <ul>
                <li>Provide accurate booking details including date, time, and service requirements</li>
                <li>Fulfill all payment obligations as agreed</li>
                <li>Confirm attendance within 24 hours of service completion</li>
                <li>Provide honest and fair reviews of services received</li>
              </ul>
            </Typography>

            {/* 6. Acharya Responsibilities */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              6. ACHARYA RESPONSIBILITIES
            </Typography>
            <Typography variant="body1" paragraph component="div">
              As an Acharya (service provider), you agree to:
              <ul>
                <li>Submit accurate verification information including parampara, gotra, and credentials</li>
                <li>Complete the admin verification process before offering services</li>
                <li>Maintain professional service delivery standards</li>
                <li>Confirm attendance after service completion</li>
                <li>Accept the platform service fee as specified</li>
                <li>Provide services in accordance with Hindu spiritual traditions</li>
              </ul>
            </Typography>

            {/* 7. Bookings and Payments */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              7. BOOKINGS AND PAYMENTS
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>Payment Processing:</strong> All payments are processed securely via Razorpay. The Platform operates an escrow system where payment is held until both parties confirm attendance.
            </Typography>
            <Typography variant="body1" paragraph component="div">
              <strong>Cancellation Policy:</strong>
              <ul>
                <li>Cancellations 48+ hours before service: 90% refund</li>
                <li>Cancellations 24-48 hours before service: 50% refund</li>
                <li>Cancellations less than 24 hours before service: No refund</li>
              </ul>
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>Anti-Fraud Mechanism:</strong> A two-way attendance confirmation system ensures both parties attended the service. Disputes are subject to our resolution process.
            </Typography>

            {/* 8. Platform Role */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              8. PLATFORM ROLE
            </Typography>
            <Typography variant="body1" paragraph>
              Savitara acts solely as a facilitator connecting Grihastas with Acharyas. We are not the employer of Acharyas and do not guarantee the quality or outcomes of services provided. While we verify Acharya credentials, this verification does not constitute an endorsement. The Platform is not liable for disputes between users.
            </Typography>

            {/* 9. Prohibited Activities */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              9. PROHIBITED ACTIVITIES
            </Typography>
            <Typography variant="body1" paragraph component="div">
              Users are strictly prohibited from engaging in:
              <ul>
                <li>Fraud, harassment, discrimination, or abusive behavior</li>
                <li>Circumventing the platform for direct payments to avoid fees</li>
                <li>Creating multiple accounts for referral program abuse</li>
                <li>Review manipulation or fake reviews</li>
                <li>Data scraping or unauthorized data collection</li>
                <li>Religious insensitivity or disrespectful conduct</li>
              </ul>
            </Typography>

            {/* 10. Intellectual Property */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              10. INTELLECTUAL PROPERTY
            </Typography>
            <Typography variant="body1" paragraph>
              All content, trademarks, and intellectual property on the Platform are owned by Savitara. By uploading content, you grant us a license to use, display, and distribute that content in connection with Platform operations. Our trademarks and brand identity are protected under applicable law.
            </Typography>

            {/* 11. Privacy and Data Protection */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              11. PRIVACY AND DATA PROTECTION
            </Typography>
            <Typography variant="body1" paragraph>
              Your use of the Platform is also governed by our Privacy Policy, which details how we collect, use, and protect your data including name, email, phone, location, and Google ID. We share booking details and payment information only as necessary to facilitate services. For complete details, please review our Privacy Policy.
            </Typography>

            {/* 12. Referral Program */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              12. REFERRAL PROGRAM
            </Typography>
            <Typography variant="body1" paragraph>
              New users receive welcome bonus credits upon registration. Additional credits are earned through successful referrals. Anti-abuse measures are in place to prevent exploitation. All credits expire 12 months from the date of issuance.
            </Typography>

            {/* 13. Communications */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              13. COMMUNICATIONS
            </Typography>
            <Typography variant="body1" paragraph>
              By using the Platform, you consent to receive transactional notifications regarding bookings and account activity. Marketing communications can be opted out at any time. All in-app messages are subject to moderation for safety and compliance.
            </Typography>

            {/* 14. Limitation of Liability */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              14. LIMITATION OF LIABILITY
            </Typography>
            <Typography variant="body1" paragraph>
              THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. SAVITARA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. Our maximum liability is capped at the total fees you paid to the Platform in the 12 months preceding the claim. We are not liable for force majeure events beyond our reasonable control.
            </Typography>

            {/* 15. Indemnification */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              15. INDEMNIFICATION
            </Typography>
            <Typography variant="body1" paragraph>
              You agree to indemnify and hold harmless Savitara, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your violations of these Terms, illegal activities, or service disputes.
            </Typography>

            {/* 16. Dispute Resolution */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              16. DISPUTE RESOLUTION
            </Typography>
            <Typography variant="body1" paragraph>
              These Terms are governed by the laws of India. The exclusive jurisdiction for disputes shall be the courts of Bangalore, Karnataka. Disputes involving amounts exceeding ₹1,00,000 shall be subject to arbitration. Class action lawsuits are expressly waived.
            </Typography>

            {/* 17. Indian Law Compliance */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              17. INDIAN LAW COMPLIANCE
            </Typography>
            <Typography variant="body1" paragraph>
              The Platform complies with the Information Technology Act 2000, Intermediary Guidelines, and Consumer Protection Act 2019. We adhere to data protection and security standards mandated by Indian law.
            </Typography>

            {/* 18. Contact Information */}
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }} color="primary" fontWeight="600">
              18. CONTACT INFORMATION
            </Typography>
            <Typography variant="body1" paragraph component="div">
              For questions or concerns regarding these Terms and Conditions:
              <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: 12 }}>
                <li><strong>General Support:</strong> support@savitara.com</li>
                <li><strong>Legal Inquiries:</strong> legal@savitara.com</li>
                <li><strong>Grievances:</strong> grievance@savitara.com</li>
              </ul>
            </Typography>

            <Divider sx={{ my: 4 }} />

            <Typography variant="body2" color="text.secondary" textAlign="center">
              By using Savitara, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Layout>
  )
}
