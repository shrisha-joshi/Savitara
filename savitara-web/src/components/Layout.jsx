import { Box, useTheme as useMuiTheme } from '@mui/material'
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout({ children }) {
  const theme = useMuiTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        transition: 'background-color 0.3s, color 0.3s',
        backgroundImage: theme.palette.mode === 'dark' 
          ? 'radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' 
          : 'radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.08) 0%, transparent 50%)'
      }}
    >
      <Navbar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: 4,
          position: 'relative',
          zIndex: 1
        }}
      >
        {children}
      </Box>
      <Footer />
    </Box>
  )
}
