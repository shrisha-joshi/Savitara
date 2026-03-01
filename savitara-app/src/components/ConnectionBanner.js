/**
 * ConnectionBanner
 *
 * A thin status bar that slides down from the top of the screen when the
 * WebSocket connection is not fully established:
 *
 *  disconnected  → red   "No connection"
 *  reconnecting  → yellow "Reconnecting…"  + ActivityIndicator
 *  connecting    → yellow "Connecting…"    + ActivityIndicator
 *  connected     → green  "Connected"  → auto-hides after 2 seconds
 */
import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSocket } from '../context/SocketContext';

// ─── Config ────────────────────────────────────────────────────────────────
const BANNER_HEIGHT = 36;
const HIDE_DELAY_MS = 2000; // time to show "Connected" before hiding

// ─── Status → visual config ────────────────────────────────────────────────
const STATUS_CONFIG = {
  connected: {
    backgroundColor: '#2E7D32', // dark green
    label: 'Connected',
    spinner: false,
  },
  connecting: {
    backgroundColor: '#F57F17', // amber
    label: 'Connecting…',
    spinner: true,
  },
  reconnecting: {
    backgroundColor: '#E65100', // deep orange
    label: 'Reconnecting…',
    spinner: true,
  },
  disconnected: {
    backgroundColor: '#B71C1C', // deep red
    label: 'No connection',
    spinner: false,
  },
};

// ─── Component ─────────────────────────────────────────────────────────────
export default function ConnectionBanner() {
  const { connectionStatus } = useSocket();
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const hideTimeoutRef = useRef(null);

  const show = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const hide = () => {
    Animated.timing(translateY, {
      toValue: -BANNER_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (connectionStatus === 'connected') {
      // Show the green banner briefly then slide it back up
      show();
      hideTimeoutRef.current = setTimeout(hide, HIDE_DELAY_MS);
    } else {
      // disconnected / connecting / reconnecting — keep visible
      show();
    }

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]);

  const config = STATUS_CONFIG[connectionStatus] || STATUS_CONFIG.disconnected;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: config.backgroundColor, transform: [{ translateY }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={config.label}
    >
      {config.spinner && (
        <ActivityIndicator
          size="small"
          color="#fff"
          style={styles.spinner}
        />
      )}
      <Text style={styles.label}>{config.label}</Text>
    </Animated.View>
  );
}

ConnectionBanner.propTypes = {};

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 20,
    paddingHorizontal: 16,
  },
  spinner: {
    marginRight: 8,
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
