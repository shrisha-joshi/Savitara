import { Grid, Button, Box, TextField } from '@mui/material'
import { Person, Email, Phone, LocationOn } from '@mui/icons-material'
import EditableField from './EditableField'

/**
 * Common profile fields shared between Acharya and Grihasta
 */
export function CommonProfileFields({ profileData, editedData, isEditing, setEditedData, onGetLocation, saving }) {
  return (
    <>
      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Person}
          label="Full Name"
          value={profileData?.name}
          editValue={editedData.name}
          isEditing={isEditing}
          onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
          placeholder="Your full name"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Email}
          label="Email"
          value={profileData?.email}
          isEditing={false}
          readOnly
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Phone}
          label="Phone"
          value={profileData?.phone}
          editValue={editedData.phone}
          isEditing={isEditing}
          onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
          placeholder="+91 XXXXXXXXXX"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <LocationOn sx={{ mr: 1, color: 'primary.main' }} />
          <span style={{ fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' }}>Location</span>
        </Box>
        {isEditing ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              fullWidth
              value={editedData.city}
              onChange={(e) => setEditedData({ ...editedData, city: e.target.value })}
              size="small"
              placeholder="City"
            />
            <TextField
              fullWidth
              value={editedData.state}
              onChange={(e) => setEditedData({ ...editedData, state: e.target.value })}
              size="small"
              placeholder="State"
            />
            <Button
              variant="outlined"
              size="small"
              onClick={onGetLocation}
              startIcon={<LocationOn />}
              disabled={saving}
            >
              {saving ? 'Fetching...' : 'Use Current Location'}
            </Button>
          </Box>
        ) : (
          <span>
            {[profileData?.location?.city, profileData?.location?.state, profileData?.location?.country].filter(Boolean).join(', ') || 'Not provided'}
          </span>
        )}
      </Grid>

      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Person}
          label="Parampara"
          value={profileData?.parampara}
          editValue={editedData.parampara}
          isEditing={isEditing}
          onChange={(e) => setEditedData({ ...editedData, parampara: e.target.value })}
          placeholder="Your spiritual tradition"
        />
      </Grid>
    </>
  )
}

/**
 * Acharya-specific profile fields
 */
export function AcharyaProfileFields({ profileData, editedData, isEditing, setEditedData }) {
  return (
    <>
      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Person}
          label="Gotra"
          value={profileData?.gotra}
          editValue={editedData.gotra}
          isEditing={isEditing}
          onChange={(e) => setEditedData({ ...editedData, gotra: e.target.value })}
          placeholder="Your gotra"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Person}
          label="Experience (Years)"
          value={profileData?.experience_years ? `${profileData.experience_years} years` : undefined}
          editValue={editedData.experience_years}
          isEditing={isEditing}
          type="number"
          onChange={(e) => setEditedData({ ...editedData, experience_years: Number.parseInt(e.target.value) || 0 })}
          placeholder="Years of experience"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Person}
          label="Place of Study"
          value={profileData?.study_place}
          editValue={editedData.study_place}
          isEditing={isEditing}
          onChange={(e) => setEditedData({ ...editedData, study_place: e.target.value })}
          placeholder="Where you studied"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <EditableField
          icon={Person}
          label="Languages"
          value={Array.isArray(profileData?.languages) && profileData.languages.length > 0 ? profileData.languages.join(', ') : undefined}
          editValue={Array.isArray(editedData.languages) ? editedData.languages.join(', ') : ''}
          isEditing={isEditing}
          onChange={(e) => setEditedData({
            ...editedData,
            languages: e.target.value.split(',').map(l => l.trim()).filter(Boolean)
          })}
          placeholder="Languages (comma-separated)"
          helperText="Enter languages separated by commas"
        />
      </Grid>

      <Grid item xs={12}>
        <EditableField
          icon={Person}
          label="Specializations"
          value={Array.isArray(profileData?.specializations) && profileData.specializations.length > 0 ? profileData.specializations.join(', ') : undefined}
          editValue={Array.isArray(editedData.specializations) ? editedData.specializations.join(', ') : ''}
          isEditing={isEditing}
          onChange={(e) => setEditedData({
            ...editedData,
            specializations: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
          })}
          placeholder="Specializations (comma-separated)"
          helperText="Enter specializations separated by commas"
          multiline
          rows={2}
        />
      </Grid>

      <Grid item xs={12}>
        <EditableField
          icon={Person}
          label="Bio"
          value={profileData?.bio}
          editValue={editedData.bio}
          isEditing={isEditing}
          onChange={(e) => setEditedData({ ...editedData, bio: e.target.value })}
          placeholder="Tell us about yourself"
          multiline
          rows={4}
        />
      </Grid>
    </>
  )
}
