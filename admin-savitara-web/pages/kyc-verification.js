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

  const handleVerify = async (acharyaId, action) => {
    const actionText = action === 'approve' ? 'approve' : 'reject'
    if (!confirm(`Are you sure you want to ${actionText} this Acharya's verification?`)) {
      return
    }
    
    setProcessing(true)
    
    try {
      const response = await api.post(`/admin/acharyas/${acharyaId}/verify`, {
        action: action,
        notes: verificationNote || null
      })
      
      if (response.data.success) {
        alert(`Acharya ${actionText}ed successfully`)
        setSelectedAcharya(null)
        setVerificationNote('')
        fetchAcharyas()
      }
    } catch (error) {
      console.error('Error verifying Acharya:', error)
      alert('Failed to update verification status')
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
            Pending ({acharyas.filter(a => a.status === 'pending').length})
          </button>
          <button
            className={`${styles.tab} ${filter === 'verified' ? styles.active : ''}`}
            onClick={() => setFilter('verified')}
          >
            Verified ({acharyas.filter(a => a.status === 'active').length})
          </button>
          <button
            className={`${styles.tab} ${filter === 'rejected' ? styles.active : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Rejected ({acharyas.filter(a => a.status === 'suspended').length})
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
                      {acharya.acharya_profile?.name?.charAt(0) || acharya.email?.charAt(0) || 'A'}
                    </div>
                    <div className={styles.details}>
                      <h3>{acharya.acharya_profile?.name || 'N/A'}</h3>
                      <p className={styles.email}>{acharya.email || 'N/A'}</p>
                      <p className={styles.location}>
                        {acharya.acharya_profile?.location?.city || 'N/A'}, {acharya.acharya_profile?.location?.state || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className={styles.credentials}>
                    <div className={styles.credItem}>
                      <strong>Phone:</strong> {acharya.acharya_profile?.phone || 'N/A'}
                    </div>
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
                      {acharya.acharya_profile?.specializations?.length > 0 
                        ? acharya.acharya_profile.specializations.join(', ') 
                        : 'N/A'}
                    </div>
                    <div className={styles.credItem}>
                      <strong>Languages:</strong>{' '}
                      {acharya.acharya_profile?.languages?.length > 0 
                        ? acharya.acharya_profile.languages.join(', ') 
                        : 'N/A'}
                    </div>
                    {acharya.acharya_profile?.referred_by && (
                      <div className={styles.credItem}>
                        <strong>Referred By:</strong> {acharya.acharya_profile.referred_by}
                      </div>
                    )}
                    {acharya.acharya_profile?.referral_code && (
                      <div className={styles.credItem}>
                        <strong>Referral Code:</strong> {acharya.acharya_profile.referral_code}
                      </div>
                    )}
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
                {acharya.status === 'pending' && (
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
                        onClick={() => handleVerify(acharya._id, 'approve')}
                        disabled={processing}
                      >
                        ✓ Approve Verification
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => handleVerify(acharya._id, 'reject')}
                        disabled={processing}
                      >
                        ✗ Reject Verification
                      </button>
                    </div>
                  </div>
                )}

                {acharya.status === 'active' && (
                  <div className={styles.statusBadge}>
                    <span className={styles.verified}>✓ Verified</span>
                    {acharya.verified_at && (
                      <p className={styles.note}>Verified on: {new Date(acharya.verified_at).toLocaleDateString()}</p>
                    )}
                  </div>
                )}

                {acharya.status === 'suspended' && (
                  <div className={styles.statusBadge}>
                    <span className={styles.rejected}>✗ Rejected</span>
                    {acharya.verification_notes && (
                      <p className={styles.note}>Reason: {acharya.verification_notes}</p>
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
