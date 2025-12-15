import Icon from '@expo/vector-icons/Feather';
import React, { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { colors } from '../../constants/theme';

export const SearchBar = ({
  placeholder = "Search...",
  value,
  onChangeText,
  onFocus,
  onBlur,
  style,
  containerStyle,
  showClearButton = true,
  returnKeyType = "search",
  ...props
}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleClear = () => {
    onChangeText?.('');
  };

  const isTablet = SCREEN_WIDTH >= 768;
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';
  
  const getValue = ({ android, ios, tablet, default: defaultValue }) => {
    if (isTablet && tablet !== undefined) return tablet;
    if (isAndroid && android !== undefined) return android;
    if (isIOS && ios !== undefined) return ios;
    return defaultValue;
  };
  
  const SIZES = {
    searchHeight: getValue({ android: 50, ios: 52, tablet: 56, default: 50 }),
    fontSize: getValue({ android: 13, ios: 14, tablet: 14, default: 13 }),
    iconSize: getValue({ android: 17, ios: 18, tablet: 18, default: 17 }),
  };

  const styles = createStyles(SIZES);

  useEffect(() => {
    const onHide = () => {
      // If keyboard hides while input is focused, blur and remove highlight
      if (inputRef.current?.isFocused?.()) {
        inputRef.current?.blur?.();
      }
      setIsFocused(false);
    };
    const sub1 = Keyboard.addListener('keyboardWillHide', onHide);
    const sub2 = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      sub1?.remove?.();
      sub2?.remove?.();
    };
  }, []);

  return (
    <View style={[styles.searchContainer, containerStyle]}>
      <View style={[
        styles.searchInputContainer,
        isFocused && styles.searchInputContainerFocused,
        style
      ]}>
        <Icon 
          name="search" 
          size={SIZES.iconSize} 
          color={isFocused ? colors.primary : colors.textPlaceholder} 
          style={styles.searchIcon} 
        />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType={returnKeyType}
          clearButtonMode="while-editing"
          allowFontScaling={false}
          maxFontSizeMultiplier={1}
          {...props}
        />
        {showClearButton && value && value.length > 0 && (
          <TouchableOpacity 
            onPress={handleClear}
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <Icon name="x" size={16} color={colors.textPlaceholder} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (SIZES) => StyleSheet.create({
  searchContainer: {
    marginBottom: 24,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 25,
    paddingHorizontal: 16,
    height: SIZES.searchHeight,
    borderWidth: 2,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInputContainerFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.fontSize,
    color: colors.text,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default SearchBar;
