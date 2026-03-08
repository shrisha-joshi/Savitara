import '@fontsource/poppins/300.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import { GoogleOAuthProvider } from '@react-oauth/google'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { ThemeContextProvider } from './context/ThemeContext'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ErrorBoundary>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <ThemeContextProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ThemeContextProvider>
        </GoogleOAuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
)

// ToastContainer is rendered OUTSIDE React.StrictMode intentionally.
// React 18 StrictMode double-mounts every component in development, which
// resets react-toastify's internal auto-close timer on each toast so they
// never auto-dismiss. Rendering separately in a plain div avoids this.
const toastMount = document.createElement('div')
document.body.appendChild(toastMount)
ReactDOM.createRoot(toastMount).render(
  <ToastContainer
    position="top-right"
    autoClose={5000}
    hideProgressBar={false}
    newestOnTop
    closeOnClick
    rtl={false}
    pauseOnFocusLoss={false}
    draggable={false}
    pauseOnHover={false}
    theme="colored"
    limit={5}
  />
)
