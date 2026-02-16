import { useState } from 'react'
import {useNavigate } from 'react-router-dom'
import { Box, Container, Typography, TextField, Button, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Paper, Chip, IconButton, CircularProgress, Alert, Checkbox, Link, Stepper, Step, StepLabel, Select, MenuItem } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CascadingLocationSelect from '../components/CascadingLocationSelect'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { toast } from 'react-toastify'

const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
]

const steps = ['Language & Role', 'Terms & Conditions', 'Profile Information']

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  
  // Step 1: Language and Role
  const [selectedLanguage, setSelectedLanguage] = useState(
    localStorage.getItem('user_language') || 'en'
  )
  const [role, setRole] = useState(user?.role || 'grihasta')
  
  // Step 2: Terms Acceptance
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [acharyaAgreementAccepted, setAcharyaAgreementAccepted] = useState(false)
  
  // Step 3: Profile fields
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    city: '',
    state: '',
    country: 'India',
    parampara: '',
    // Grihasta specific
    preferences: {},
    referral_code: '',
    // Acharya specific
    gotra: '',
    experience_years: '',
    study_place: '',
    bio: '',
  })

  // For array fields (Acharya)
  const [specializations, setSpecializations] = useState([])
  const [languages, setLanguages] = useState([])
  const [newSpec, setNewSpec] = useState('')
  const [newLang, setNewLang] = useState('')
  
  // KYC documents for Acharya
  const [kycDocuments, setKycDocuments] = useState([])
  const [uploadingDocs, setUploadingDocs] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleNext = () => {
    if (activeStep === 0) {
      // Validate language and role selection
      if (!selectedLanguage || !role) {
        toast.error('Please select language and role')
        return
      }
      localStorage.setItem('user_language', selectedLanguage)
    }
    
    if (activeStep === 1) {
      // Validate terms acceptance
      if (!termsAccepted || !privacyAccepted) {
        toast.error('You must accept the Terms & Conditions and Privacy Policy')
        return
      }
      if (role === 'acharya' && !acharyaAgreementAccepted) {
        toast.error('You must accept the Acharya Service Provider Agreement')
        return
      }
    }
    
    setActiveStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const addSpecialization = () => {
    if (newSpec.trim() && !specializations.includes(newSpec.trim())) {
      setSpecializations([...specializations, newSpec.trim()])
      setNewSpec('')
    }
  }

  const addLanguage = () => {
    if (newLang.trim() && !languages.includes(newLang.trim())) {
      setLanguages([...languages, newLang.trim()])
      setNewLang('')
    }
  }

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    
    setUploadingDocs(true)
    const formData = new FormData()
    
    files.forEach(file => {
      formData.append('files', file)
    })
    
    try {
      const response = await api.post('/upload/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      if (response.data.success) {
        setKycDocuments([...kycDocuments, ...response.data.data.urls])
        toast.success('Documents uploaded successfully')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload documents')
    } finally {
      setUploadingDocs(false)
    }
  }


  const handleLocationChange = (location) => {
    setFormData({
      ...formData,
      ...location
    })
  }

  const handlePhoneChange = (phone) => {
    setFormData({ ...formData, phone })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Determine endpoint based on role
      const endpoint = role === 'grihasta' 
        ? '/users/grihasta/onboarding' 
        : '/users/acharya/onboarding'
      
      // Build request body based on role
      let requestBody
      
      if (role === 'grihasta') {
        requestBody = {
          name: formData.name,
          verification_documents: kycDocuments,
          phone: formData.phone || null,
          location: {
            city: formData.city,
            state: formData.state,
            country: formData.country || 'India'
          },
          parampara: formData.parampara,
          preferences: formData.preferences || {},
          referral_code: formData.referral_code || null,
          preferred_language: selectedLanguage,
          terms_accepted: termsAccepted,
          privacy_accepted: privacyAccepted
        }
      } else {
        // Acharya
        requestBody = {
          name: formData.name,
          phone: formData.phone || null,
          parampara: formData.parampara,
          gotra: formData.gotra,
          experience_years: Number.parseInt(formData.experience_years, 10) || 0,
          study_place: formData.study_place,
          specializations: specializations.length > 0 ? specializations : ['General'],
          languages: languages.length > 0 ? languages : ['Hindi'],
          location: {
            city: formData.city,
            state: formData.state,
            country: formData.country || 'India'
          },
          bio: formData.bio || null,
          referral_code: formData.referral_code || null,
          preferred_language: selectedLanguage,
          terms_accepted: termsAccepted,
          privacy_accepted: privacyAccepted,
          acharya_agreement_accepted: acharyaAgreementAccepted
        }
      }
      
      const response = await api.post(endpoint, requestBody)
      const responseData = response.data.data || response.data
      const userData = responseData.user || responseData
      
      if (updateUser && userData) {
        updateUser(userData)
      }
      
      toast.success('Profile completed successfully!')
      navigate('/dashboard')
    } catch (error) {
      console.error('Onboarding error:', error.response?.data || error)
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Failed to complete onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom textAlign="center">
          Complete Your Profile
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }} textAlign="center">
          Tell us a bit more about yourself
        </Typography>

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 1: Language & Role Selection */}
        {activeStep === 0 && (
          <Box>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <FormLabel sx={{ mb: 1, fontWeight: 600 }}>Select Your Preferred Language</FormLabel>
              <Select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                displayEmpty
              >
                {LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.name} ({lang.nativeName})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>I am a</FormLabel>
              <RadioGroup 
                name="role" 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
              >
                <FormControlLabel 
                  value="grihasta" 
                  control={<Radio />} 
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="500">Grihasta (Service Seeker)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Looking for spiritual services and guidance
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                />
                <FormControlLabel 
                  value="acharya" 
                  control={<Radio />} 
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="500">Acharya (Service Provider)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Providing spiritual services and guidance to seekers
                      </Typography>
                    </Box>
                  }
                  sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                />
              </RadioGroup>
            </FormControl>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" onClick={handleNext} size="large">
                Next
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 2: Terms & Conditions */}
        {activeStep === 1 && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Please read and accept the following agreements to continue
            </Alert>

            {/* Terms and Conditions */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Terms and Conditions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                By using Savitara, you agree to our Terms and Conditions which include:
                • Acceptance of binding agreement upon platform use
                • User account responsibilities and eligibility requirements (18+ years)
                • Service booking, payment, and cancellation policies
                • Prohibited activities including fraud, harassment, and platform circumvention
                • Limitation of liability and dispute resolution procedures
                • Compliance with Indian laws including IT Act 2000 and Consumer Protection Act 2019
                <br /><br />
                <Link href="/terms" target="_blank" rel="noopener" underline="hover">
                  Read full Terms and Conditions →
                </Link>
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={termsAccepted} 
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    I have read and agree to the <Link href="/terms" target="_blank" rel="noopener">Terms and Conditions</Link>
                  </Typography>
                }
              />
            </Paper>

            {/* Privacy Policy */}
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Privacy Policy
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                We collect and protect your personal information including name, email, phone, location, and transaction data. 
                Your data is used to facilitate services, ensure security, and improve the platform. We comply with Indian data 
                protection laws and implement industry-standard security measures.
                <br /><br />
                <Link href="/privacy" target="_blank" rel="noopener" underline="hover">
                  Read full Privacy Policy →
                </Link>
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={privacyAccepted} 
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    I have read and agree to the <Link href="/privacy" target="_blank" rel="noopener">Privacy Policy</Link>
                  </Typography>
                }
              />
            </Paper>

            {/* Acharya-Specific Agreement */}
            {role === 'acharya' && (
              <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'warning.lighter' }}>
                <Typography variant="h6" gutterBottom color="warning.dark">
                  Acharya Service Provider Agreement
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  As an Acharya registering on Savitara, I understand and agree to the following:
                </Typography>
                <Typography variant="body2" component="div" sx={{ mb: 2, pl: 2 }}>
                  <ul>
                    <li>I will submit accurate verification documents including credentials related to my parampara, gotra, and spiritual education</li>
                    <li>I understand that my profile will be reviewed and verified by Admin before I can offer services</li>
                    <li>I will maintain professional conduct and deliver services according to Hindu spiritual traditions</li>
                    <li>I will confirm attendance after completing each service as part of the two-way verification system</li>
                    <li>I accept that Savitara will deduct a platform service fee from my earnings</li>
                    <li>I am responsible for any taxes or legal obligations related to my earnings</li>
                    <li>I will not circumvent the platform for direct payments or engage in fraudulent activities</li>
                    <li>I understand that Savitara acts only as a facilitator and is not my employer</li>
                  </ul>
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={acharyaAgreementAccepted} 
                      onChange={(e) => setAcharyaAgreementAccepted(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight="500">
                      I have read, understood, and agree to the Acharya Service Provider Agreement
                    </Typography>
                  }
                />
              </Paper>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleBack} size="large">
                Back
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNext} 
                size="large"
                disabled={!termsAccepted || !privacyAccepted || (role === 'acharya' && !acharyaAgreementAccepted)}
              >
                I Agree - Continue
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 3: Profile Information */}
        {activeStep === 2 && (
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              autoComplete="name"
              sx={{ mb: 2 }}
            />

            <CascadingLocationSelect
              country={formData.country}
              state={formData.state}
              city={formData.city}
              phone={formData.phone}
              onLocationChange={handleLocationChange}
              onPhoneChange={handlePhoneChange}
              required
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Parampara (Spiritual Tradition)"
              name="parampara"
              value={formData.parampara}
              onChange={handleChange}
              placeholder="e.g., Shaiva, Vaishnava, Shakta, Smarta"
              required
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Referral Code (Optional)"
              name="referral_code"
              value={formData.referral_code}
              onChange={handleChange}
              sx={{ mb: 2 }}
            />

          {role === 'acharya' && (
            <>
              <TextField
                fullWidth
                label="Gotra"
                name="gotra"
                value={formData.gotra}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Years of Experience"
                name="experience_years"
                type="number"
                value={formData.experience_years}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Place of Study"
                name="study_place"
                value={formData.study_place}
                onChange={handleChange}
                placeholder="e.g., Varanasi Sanskrit University"
                required
                sx={{ mb: 2 }}
              />

              {/* Specializations */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Specializations *</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add specialization"
                    value={newSpec}
                    onChange={(e) => setNewSpec(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                  />
                  <IconButton onClick={addSpecialization} color="primary"><AddIcon /></IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {specializations.map((s, i) => (
                    <Chip key={i} label={s} onDelete={() => setSpecializations(specializations.filter((_, idx) => idx !== i))} />
                  ))}
                </Box>
              </Box>

              {/* Languages */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Languages Known *</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add language"
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                  />
                  <IconButton onClick={addLanguage} color="primary"><AddIcon /></IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {languages.map((l, i) => (
                    <Chip key={i} label={l} onDelete={() => setLanguages(languages.filter((_, idx) => idx !== i))} />
                  ))}
                </Box>
              </Box>

              <TextField
                fullWidth
                label="Bio (Optional)"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                multiline
                rows={3}
                placeholder="Tell seekers about your background and experience"
                sx={{ mb: 2 }}
              />

              {/* KYC Document Upload */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  KYC Verification Documents *
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Please upload ID proof (Aadhaar/PAN), educational certificates, 
                  or any documents verifying your credentials as an Acharya.
                </Alert>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  disabled={uploadingDocs}
                  fullWidth
                >
                  {uploadingDocs ? 'Uploading...' : 'Upload Documents (PDF, Images)'}
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentUpload}
                  />
                </Button>
                {kycDocuments.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="success.main">
                      {kycDocuments.length} document(s) uploaded
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Your documents will be reviewed by admin for verification.
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button onClick={handleBack} size="large">
              Back
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              size="large" 
              disabled={loading}
              startIcon={loading && <CircularProgress size={20} color="inherit" />}
            >
              {loading ? 'Completing...' : 'Complete Profile'}
            </Button>
          </Box>
        </form>
        )}
      </Paper>
    </Container>
  )
}
