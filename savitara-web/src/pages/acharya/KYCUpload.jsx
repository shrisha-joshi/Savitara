import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Pending,
  Error as ErrorIcon,
  Description
} from '@mui/icons-material';
import Layout from '../../components/Layout';
import FileUpload from '../../components/FileUpload';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const REQUIRED_DOCUMENTS = [
  { id: 'aadhar', label: 'Aadhar Card', description: 'Government issued ID proof' },
  { id: 'certificate', label: 'Vedic Certificate', description: 'Religious education certificate' },
  { id: 'photo', label: 'Passport Photo', description: 'Recent photo (white background)' }
];

export default function KYCUpload() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState(null);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [currentDocType, setCurrentDocType] = useState('');

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/profile');
      
      if (response.data.success) {
        const profile = response.data.data;
        setKycStatus(profile.kyc_status || 'pending');
        setUploadedDocuments(profile.kyc_documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch KYC status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = async (urls) => {
    try {
      // Update profile with document URLs
      const response = await api.put('/users/profile', {
        kyc_documents: [
          ...uploadedDocuments,
          ...urls.map((url, index) => ({
            type: currentDocType,
            url: url,
            uploaded_at: new Date().toISOString(),
            status: 'pending'
          }))
        ]
      });

      if (response.data.success) {
        toast.success('Documents uploaded successfully!');
        setShowUpload(false);
        setCurrentDocType('');
        fetchKYCStatus();
      }
    } catch (error) {
      toast.error('Failed to save document information');
    }
  };

  const handleUploadError = (error) => {
    toast.error(error || 'Upload failed');
  };

  const startUpload = (docType) => {
    setCurrentDocType(docType);
    setShowUpload(true);
  };

  const getDocumentStatus = (docType) => {
    const doc = uploadedDocuments.find(d => d.type === docType);
    return doc ? doc.status : 'not_uploaded';
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <CheckCircle color="success" />;
      case 'pending': return <Pending color="warning" />;
      case 'rejected': return <ErrorIcon color="error" />;
      default: return <Description color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'approved': return 'Verified';
      case 'pending': return 'Under Review';
      case 'rejected': return 'Rejected';
      default: return 'Not Uploaded';
    }
  };

  if (user?.role !== 'acharya') {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Alert severity="info">
            This page is only accessible to Acharya users for KYC verification.
          </Alert>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            KYC Verification
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload your documents for identity verification
          </Typography>
        </Box>

        {/* Overall KYC Status */}
        <Card sx={{ mb: 4, bgcolor: 'background.paper' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Verification Status
                </Typography>
                <Chip
                  label={getStatusLabel(kycStatus)}
                  color={getStatusColor(kycStatus)}
                  icon={getStatusIcon(kycStatus)}
                  size="medium"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
              {kycStatus === 'pending' && (
                <Alert severity="info" sx={{ flex: 1, minWidth: 300 }}>
                  Your documents are under review. This typically takes 24-48 hours.
                </Alert>
              )}
              {kycStatus === 'rejected' && (
                <Alert severity="error" sx={{ flex: 1, minWidth: 300 }}>
                  Your verification was rejected. Please reupload the required documents.
                </Alert>
              )}
              {kycStatus === 'approved' && (
                <Alert severity="success" sx={{ flex: 1, minWidth: 300 }}>
                  Your account is verified! You can start receiving bookings.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Required Documents
          </Typography>
          <List>
            {REQUIRED_DOCUMENTS.map((doc, index) => {
              const status = getDocumentStatus(doc.id);
              return (
                <Box key={doc.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      py: 2,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <ListItemIcon>{getStatusIcon(status)}</ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight={600}>
                          {doc.label}
                        </Typography>
                      }
                      secondary={doc.description}
                    />
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={getStatusLabel(status)}
                        color={getStatusColor(status)}
                        size="small"
                      />
                      {(status === 'not_uploaded' || status === 'rejected') && (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<CloudUpload />}
                          onClick={() => startUpload(doc.id)}
                        >
                          Upload
                        </Button>
                      )}
                    </Box>
                  </ListItem>
                </Box>
              );
            })}
          </List>
        </Paper>

        {/* Upload Section */}
        {showUpload && (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={600}>
                Upload {REQUIRED_DOCUMENTS.find(d => d.id === currentDocType)?.label}
              </Typography>
              <Button onClick={() => setShowUpload(false)}>Cancel</Button>
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Guidelines:</strong>
              <ul>
                <li>Upload clear, high-quality scans or photos</li>
                <li>Ensure all text is readable</li>
                <li>Accepted formats: PDF, JPG, PNG (max 10MB)</li>
                <li>Multiple files can be uploaded at once</li>
              </ul>
            </Alert>
            
            <FileUpload
              onUploadComplete={handleUploadComplete}
              onError={handleUploadError}
              uploadType="documents"
              maxFiles={5}
              acceptedTypes={['.pdf', '.jpg', '.jpeg', '.png']}
              multiple={true}
              showPreview={true}
            />
          </Paper>
        )}

        {/* Help Section */}
        <Alert severity="info" sx={{ mt: 4 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Need Help?
          </Typography>
          <Typography variant="body2">
            If you face any issues uploading documents or have questions about the verification process,
            please contact our support team at support@savitara.com or call +91-XXXX-XXXXXX
          </Typography>
        </Alert>
      </Container>
    </Layout>
  );
}
