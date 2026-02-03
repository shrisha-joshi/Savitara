import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LanguageSelector.css'

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
]

const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const navigate = useNavigate()

  const handleContinue = () => {
    // Save language preference
    localStorage.setItem('user_language', selectedLanguage)
    
    // Navigate to onboarding
    navigate('/onboarding')
  }

  return (
    <div className="language-selector-page">
      <div className="language-container">
        <div className="language-header">
          <h1>Choose Your Language</h1>
          <p className="subtitle">भाषा चुनें • ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ • భాషను ఎంచుకోండి • भाषा निवडा</p>
        </div>

        <div className="language-list">
          {LANGUAGES.map((language) => (
            <button
              type="button"
              key={language.code}
              className={`language-item ${selectedLanguage === language.code ? 'selected' : ''}`}
              onClick={() => setSelectedLanguage(language.code)}
            >
              <div className="language-info">
                <span className="flag">{language.flag}</span>
                <div>
                  <div className="language-name">{language.name}</div>
                  <div className="native-name">{language.nativeName}</div>
                </div>
              </div>
              {selectedLanguage === language.code && (
                <span className="checkmark">✓</span>
              )}
            </button>
          ))}
        </div>

        <button className="continue-btn" onClick={handleContinue}>
          Continue →
        </button>
      </div>
    </div>
  )
}

export default LanguageSelector
