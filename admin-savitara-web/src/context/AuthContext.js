import { createContext, useContext, useState, useEffect } from 'react';
import { adminAuthAPI } from '../services/api';

const AuthContext = createContext({});

// Super admin email constant
export const SUPER_ADMIN_EMAIL = 'shrishajoshi133@gmail.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('adminUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Check if email is registered as admin
  const checkEmail = async (email) => {
    try {
      const response = await adminAuthAPI.checkEmail(email);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      const response = await adminAuthAPI.login(email, password);
      const { access_token, refresh_token, user: userData } = response.data.data;
      
      localStorage.setItem('adminToken', access_token);
      localStorage.setItem('adminRefreshToken', refresh_token);
      localStorage.setItem('adminUser', JSON.stringify(userData));
      setUser(userData);
      
      return userData;
    } catch (error) {
      throw error;
    }
  };

  // Setup password for first-time login
  const setupPassword = async (email, password, confirmPassword) => {
    try {
      const response = await adminAuthAPI.setupPassword(email, password, confirmPassword);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Initialize super admin (first time setup)
  const initSuperAdmin = async () => {
    try {
      const response = await adminAuthAPI.initSuperAdmin();
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('adminUser');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      checkEmail,
      setupPassword,
      initSuperAdmin,
      isAdmin: user?.role === 'admin',
      isSuperAdmin: user?.is_super_admin || user?.email === SUPER_ADMIN_EMAIL
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
