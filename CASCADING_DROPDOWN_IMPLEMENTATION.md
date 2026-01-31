# Cascading Location Dropdown Components

This implementation provides seamless, cascading dropdown functionality for country, state, city selection with automatic phone code prefilling across all Savitara platform interfaces.

## Features

✅ **Country → State → City Cascading**: Selecting a country filters states, selecting a state filters cities
✅ **Automatic Phone Code Prefilling**: Phone input automatically prefills with country code (+91 for India, etc.)
✅ **Search/Filter Support**: All dropdowns support search functionality for better UX
✅ **Flag Icons**: Countries display with their respective flag emojis
✅ **Consistent API**: Same interface across web, mobile, and admin platforms
✅ **Accessibility**: Proper labels, disabled states, and helper text
✅ **Error Prevention**: Prevents invalid selections and maintains data consistency

## Installed Dependencies

```bash
npm install country-state-city
```

This package is now installed in:
- `savitara-web/` (React + Vite + MUI)
- `savitara-app/` (React Native + Expo)  
- `admin-savitara-web/` (Next.js + MUI)

## Usage Examples

### 1. Web Application (React + MUI)

```jsx
import CascadingLocationSelect from '../components/CascadingLocationSelect';

function OnboardingForm() {
  const [formData, setFormData] = useState({
    country: 'India',
    state: '',
    city: '',
    phone: ''
  });

  const handleLocationChange = (location) => {
    setFormData({ ...formData, ...location });
  };

  const handlePhoneChange = (phone) => {
    setFormData({ ...formData, phone });
  };

  return (
    <CascadingLocationSelect
      country={formData.country}
      state={formData.state}
      city={formData.city}
      phone={formData.phone}
      onLocationChange={handleLocationChange}
      onPhoneChange={handlePhoneChange}
      required
      sx={{ mb: 2 }}
    />
  );
}
```

### 2. Mobile Application (React Native)

```jsx
import CascadingLocationSelect from '../../components/CascadingLocationSelect';

function OnboardingScreen() {
  const [formData, setFormData] = useState({
    location: { country: 'India', state: '', city: '' },
    phone: ''
  });

  const handleLocationChange = (location) => {
    setFormData({
      ...formData,
      location: { ...formData.location, ...location }
    });
  };

  const handlePhoneChange = (phone) => {
    setFormData({ ...formData, phone });
  };

  return (
    <CascadingLocationSelect
      country={formData.location.country}
      state={formData.location.state}
      city={formData.location.city}
      phone={formData.phone}
      onLocationChange={handleLocationChange}
      onPhoneChange={handlePhoneChange}
      required
      style={styles.input}
    />
  );
}
```

### 3. Admin Web (Next.js + MUI)

```jsx
import CascadingLocationSelect from '../components/CascadingLocationSelect';

function UserManagementForm() {
  const [userData, setUserData] = useState({
    country: '',
    state: '',
    city: '',
    phone: ''
  });

  return (
    <CascadingLocationSelect
      country={userData.country}
      state={userData.state}
      city={userData.city}
      phone={userData.phone}
      onLocationChange={(location) => setUserData({ ...userData, ...location })}
      onPhoneChange={(phone) => setUserData({ ...userData, phone })}
      variant="filled"
      size="small"
    />
  );
}
```

## Component Props

### Web Components (React/Next.js)
```typescript
interface CascadingLocationSelectProps {
  country?: string;           // Current country value
  state?: string;             // Current state value  
  city?: string;              // Current city value
  phone?: string;             // Current phone value
  onLocationChange: (location: {country: string, state: string, city: string}) => void;
  onPhoneChange?: (phone: string) => void;
  disabled?: boolean;         // Disable all inputs
  required?: boolean;         // Mark fields as required
  sx?: object;               // MUI styling
  variant?: 'outlined' | 'filled' | 'standard';
  size?: 'small' | 'medium';
}
```

### Mobile Component (React Native)
```typescript
interface CascadingLocationSelectProps {
  country?: string;
  state?: string;
  city?: string;
  phone?: string;
  onLocationChange: (location: {country: string, state: string, city: string}) => void;
  onPhoneChange?: (phone: string) => void;
  disabled?: boolean;
  required?: boolean;
  style?: object;            // React Native styling
}
```

## User Experience Features

### 🌟 **Visual Enhancements**
- **Flag Emojis**: Each country shows its flag (🇮🇳 India, 🇺🇸 USA, etc.)
- **Phone Code Chips**: Country codes displayed as styled chips/badges
- **Search Functionality**: Type to filter options in all dropdowns
- **Loading States**: Smooth transitions between selections

### 🚀 **Smart Behavior**  
- **Auto-Reset**: Selecting a new country resets state and city
- **Auto-Reset**: Selecting a new state resets city
- **Phone Sync**: Phone code updates automatically with country selection
- **Validation**: Prevents invalid state/city combinations

### 📱 **Responsive Design**
- **Web**: Uses MUI Autocomplete with search, accessible keyboard navigation
- **Mobile**: Uses react-native-paper Menu with search bars, touch-friendly
- **Admin**: Enhanced version with additional metadata display

## Integration Points

### Backend API Compatibility
The components output standard location objects compatible with your existing API:

```javascript
// Grihasta Onboarding API
{
  "location": {
    "city": "Mumbai",
    "state": "Maharashtra", 
    "country": "India"
  },
  "phone": "+919876543210"
}

// Acharya Onboarding API  
{
  "location": {
    "city": "Varanasi",
    "state": "Uttar Pradesh",
    "country": "India"
  },
  "phone": "+919876543211"
}
```

### Database Storage
No changes needed to your existing MongoDB schemas. The components work with your current location and phone field structures.

## Files Modified/Created

### ✅ **Created New Components**
- `savitara-web/src/components/CascadingLocationSelect.jsx` - Web component
- `savitara-app/src/components/CascadingLocationSelect.js` - Mobile component  
- `admin-savitara-web/src/components/CascadingLocationSelect.js` - Admin component

### ✅ **Updated Existing Files**
- `savitara-web/src/pages/Onboarding.jsx` - Integrated new component
- `savitara-app/src/screens/common/OnboardingScreen.js` - Integrated new component

### ✅ **Package Installations**
- `country-state-city` package installed in all 3 frontend projects

## Testing the Implementation

1. **Web Application**: Currently running at http://localhost:3000/
   - Navigate to `/onboarding` after login
   - Test the cascading behavior: Country → State → City
   - Verify phone code auto-updates

2. **Mobile Application**: 
   ```bash
   cd savitara-app
   npx expo start
   ```
   - Test on device/simulator
   - Verify touch interactions and search functionality

3. **Admin Application**:
   ```bash
   cd admin-savitara-web  
   npm run dev
   ```
   - Test in user management forms

## Benefits Achieved

✅ **Better User Experience**: No more manual typing of location names
✅ **Data Consistency**: Eliminates spelling mistakes and invalid combinations  
✅ **International Support**: Works with all countries, states, and cities worldwide
✅ **Phone Validation**: Automatic country code prevents formatting errors
✅ **Accessibility**: Proper ARIA labels and keyboard navigation
✅ **Performance**: Efficient filtering and search without external API calls
✅ **Reusability**: Same component can be used across all forms needing location input

The implementation is now ready for production use across all Savitara platform interfaces! 🚀