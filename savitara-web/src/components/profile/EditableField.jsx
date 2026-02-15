import { Box, Typography, TextField } from '@mui/material'
import { Person } from '@mui/icons-material'

/**
 * A reusable profile field that switches between display and edit mode
 */
export default function EditableField({
  icon,
  label,
  value,
  editValue,
  isEditing,
  onChange,
  placeholder,
  type = 'text',
  multiline = false,
  rows = 1,
  helperText,
  readOnly = false,
  gridProps
}) {
  const IconComponent = icon || Person

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconComponent sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
      </Box>
      {isEditing && !readOnly ? (
        <TextField
          fullWidth
          type={type}
          value={editValue}
          onChange={onChange}
          size="small"
          placeholder={placeholder}
          multiline={multiline}
          rows={rows}
          helperText={helperText}
        />
      ) : (
        <Typography variant="body1">{value || 'Not provided'}</Typography>
      )}
    </Box>
  )
}
