import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Custom hook for responsive sizing across the app
 * Handles platform-specific (Android/iOS) and device-specific (Phone/Tablet) sizing
 * 
 * @param {Object} sizeConfig - Configuration object with responsive values
 * @param {Object} sizeConfig.android - Android phone values
 * @param {Object} sizeConfig.ios - iOS phone values
 * @param {Object} sizeConfig.tablet - Tablet values (applies to both platforms)
 * @param {Object} sizeConfig.default - Default fallback values
 * @returns {Object} - { SIZES, isTablet, isAndroid, isIOS, SCREEN_WIDTH }
 * 
 * @example
 * const { SIZES, isTablet } = useResponsiveSizes({
 *   headerIconSize: { android: 22, ios: 23, tablet: 25, default: 22 },
 *   paddingHorizontal: { android: 16, ios: 18, tablet: 20, default: 16 },
 * });
 */
export const useResponsiveSizes = (sizeConfig = {}) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';
  const isTabletDevice = SCREEN_WIDTH >= 768;

  const getResponsiveValue = ({ android, ios, tablet, default: defaultValue }) => {
    if (isTabletDevice && tablet !== undefined) return tablet;
    if (isAndroid && android !== undefined) return android;
    if (isIOS && ios !== undefined) return ios;
    return defaultValue;
  };

  const SIZES = useMemo(() => {
    const sizes = {};
    
    Object.keys(sizeConfig).forEach((key) => {
      sizes[key] = getResponsiveValue(sizeConfig[key]);
    });
    
    return sizes;
  }, [SCREEN_WIDTH, sizeConfig]);

  return {
    SIZES,
    isTablet: isTabletDevice,
    isAndroid,
    isIOS,
    SCREEN_WIDTH,
  };
};

/**
 * Predefined responsive size configurations for common use cases
 */
export const commonSizes = {
  headerIconSize: { android: 22, ios: 23, tablet: 25, default: 22 },
  headerTitleSize: { android: 15, ios: 17, tablet: 18, default: 16 },
  contentMaxWidth: { android: '100%', ios: '100%', tablet: 600, default: '100%' },
  paddingHorizontal: { android: 16, ios: 18, tablet: 20, default: 16 },
  sectionSpacing: { android: 22, ios: 24, tablet: 26, default: 22 },
  cardSpacing: { android: 12, ios: 14, tablet: 18, default: 12 },
  title: { android: 15, ios: 16, tablet: 17, default: 15 },
  body: { android: 13, ios: 14, tablet: 14, default: 13 },
  inputHeight: { android: 44, ios: 44, tablet: 46, default: 44 },
  buttonHeight: { android: 50, ios: 50, tablet: 46, default: 50 },
};

export default useResponsiveSizes;

