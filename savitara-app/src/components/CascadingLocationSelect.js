import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TextInput, Menu, TouchableRipple, Text, Divider, Searchbar } from 'react-native-paper';
import { Country, State, City } from 'country-state-city';

const CascadingLocationSelect = ({
  country,
  state,
  city,
  phone,
  onLocationChange,
  onPhoneChange,
  disabled = false,
  required = true,
  style = {}
}) => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  
  const [countryMenuVisible, setCountryMenuVisible] = useState(false);
  const [stateMenuVisible, setStateMenuVisible] = useState(false);
  const [cityMenuVisible, setCityMenuVisible] = useState(false);
  
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const countries = Country.getAllCountries();
  const states = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [];
  const cities = selectedState ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode) : [];

  // Filter options based on search
  const filteredCountries = countries.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );
  const filteredStates = states.filter(s => 
    s.name.toLowerCase().includes(stateSearch.toLowerCase())
  );
  const filteredCities = cities.filter(c => 
    c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Initialize with provided values
  useEffect(() => {
    if (country && !selectedCountry) {
      const foundCountry = countries.find(c => c.name === country);
      if (foundCountry) {
        setSelectedCountry(foundCountry);
      }
    }
  }, [country, countries, selectedCountry]);

  useEffect(() => {
    if (state && selectedCountry && !selectedState) {
      const foundState = states.find(s => s.name === state);
      if (foundState) {
        setSelectedState(foundState);
      }
    }
  }, [state, states, selectedState, selectedCountry]);

  useEffect(() => {
    if (city && selectedState && !selectedCity) {
      const foundCity = cities.find(c => c.name === city);
      if (foundCity) {
        setSelectedCity(foundCity);
      }
    }
  }, [city, cities, selectedCity, selectedState]);

  const handleCountrySelect = (countryObj) => {
    setSelectedCountry(countryObj);
    setSelectedState(null);
    setSelectedCity(null);
    
    const newLocation = {
      country: countryObj.name,
      state: '',
      city: ''
    };
    
    onLocationChange(newLocation);
    
    if (onPhoneChange) {
      const countryCode = `+${countryObj.phonecode}`;
      const existingNumber = phone ? phone.replace(/^\+\d+/, '') : '';
      onPhoneChange(countryCode + existingNumber);
    }
    
    setCountryMenuVisible(false);
    setCountrySearch('');
  };

  const handleStateSelect = (stateObj) => {
    setSelectedState(stateObj);
    setSelectedCity(null);
    
    onLocationChange({
      country: selectedCountry?.name || '',
      state: stateObj.name,
      city: ''
    });
    
    setStateMenuVisible(false);
    setStateSearch('');
  };

  const handleCitySelect = (cityObj) => {
    setSelectedCity(cityObj);
    
    onLocationChange({
      country: selectedCountry?.name || '',
      state: selectedState?.name || '',
      city: cityObj.name
    });
    
    setCityMenuVisible(false);
    setCitySearch('');
  };

  const handlePhoneChange = (text) => {
    if (selectedCountry) {
      const countryCode = `+${selectedCountry.phonecode}`;
      // Ensure country code is always present
      if (!text.startsWith(countryCode)) {
        onPhoneChange(countryCode + text.replace(/^\+\d+/, ''));
      } else {
        onPhoneChange(text);
      }
    } else {
      onPhoneChange(text);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Country Dropdown */}
      <View style={styles.inputContainer}>
        <Menu
          visible={countryMenuVisible}
          onDismiss={() => {
            setCountryMenuVisible(false);
            setCountrySearch('');
          }}
          anchor={
            <TouchableRipple 
              onPress={() => !disabled && setCountryMenuVisible(true)}
              disabled={disabled}
            >
              <TextInput
                label={`Country${required ? ' *' : ''}`}
                value={selectedCountry?.name || ''}
                editable={false}
                disabled={disabled}
                right={<TextInput.Icon icon="chevron-down" />}
                left={selectedCountry && (
                  <TextInput.Icon 
                    icon={() => (
                      <Text style={styles.flagIcon}>{selectedCountry.flag}</Text>
                    )} 
                  />
                )}
                style={styles.textInput}
              />
            </TouchableRipple>
          }
          style={styles.menu}
          contentStyle={styles.menuContent}
        >
          <Searchbar
            placeholder="Search countries..."
            onChangeText={setCountrySearch}
            value={countrySearch}
            style={styles.searchbar}
          />
          <ScrollView style={styles.menuScroll}>
            {filteredCountries.map((countryObj) => (
              <Menu.Item
                key={countryObj.isoCode}
                onPress={() => handleCountrySelect(countryObj)}
                title={`${countryObj.flag} ${countryObj.name}`}
                titleStyle={{
                  color: selectedCountry?.isoCode === countryObj.isoCode ? '#FF6B35' : 'black'
                }}
              />
            ))}
          </ScrollView>
        </Menu>
      </View>

      {/* State Dropdown */}
      <View style={styles.inputContainer}>
        <Menu
          visible={stateMenuVisible}
          onDismiss={() => {
            setStateMenuVisible(false);
            setStateSearch('');
          }}
          anchor={
            <TouchableRipple 
              onPress={() => selectedCountry && !disabled && setStateMenuVisible(true)}
              disabled={disabled || !selectedCountry}
            >
              <TextInput
                label={`State${required ? ' *' : ''}`}
                value={selectedState?.name || ''}
                editable={false}
                disabled={disabled || !selectedCountry}
                right={<TextInput.Icon icon="chevron-down" />}
                style={styles.textInput}
              />
            </TouchableRipple>
          }
          style={styles.menu}
          contentStyle={styles.menuContent}
        >
          <Searchbar
            placeholder="Search states..."
            onChangeText={setStateSearch}
            value={stateSearch}
            style={styles.searchbar}
          />
          <ScrollView style={styles.menuScroll}>
            {filteredStates.map((stateObj) => (
              <Menu.Item
                key={stateObj.isoCode}
                onPress={() => handleStateSelect(stateObj)}
                title={stateObj.name}
                titleStyle={{
                  color: selectedState?.isoCode === stateObj.isoCode ? '#FF6B35' : 'black'
                }}
              />
            ))}
          </ScrollView>
        </Menu>
      </View>

      {/* City Dropdown */}
      <View style={styles.inputContainer}>
        <Menu
          visible={cityMenuVisible}
          onDismiss={() => {
            setCityMenuVisible(false);
            setCitySearch('');
          }}
          anchor={
            <TouchableRipple 
              onPress={() => selectedState && !disabled && setCityMenuVisible(true)}
              disabled={disabled || !selectedState}
            >
              <TextInput
                label={`City${required ? ' *' : ''}`}
                value={selectedCity?.name || ''}
                editable={false}
                disabled={disabled || !selectedState}
                right={<TextInput.Icon icon="chevron-down" />}
                style={styles.textInput}
              />
            </TouchableRipple>
          }
          style={styles.menu}
          contentStyle={styles.menuContent}
        >
          <Searchbar
            placeholder="Search cities..."
            onChangeText={setCitySearch}
            value={citySearch}
            style={styles.searchbar}
          />
          <ScrollView style={styles.menuScroll}>
            {filteredCities.map((cityObj) => (
              <Menu.Item
                key={cityObj.name}
                onPress={() => handleCitySelect(cityObj)}
                title={cityObj.name}
                titleStyle={{
                  color: selectedCity?.name === cityObj.name ? '#FF6B35' : 'black'
                }}
              />
            ))}
          </ScrollView>
        </Menu>
      </View>

      {/* Phone Input */}
      {onPhoneChange && (
        <TextInput
          label={`Phone Number${required ? ' *' : ''}`}
          value={phone || ''}
          onChangeText={handlePhoneChange}
          disabled={disabled}
          keyboardType="phone-pad"
          left={
            selectedCountry && (
              <TextInput.Affix 
                text={`${selectedCountry.flag} +${selectedCountry.phonecode} `} 
                textStyle={styles.phonePrefix}
              />
            )
          }
          style={styles.textInput}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 15,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
  menu: {
    marginTop: 50,
    maxWidth: '95%',
  },
  menuContent: {
    maxHeight: 300,
  },
  menuScroll: {
    maxHeight: 200,
  },
  searchbar: {
    margin: 8,
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  flagIcon: {
    fontSize: 20,
  },
  phonePrefix: {
    color: '#666',
    fontWeight: '500',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
});

export default CascadingLocationSelect;
