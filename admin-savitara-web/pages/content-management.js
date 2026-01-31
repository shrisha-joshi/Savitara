import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Container, Typography, Paper, TextField, Button, Grid, Box,
  Tab, Tabs, Card, CardContent, CardActions, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Avatar, Rating, Chip, CircularProgress, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import {
  Add, Edit, Delete, Star, Refresh, FormatQuote, Campaign,
  Visibility, VisibilityOff
} from '@mui/icons-material';
import Layout from '../src/components/Layout';
import withAuth from '../src/hoc/withAuth';
import api from '../src/services/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function ContentManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Testimonials state
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialDialog, setTestimonialDialog] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);
  const [testimonialForm, setTestimonialForm] = useState({
    name: '', location: '', avatar: '', rating: 5, text: '', service: '', is_active: true
  });

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [announcementDialog, setAnnouncementDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '', content: '', type: 'info', is_active: true, priority: 0
  });

  // Notification History state
  const [notificationHistory, setNotificationHistory] = useState([]);

  useEffect(() => {
    fetchAllContent();
  }, []);

  const fetchAllContent = async () => {
    setLoading(true);
    try {
      const [testimonialsRes, announcementsRes, notificationsRes] = await Promise.all([
        api.get('/admin/content/testimonials').catch(() => ({ data: { data: [] } })),
        api.get('/admin/content/announcements').catch(() => ({ data: { data: [] } })),
        api.get('/admin/notifications/history').catch(() => ({ data: { data: [] } }))
      ]);
      setTestimonials(testimonialsRes.data?.data || []);
      setAnnouncements(announcementsRes.data?.data || []);
      setNotificationHistory(notificationsRes.data?.data || []);
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  // Testimonial functions
  const handleOpenTestimonialDialog = (testimonial = null) => {
    if (testimonial) {
      setEditingTestimonial(testimonial);
      setTestimonialForm({ ...testimonial });
    } else {
      setEditingTestimonial(null);
      setTestimonialForm({
        name: '', location: '', avatar: '', rating: 5, text: '', service: '', is_active: true
      });
    }
    setTestimonialDialog(true);
  };

  const handleSaveTestimonial = async () => {
    try {
      setLoading(true);
      if (editingTestimonial) {
        await api.put(`/admin/content/testimonials/${editingTestimonial._id}`, testimonialForm);
        setSnackbar({ open: true, message: 'Testimonial updated successfully', severity: 'success' });
      } else {
        await api.post('/admin/content/testimonials', testimonialForm);
        setSnackbar({ open: true, message: 'Testimonial created successfully', severity: 'success' });
      }
      setTestimonialDialog(false);
      fetchAllContent();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save testimonial', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTestimonial = async (id) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    try {
      await api.delete(`/admin/content/testimonials/${id}`);
      setSnackbar({ open: true, message: 'Testimonial deleted', severity: 'success' });
      fetchAllContent();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete testimonial', severity: 'error' });
    }
  };

  const handleToggleTestimonial = async (id, isActive) => {
    try {
      await api.patch(`/admin/content/testimonials/${id}/toggle`, { is_active: !isActive });
      fetchAllContent();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update status', severity: 'error' });
    }
  };

  // Announcement functions
  const handleOpenAnnouncementDialog = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setAnnouncementForm({ ...announcement });
    } else {
      setEditingAnnouncement(null);
      setAnnouncementForm({
        title: '', content: '', type: 'info', is_active: true, priority: 0
      });
    }
    setAnnouncementDialog(true);
  };

  const handleSaveAnnouncement = async () => {
    try {
      setLoading(true);
      if (editingAnnouncement) {
        await api.put(`/admin/content/announcements/${editingAnnouncement._id}`, announcementForm);
        setSnackbar({ open: true, message: 'Announcement updated successfully', severity: 'success' });
      } else {
        await api.post('/admin/content/announcements', announcementForm);
        setSnackbar({ open: true, message: 'Announcement created successfully', severity: 'success' });
      }
      setAnnouncementDialog(false);
      fetchAllContent();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save announcement', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/admin/content/announcements/${id}`);
      setSnackbar({ open: true, message: 'Announcement deleted', severity: 'success' });
      fetchAllContent();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete announcement', severity: 'error' });
    }
  };

  return (
    <Layout>
      <Head>
        <title>Content Management - Savitara Admin</title>
      </Head>

      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            Content Management
          </Typography>
          <Button startIcon={<Refresh />} onClick={fetchAllContent} disabled={loading}>
            Refresh
          </Button>
        </Box>

        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab icon={<FormatQuote />} label="Testimonials" />
            <Tab icon={<Campaign />} label="Announcements" />
            <Tab icon={<Campaign />} label="Notification History" />
          </Tabs>
        </Paper>

        {loading && <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />}

        {/* Testimonials Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenTestimonialDialog()}>
              Add Testimonial
            </Button>
          </Box>

          <Grid container spacing={3}>
            {testimonials.map((testimonial) => (
              <Grid item xs={12} sm={6} md={4} key={testimonial._id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: testimonial.is_active ? 1 : 0.6 }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar src={testimonial.avatar} sx={{ mr: 2 }}>{testimonial.name?.charAt(0)}</Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">{testimonial.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{testimonial.location}</Typography>
                      </Box>
                    </Box>
                    <Rating value={testimonial.rating} readOnly size="small" sx={{ mb: 1 }} />
                    <Chip label={testimonial.service} size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      &ldquo;{testimonial.text}&rdquo;
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between' }}>
                    <FormControlLabel
                      control={<Switch checked={testimonial.is_active} onChange={() => handleToggleTestimonial(testimonial._id, testimonial.is_active)} />}
                      label={testimonial.is_active ? 'Visible' : 'Hidden'}
                    />
                    <Box>
                      <IconButton onClick={() => handleOpenTestimonialDialog(testimonial)}><Edit /></IconButton>
                      <IconButton color="error" onClick={() => handleDeleteTestimonial(testimonial._id)}><Delete /></IconButton>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {testimonials.length === 0 && !loading && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No testimonials yet. Click &quot;Add Testimonial&quot; to create one.</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Announcements Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenAnnouncementDialog()}>
              Add Announcement
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Content</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow key={announcement._id}>
                    <TableCell>{announcement.title}</TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {announcement.content}
                    </TableCell>
                    <TableCell>
                      <Chip label={announcement.type} color={announcement.type === 'warning' ? 'warning' : announcement.type === 'error' ? 'error' : 'info'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={announcement.is_active ? 'Active' : 'Inactive'} color={announcement.is_active ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleOpenAnnouncementDialog(announcement)}><Edit /></IconButton>
                      <IconButton color="error" onClick={() => handleDeleteAnnouncement(announcement._id)}><Delete /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {announcements.length === 0 && !loading && (
            <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
              <Typography color="text.secondary">No announcements yet.</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Notification History Tab */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Recipients</TableCell>
                  <TableCell>Sent At</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notificationHistory.map((notification) => (
                  <TableRow key={notification._id}>
                    <TableCell>{notification.title}</TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>{notification.body}</TableCell>
                    <TableCell>
                      <Chip label={notification.recipient_type || 'all'} size="small" />
                    </TableCell>
                    <TableCell>
                      {notification.sent_at ? new Date(notification.sent_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip label={notification.status || 'sent'} color={notification.status === 'sent' ? 'success' : 'warning'} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {notificationHistory.length === 0 && !loading && (
            <Paper sx={{ p: 4, textAlign: 'center', mt: 2 }}>
              <Typography color="text.secondary">No notification history yet.</Typography>
            </Paper>
          )}
        </TabPanel>

        {/* Testimonial Dialog */}
        <Dialog open={testimonialDialog} onClose={() => setTestimonialDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="Name" margin="normal"
              value={testimonialForm.name} onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
            />
            <TextField
              fullWidth label="Location" margin="normal"
              value={testimonialForm.location} onChange={(e) => setTestimonialForm({ ...testimonialForm, location: e.target.value })}
            />
            <TextField
              fullWidth label="Avatar URL" margin="normal"
              value={testimonialForm.avatar} onChange={(e) => setTestimonialForm({ ...testimonialForm, avatar: e.target.value })}
            />
            <TextField
              fullWidth label="Service" margin="normal"
              value={testimonialForm.service} onChange={(e) => setTestimonialForm({ ...testimonialForm, service: e.target.value })}
            />
            <Box sx={{ my: 2 }}>
              <Typography component="legend">Rating</Typography>
              <Rating
                value={testimonialForm.rating}
                onChange={(e, value) => setTestimonialForm({ ...testimonialForm, rating: value })}
              />
            </Box>
            <TextField
              fullWidth label="Testimonial Text" margin="normal" multiline rows={4}
              value={testimonialForm.text} onChange={(e) => setTestimonialForm({ ...testimonialForm, text: e.target.value })}
            />
            <FormControlLabel
              control={<Switch checked={testimonialForm.is_active} onChange={(e) => setTestimonialForm({ ...testimonialForm, is_active: e.target.checked })} />}
              label="Active (visible on website)"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTestimonialDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveTestimonial} disabled={loading}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Announcement Dialog */}
        <Dialog open={announcementDialog} onClose={() => setAnnouncementDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingAnnouncement ? 'Edit Announcement' : 'Add Announcement'}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="Title" margin="normal"
              value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
            />
            <TextField
              fullWidth label="Content" margin="normal" multiline rows={4}
              value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
            />
            <TextField
              fullWidth select label="Type" margin="normal" SelectProps={{ native: true }}
              value={announcementForm.type} onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value })}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </TextField>
            <FormControlLabel
              control={<Switch checked={announcementForm.is_active} onChange={(e) => setAnnouncementForm({ ...announcementForm, is_active: e.target.checked })} />}
              label="Active"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAnnouncementDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveAnnouncement} disabled={loading}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Layout>
  );
}

export default withAuth(ContentManagement);
