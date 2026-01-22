/**
 * Settings Screen
 * Theme, Language, and App preferences
 */
import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import PropTypes from 'prop-types';
import {
  Text,
  List,
  Switch,
  Divider,
  RadioButton,
  Portal,
  Modal,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../context/ThemeContext';
import { changeLanguage, getCurrentLanguage, getAvailableLanguages } from '../../i18n';

// Simple icon components - no color prop needed
const ChevronIcon = (props) => <List.Icon {...props} icon="chevron-right" />;
const OpenInNewIcon = (props) => <List.Icon {...props} icon="open-in-new" />;

// Factory function to create themed icon render props
const createIconRenderer = (icon, color) => (props) => (
  <List.Icon {...props} icon={icon} color={color} />
);

// Factory function to create switch render props
const createSwitchRenderer = (value, onValueChange, color) => () => (
  <Switch value={value} onValueChange={onValueChange} color={color} />
);

const SettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors, isDarkMode, themePreference, setThemePreference } = useTheme();
  
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  
  const availableLanguages = getAvailableLanguages();
  
  // Memoized render props to avoid inline function definitions
  const themeIcon = useMemo(() => createIconRenderer(
    isDarkMode ? 'weather-night' : 'white-balance-sunny', colors.primary
  ), [isDarkMode, colors.primary]);
  
  const translateIcon = useMemo(() => createIconRenderer('translate', colors.primary), [colors.primary]);
  const bellIcon = useMemo(() => createIconRenderer('bell', colors.primary), [colors.primary]);
  const emailIcon = useMemo(() => createIconRenderer('email', colors.primary), [colors.primary]);
  const messageIcon = useMemo(() => createIconRenderer('message-text', colors.primary), [colors.primary]);
  const eyeIcon = useMemo(() => createIconRenderer('eye', colors.primary), [colors.primary]);
  const checkAllIcon = useMemo(() => createIconRenderer('check-all', colors.primary), [colors.primary]);
  const shieldIcon = useMemo(() => createIconRenderer('shield-lock', colors.primary), [colors.primary]);
  const fileDocIcon = useMemo(() => createIconRenderer('file-document', colors.primary), [colors.primary]);
  const infoIcon = useMemo(() => createIconRenderer('information', colors.primary), [colors.primary]);
  
  // Memoized switch renderers
  const pushSwitch = useMemo(() => createSwitchRenderer(pushNotifications, setPushNotifications, colors.primary), [pushNotifications, colors.primary]);
  const emailSwitch = useMemo(() => createSwitchRenderer(emailNotifications, setEmailNotifications, colors.primary), [emailNotifications, colors.primary]);
  const smsSwitch = useMemo(() => createSwitchRenderer(smsNotifications, setSmsNotifications, colors.primary), [smsNotifications, colors.primary]);
  const onlineSwitch = useMemo(() => createSwitchRenderer(showOnlineStatus, setShowOnlineStatus, colors.primary), [showOnlineStatus, colors.primary]);
  const receiptsSwitch = useMemo(() => createSwitchRenderer(readReceipts, setReadReceipts, colors.primary), [readReceipts, colors.primary]);
  
  const handleLanguageChange = async (langCode) => {
    try {
      await changeLanguage(langCode);
      setCurrentLanguage(langCode);
      setLanguageModalVisible(false);
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(t('common.error'), 'Failed to change language');
    }
  };
  
  const handleThemeChange = (preference) => {
    setThemePreference(preference);
    setThemeModalVisible(false);
  };
  
  const getCurrentLanguageName = () => {
    const lang = availableLanguages.find(l => l.code === currentLanguage);
    return lang ? lang.nativeName : 'English';
  };
  
  const getThemeDisplayName = () => {
    switch (themePreference) {
      case 'light':
        return t('common.light_mode') || 'Light Mode';
      case 'dark':
        return t('common.dark_mode') || 'Dark Mode';
      default:
        return 'System Default';
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* Appearance Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            Appearance
          </List.Subheader>
          
          <List.Item
            title={t('common.theme') || 'Theme'}
            description={getThemeDisplayName()}
            left={themeIcon}
            right={ChevronIcon}
            onPress={() => setThemeModalVisible(true)}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
          
          <Divider />
          
          <List.Item
            title={t('common.language') || 'Language'}
            description={getCurrentLanguageName()}
            left={translateIcon}
            right={ChevronIcon}
            onPress={() => setLanguageModalVisible(true)}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>
        
        {/* Notifications Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            Notifications
          </List.Subheader>
          
          <List.Item
            title="Push Notifications"
            description="Receive booking and chat notifications"
            left={bellIcon}
            right={pushSwitch}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
          
          <Divider />
          
          <List.Item
            title="Email Notifications"
            description="Receive updates via email"
            left={emailIcon}
            right={emailSwitch}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
          
          <Divider />
          
          <List.Item
            title="SMS Notifications"
            description="Receive OTP and reminders via SMS"
            left={messageIcon}
            right={smsSwitch}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>
        
        {/* Privacy Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            Privacy
          </List.Subheader>
          
          <List.Item
            title="Show Online Status"
            description="Let others see when you're online"
            left={eyeIcon}
            right={onlineSwitch}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
          
          <Divider />
          
          <List.Item
            title="Read Receipts"
            description="Show when you've read messages"
            left={checkAllIcon}
            right={receiptsSwitch}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>
        
        {/* About Section */}
        <List.Section>
          <List.Subheader style={{ color: colors.primary }}>
            About
          </List.Subheader>
          
          <List.Item
            title="Privacy Policy"
            left={shieldIcon}
            right={OpenInNewIcon}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
          />
          
          <Divider />
          
          <List.Item
            title="Terms of Service"
            left={fileDocIcon}
            right={OpenInNewIcon}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
          />
          
          <Divider />
          
          <List.Item
            title="Version"
            description="1.0.0"
            left={infoIcon}
            style={[styles.listItem, { backgroundColor: colors.surface }]}
            titleStyle={{ color: colors.textPrimary }}
            descriptionStyle={{ color: colors.textSecondary }}
          />
        </List.Section>
      </ScrollView>
      
      {/* Language Selection Modal */}
      <Portal>
        <Modal
          visible={languageModalVisible}
          onDismiss={() => setLanguageModalVisible(false)}
          contentContainerStyle={[styles.modalContent, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Select Language
          </Text>
          
          <RadioButton.Group
            onValueChange={handleLanguageChange}
            value={currentLanguage}
          >
            {availableLanguages.map((lang) => (
              <RadioButton.Item
                key={lang.code}
                label={`${lang.nativeName} (${lang.name})`}
                value={lang.code}
                style={styles.radioItem}
                labelStyle={{ color: colors.textPrimary }}
              />
            ))}
          </RadioButton.Group>
          
          <Button
            mode="outlined"
            onPress={() => setLanguageModalVisible(false)}
            style={styles.modalButton}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
        </Modal>
      </Portal>
      
      {/* Theme Selection Modal */}
      <Portal>
        <Modal
          visible={themeModalVisible}
          onDismiss={() => setThemeModalVisible(false)}
          contentContainerStyle={[styles.modalContent, { backgroundColor: colors.surface }]}
        >
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Select Theme
          </Text>
          
          <RadioButton.Group
            onValueChange={handleThemeChange}
            value={themePreference}
          >
            <RadioButton.Item
              label="Light Mode"
              value="light"
              style={styles.radioItem}
              labelStyle={{ color: colors.textPrimary }}
            />
            <RadioButton.Item
              label="Dark Mode"
              value="dark"
              style={styles.radioItem}
              labelStyle={{ color: colors.textPrimary }}
            />
            <RadioButton.Item
              label="System Default"
              value="system"
              style={styles.radioItem}
              labelStyle={{ color: colors.textPrimary }}
            />
          </RadioButton.Group>
          
          <Button
            mode="outlined"
            onPress={() => setThemeModalVisible(false)}
            style={styles.modalButton}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listItem: {
    paddingVertical: 8,
  },
  modalContent: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  radioItem: {
    paddingVertical: 4,
  },
  modalButton: {
    marginTop: 16,
  },
});

SettingsScreen.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    goBack: PropTypes.func,
  }),
};

export default SettingsScreen;
