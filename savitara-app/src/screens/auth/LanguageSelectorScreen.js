import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिंदी',
    flag: '🇮🇳',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
  },
];

const LanguageSelectorScreen = ({ navigation, route }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const handleLanguageSelect = async (languageCode) => {
    setSelectedLanguage(languageCode);
  };

  const handleContinue = async () => {
    try {
      // Save language preference
      await AsyncStorage.setItem('user_language', selectedLanguage);
      
      // Navigate to onboarding
      navigation.navigate('Onboarding');
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Language</Text>
        <Text style={styles.subtitle}>भाषा चुनें • ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ • భాషను ఎంచుకోండి • भाषा निवडा</Text>
      </View>

      <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
        {LANGUAGES.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.languageItem,
              selectedLanguage === language.code && styles.selectedLanguageItem,
            ]}
            onPress={() => handleLanguageSelect(language.code)}
          >
            <View style={styles.languageInfo}>
              <Text style={styles.flag}>{language.flag}</Text>
              <View>
                <Text style={[
                  styles.languageName,
                  selectedLanguage === language.code && styles.selectedText
                ]}>
                  {language.name}
                </Text>
                <Text style={[
                  styles.nativeName,
                  selectedLanguage === language.code && styles.selectedNativeText
                ]}>
                  {language.nativeName}
                </Text>
              </View>
            </View>
            {selectedLanguage === language.code && (
              <Ionicons name="checkmark-circle" size={28} color="#FF6B35" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  languageList: {
    flex: 1,
    padding: 20,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  selectedLanguageItem: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF9F5',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  flag: {
    fontSize: 40,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  nativeName: {
    fontSize: 16,
    color: '#666',
  },
  selectedText: {
    color: '#FF6B35',
  },
  selectedNativeText: {
    color: '#FF6B35',
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

LanguageSelectorScreen.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func,
  }).isRequired,
  route: PropTypes.shape({
    params: PropTypes.object,
  }),
};

export default LanguageSelectorScreen;
