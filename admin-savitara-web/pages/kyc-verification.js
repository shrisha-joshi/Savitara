import { useState, useEffect } from 'react'
import Layout from '../src/components/Layout'
import withAuth from '../src/hoc/withAuth'
import api from '../src/services/api'
import styles from '../styles/KYCVerification.module.css'

function KYCVerification() {
  const [acharyas, setAcharyas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // pending, verified, rejected
  const [selectedAcharya, setSelectedAcharya] = useState(null)
  const [verificationNote, setVerificationNote] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchAcharyas()
  }, [filter])

  const fetchAcharyas = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/admin/acharyas?kyc_status=${filter}`)
      
      if (response.data.success) {
        setAcharyas(response.data.data.users || response.data.data.acharyas || [])
      }
    } catch (error) {
      console.error('Error fetching acharyas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (acharyaId, status) => {
    if (!confirm(`Are you sure you want to ${status} this Acharya's KYC?`)) {
      return
    }
    
    setProcessing(true)
    
    try {
      const response = await api.post(`/admin/acharyas/${acharyaId}/verify-kyc`, {
        kyc_status: status,
        verification_note: verificationNote || null
      })
      
      if (response.data.success) {
        alert(`KYC ${status} successfully`)
        setSelectedAcharya(null)
        setVerificationNote('')
        fetchAcharyas()
      }
    } catch (error) {
      console.error('Error verifying KYC:', error)
      alert('Failed to update KYC status')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>KYC Verification Board</h1>
          <p className={styles.subtitle}>
            Review and verify Acharya credentials and documents
          </p>
        </div>

        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          <button
            className={`${styles.tab} ${filter === 'pending' ? styles.active : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending ({acharyas.filter(a => a.acharya_profile?.kyc_status === 'pending').length})
          </button>
          <button
            className={`${styles.tab} ${filter === 'verified' ? styles.active : ''}`}
            onClick={() => setFilter('verified')}
          >
            Verified
          </button>
          <button
            className={`${styles.tab} ${filter === 'rejected' ? styles.active : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Rejected
          </button>
        </div>

        {/* Acharyas List */}
        {loading && (
          <div className={styles.loading}>Loading...</div>
        )}
        
        {!loading && acharyas.length === 0 && (
          <div className={styles.empty}>
            <p>No Acharyas with {filter} KYC status</p>
          </div>
        )}
        
        {!loading && acharyas.length > 0 && (
          <div className={styles.acharyasList}>
            {acharyas.map((acharya) => (
              <div key={acharya._id} className={styles.acharyaCard}>
                <div className={styles.acharyaInfo}>
                  <div className={styles.profileSection}>
                    <div className={styles.avatar}>
                      {acharya.name?.charAt(0) || 'A'}
                    </div>
                    <div className={styles.details}>
                      <h3>{acharya.name}</h3>
                      <p className={styles.email}>{acharya.email}</p>
                      <p className={styles.location}>
                        {acharya.location?.city}, {acharya.location?.state}
                      </p>
                    </div>
                  </div>

                  <div className={styles.credentials}>
                    <div className={styles.credItem}>
                      <strong>Parampara:</strong> {acharya.acharya_profile?.parampara || 'N/A'}
                    </div>
                    <div className={styles.credItem}>
                      <strong>Gotra:</strong> {acharya.acharya_profile?.gotra || 'N/A'}
                    </div>
                    <div className={styles.credItem}>
                      <strong>Experience:</strong> {acharya.acharya_profile?.experience_years || 0} years
                    </div>
                    <div className={styles.credItem}>
                      <strong>Study Place:</strong> {acharya.acharya_profile?.study_place || 'N/A'}
                    </div>
                    <div className={styles.credItem}>
                      <strong>Specializations:</strong>{' '}
                      {acharya.acharya_profile?.specializations?.join(', ') || 'N/A'}
                    </div>
                    <div className={styles.credItem}>
                      <strong>Languages:</strong>{' '}
                      {acharya.acharya_profile?.languages?.join(', ') || 'N/A'}
                    </div>
                  </div>

                  {acharya.acharya_profile?.bio && (
                    <div className={styles.bio}>
                      <strong>Bio:</strong>
                      <p>{acharya.acharya_profile.bio}</p>
                    </div>
                  )}

                  {/* Documents */}
                  {acharya.acharya_profile?.verification_documents?.length > 0 && (
                    <div className={styles.documents}>
                      <strong>Uploaded Documents:</strong>
                      <div className={styles.docList}>
                        {acharya.acharya_profile.verification_documents.map((doc, docIndex) => (
                          <a
                            key={`doc-${acharya._id}-${docIndex}`}
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.docLink}
                          >
                            📄 Document {docIndex + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {acharya.acharya_profile?.kyc_status === 'pending' && (
                  <div className={styles.actions}>
                    <textarea
                      className={styles.noteInput}
                      placeholder="Add verification note (optional)"
                      value={selectedAcharya?._id === acharya._id ? verificationNote : ''}
                      onChange={(e) => {
                        setSelectedAcharya(acharya)
                        setVerificationNote(e.target.value)
                      }}
                      rows={2}
                    />
                    <div className={styles.buttonGroup}>
                      <button
                        className={styles.approveBtn}
                        onClick={() => handleVerify(acharya._id, 'verified')}
                        disabled={processing}
                      >
                        ✓ Approve KYC
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => handleVerify(acharya._id, 'rejected')}
                        disabled={processing}
                      >
                        ✗ Reject KYC
                      </button>
                    </div>
                  </div>
                )}

                {acharya.acharya_profile?.kyc_status === 'verified' && (
                  <div className={styles.statusBadge}>
                    <span className={styles.verified}>✓ Verified</span>
                  </div>
                )}

                {acharya.acharya_profile?.kyc_status === 'rejected' && (
                  <div className={styles.statusBadge}>
                    <span className={styles.rejected}>✗ Rejected</span>
                    {acharya.acharya_profile?.verification_note && (
                      <p className={styles.note}>Note: {acharya.acharya_profile.verification_note}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(KYCVerification, { requireAdmin: true })
