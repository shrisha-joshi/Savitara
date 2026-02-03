import React from 'react';
import { colors, shadows, mediaQueries } from '../../theme/tokens';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiCalendar, FiMessageSquare, FiUser } from 'react-icons/fi'; // Assuming react-icons is installed, if not we'll use SVGs or text

const MobileNavigation = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Only show on mobile screens
    // Using inline styles for simplicity, but CSS-in-JS or modules is better for production
    const navStyle = {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '60px',
        paddingBottom: 'safe-area-inset-bottom', // For iOS Home Indicator
        boxShadow: shadows.medium,
        zIndex: 1000,
    };

    const itemStyle = (isActive) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        height: '100%',
        color: isActive ? colors.primary : colors.textSecondary,
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: isActive ? '600' : '400',
        background: 'none',
        border: 'none',
        padding: 0,
    });

    const activeRoute = (path) => location.pathname === path;

    return (
        <div style={navStyle} className="mobile-nav-container">
            {/* Adding a style tag for media query since inline styles don't support it directly */}
            <style>
                {`
                    .mobile-nav-container {
                        display: none !important;
                    }
                    ${mediaQueries.mobile} {
                        .mobile-nav-container {
                            display: flex !important;
                        }
                    }
                `}
            </style>

            <button 
                style={itemStyle(activeRoute('/'))} 
                onClick={() => navigate('/')}
            >
                <FiHome size={24} />
                <span style={{ marginTop: '2px' }}>Home</span>
            </button>
            
            <button 
                style={itemStyle(activeRoute('/bookings'))} 
                onClick={() => navigate('/bookings')}
            >
                <FiCalendar size={24} />
                <span style={{ marginTop: '2px' }}>Bookings</span>
            </button>

            <button 
                style={itemStyle(activeRoute('/chat'))} 
                onClick={() => navigate('/chat')}
            >
                <FiMessageSquare size={24} />
                <span style={{ marginTop: '2px' }}>Chat</span>
            </button>

            <button 
                style={itemStyle(activeRoute('/profile'))} 
                onClick={() => navigate('/profile')}
            >
                <FiUser size={24} />
                <span style={{ marginTop: '2px' }}>Profile</span>
            </button>
        </div>
    );
};

export default MobileNavigation;
