import { Box, Avatar, Typography, Chip, Button } from '@mui/material'
import { Edit, Save, Cancel } from '@mui/icons-material'
import PropTypes from 'prop-types'

/**
 * Profile header with avatar, name, and edit controls
 */
export default function ProfileHeader({
  profileData,
  user,
  isEditing,
  saving,
  onStartEdit,
  onSave,
  onCancel
}) {
  const displayName = profileData?.name || 'User'
  const isAcharya = profileData?.role === 'acharya' || user?.role === 'acharya'
  const memberSince = new Date(
    profileData?.created_at || user?.created_at || Date.now()
  ).toLocaleDateString()

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 4 }}>
      <Avatar
        src={profileData?.profile_picture || user?.photo}
        sx={{
          width: 100,
          height: 100,
          mr: 3,
          border: '4px solid',
          borderColor: 'primary.main'
        }}
      >
        {displayName.charAt(0)}
      </Avatar>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h4" fontWeight={700} color="primary.main">
          {displayName}
        </Typography>
        <Chip
          label={isAcharya ? 'Acharya' : 'Grihasta'}
          color="primary"
          size="small"
          sx={{ mt: 1 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Member since {memberSince}
        </Typography>
      </Box>
      <EditButtons
        isEditing={isEditing}
        saving={saving}
        onStartEdit={onStartEdit}
        onSave={onSave}
        onCancel={onCancel}
      />
    </Box>
  )
}

function EditButtons({ isEditing, saving, onStartEdit, onSave, onCancel }) {
  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={onSave}
          disabled={saving}
          sx={{ borderRadius: 3 }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<Cancel />}
          onClick={onCancel}
          sx={{ borderRadius: 3 }}
        >
          Cancel
        </Button>
      </Box>
    )
  }

  return (
    <Button
      variant="outlined"
      startIcon={<Edit />}
      onClick={onStartEdit}
      sx={{ borderRadius: 3 }}
    >
      Edit Profile
    </Button>
  )
}

EditButtons.propTypes = {
  isEditing: PropTypes.bool.isRequired,
  saving: PropTypes.bool.isRequired,
  onStartEdit: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}

ProfileHeader.propTypes = {
  profileData: PropTypes.object,
  user: PropTypes.object,
  isEditing: PropTypes.bool.isRequired,
  saving: PropTypes.bool.isRequired,
  onStartEdit: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}
