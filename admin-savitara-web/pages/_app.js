import { AuthProvider } from '../src/context/AuthContext';
import { ThemeContextProvider } from '../src/context/ThemeContext';
import '../styles/globals.css';

// Typography Standard:
// - Brand: Samarkan - ONLY for "Savitara" company name
// - Headings: Poppins (weights: 500-700)
// - Body: Inter (gold standard for UI)

function MyApp({ Component, pageProps }) {
  return (
    <ThemeContextProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeContextProvider>
  );
}

export default MyApp;
